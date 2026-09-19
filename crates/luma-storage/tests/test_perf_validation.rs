//! PERF-03 validation harness: multi-run percentile statistics plus scaled-down
//! soak / spike / capacity tiers, using the same services as the existing
//! perf benchmark suites.
//!
//! REGRESSION GUARD: every tier ASSERTS its measured p95 against the recorded
//! budget constants below. A regression past budget fails the test in CI.

/// Recorded budgets (ms), p95, debug profile, **measured on the maintainer's
/// local Windows 11 x86_64 desktop** (see docs/performance/PERF-03-VALIDATION-REPORT.md
/// "Environment"). These are the single source of truth; that report references
/// these values.
mod budget {
    /// Startup (context + DB + services).
    pub const STARTUP_P95_MS: f64 = 40.0;
    /// Library pagination @1k books: full 20-page walk (1,000 books fetched).
    pub const PAGINATION_1K_WALK_P95_MS: f64 = 60.0;
    /// FTS5 search query @1k books.
    pub const FTS5_SEARCH_P95_MS: f64 = 10.0;
    /// PDF cold open, 250-page synthetic document.
    pub const PDF_COLD_OPEN_P95_MS: f64 = 30.0;
    /// PDF sequential navigation, 20 pages cold.
    pub const PDF_NAV_20P_P95_MS: f64 = 200.0;
    /// 10k bulk ingestion (SYNTHETIC SCALE).
    pub const BULK_INGEST_10K_P95_MS: f64 = 600.0;
    /// Single page query on 10k-book library (50/page).
    pub const PAGINATION_10K_QUERY_P95_MS: f64 = 20.0;
    /// Capacity ramp budget: page query p95 at any recorded scale.
    pub const CAPACITY_RAMP_P95_MS: f64 = 20.0;

    /// Multiplier applied to every budget when the harness runs on a CI runner
    /// (detected via the `CI` env var, set by GitHub Actions).
    ///
    /// Why 1.5: all budgets were recorded on a local Windows 11 desktop, but
    /// this workload (SQLite in-memory migrations + service construction) is
    /// CPU/allocator-bound, and GitHub's shared macos-26-arm64 runners run it
    /// 2.4x-3.0x slower at the median with a heavy tail (full evidence:
    /// docs/audits/CI-PERFORMANCE-CALIBRATION.md). Worst observed no-regression
    /// CI p95 = 45.1 ms (jitter); worst local p95 = 16.8 ms.
    ///
    /// The evidence-derived window for the multiplier is (1.13, 2.0):
    /// - LOWER bound 1.13x = worst observed CI jitter (45.1/40) must pass.
    /// - UPPER bound 2.0x = a genuine 2x code regression shifts the whole
    ///   distribution 2x (worst no-regression CI p95 45.1 -> ~90), so the
    ///   effective budget must stay below ~80 ms to catch it.
    /// 1.5 is the midpoint: worst jitter passes with 33% headroom (45.1 vs 60),
    /// and a genuine >=1.7x regression (p95 ~77 ms) still breaches. Local runs
    /// keep the unscaled 40 ms budget, so local regression sensitivity is
    /// completely unchanged. The guard is NOT disabled on CI — every budget
    /// still asserts; only the environmental offset is compensated.
    pub const CI_RUNNER_MULTIPLIER: f64 = 1.5;
}

/// Effective budget for a path: the recorded constant, scaled by the CI runner
/// multiplier when executing on CI. Prints which regime is active so logs are
/// self-describing.
fn effective_budget(name: &str, base_budget_ms: f64) -> f64 {
    if std::env::var_os("CI").is_some_and(|v| !v.is_empty()) {
        let scaled = base_budget_ms * budget::CI_RUNNER_MULTIPLIER;
        println!(
            "BUDGET-CALIB|{name}|base={base_budget_ms:.3}ms|ci_multiplier={}|effective={scaled:.3}ms|regime=CI",
            budget::CI_RUNNER_MULTIPLIER
        );
        scaled
    } else {
        println!("BUDGET-CALIB|{name}|base={base_budget_ms:.3}ms|regime=LOCAL");
        base_budget_ms
    }
}

mod common;

use common::{create_epub, seed_books, synthetic_pdf_bytes};
use luma_core::ids::DeviceId;
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_reader::PdfDocument;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::repos::{
    BookFileRepository, BookRepository, LibraryFilterOptions, LibrarySortOptions,
};
use luma_storage::services::{ReaderService, SearchService};
use std::time::Instant;

/// p50/p95 from a sorted sample list (nearest-rank).
fn percentiles(mut samples_ms: Vec<f64>) -> (f64, f64) {
    samples_ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p = |q: f64| -> f64 {
        let idx = ((q * (samples_ms.len() as f64 - 1.0)).round()) as usize;
        samples_ms[idx]
    };
    (p(0.50), p(0.95))
}

fn report(name: &str, samples_ms: &[f64]) {
    let (p50, p95) = percentiles(samples_ms.to_vec());
    let min = samples_ms.iter().cloned().fold(f64::INFINITY, f64::min);
    let max = samples_ms.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let mean = samples_ms.iter().sum::<f64>() / samples_ms.len() as f64;
    println!(
        "PERF-STAT|{name}|n={}|p50={p50:.3}ms|p95={p95:.3}ms|min={min:.3}ms|max={max:.3}ms|mean={mean:.3}ms",
        samples_ms.len()
    );
}

/// Regression guard: fail the tier when measured p95 exceeds the recorded budget.
fn assert_budget(name: &str, p95_ms: f64, budget_ms: f64) {
    println!(
        "BUDGET-GUARD|{name}|p95={p95_ms:.3}ms|budget={budget_ms:.3}ms|{}",
        if p95_ms <= budget_ms { "OK" } else { "FAIL" }
    );
    assert!(
        p95_ms <= budget_ms,
        "PERFORMANCE REGRESSION: {name} p95 {p95_ms:.3}ms exceeds recorded budget {budget_ms:.3}ms"
    );
}

#[tokio::test]
async fn test_multi_run_hot_paths_with_percentiles() {
    // --- Startup (context + db + services), 30 runs, fresh in-memory DB each run.
    // n=30 (not 10): on shared CI runners a single OS scheduler stall can be 5-10x
    // the median; at n=10 the nearest-rank p95 IS the 2nd-largest sample, so one
    // such stall fails the guard (observed: 82.0ms outlier vs 8-18ms median).
    // At n=30 the p95 is still the 2nd-largest sample but a lone stall no longer
    // occupies that slot, while a systematic slowdown still shifts the whole tail.
    let mut startup = Vec::new();
    for _ in 0..30 {
        let start = Instant::now();
        let db = Database::open_in_memory().expect("db");
        let cache = CacheManager::new();
        let bus = EventBus::default();
        let _search = SearchService::new(db.clone(), bus.clone(), cache.clone());
        let _reader = ReaderService::new(db, cache);
        startup.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("startup_context_init", &startup);
    assert_budget(
        "startup_context_init",
        percentiles(startup).1,
        effective_budget("startup_context_init", budget::STARTUP_P95_MS),
    );

    // --- Library pagination @1k books: fresh DB, then 10 sample runs of a
    //     20-page walk (1,000 books fetched per sample)
    let db = Database::open_in_memory().expect("db");
    seed_books(&db, 1_000);
    let book_repo = BookRepository::new(db.clone());
    let filter = LibraryFilterOptions::default();
    let sort = LibrarySortOptions::default();

    // Warm-up walk (not counted)
    for page in 0..20 {
        let _ = book_repo.list(&filter, &sort, page, 50).expect("warmup");
    }

    let mut paginate = Vec::new();
    for _ in 0..10 {
        let start = Instant::now();
        for page in 0..20 {
            let results = book_repo.list(&filter, &sort, page, 50).expect("list");
            assert_eq!(results.len(), 50);
            assert!(!results[0].author_ids.is_empty());
        }
        paginate.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("library_pagination_1k_20pages", &paginate);
    assert_budget(
        "library_pagination_1k_20pages",
        percentiles(paginate).1,
        effective_budget(
            "library_pagination_1k_20pages",
            budget::PAGINATION_1K_WALK_P95_MS,
        ),
    );

    // --- FTS5 search: 50 query samples over a populated index
    let cache = CacheManager::new();
    let bus = EventBus::default();
    let search_service = SearchService::new(db.clone(), bus, cache);
    search_service.rebuild_index().await.expect("rebuild");
    let mut search = Vec::new();
    for _ in 0..50 {
        let start = Instant::now();
        let res = search_service
            .search_library("Validation Book", None, 50)
            .await
            .expect("search");
        assert!(!res.hits.is_empty());
        search.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("fts5_search_1k_books", &search);
    assert_budget(
        "fts5_search_1k_books",
        percentiles(search).1,
        effective_budget("fts5_search_1k_books", budget::FTS5_SEARCH_P95_MS),
    );

    // --- PDF cold open x 10 (fresh parse each run, 250-page synthetic doc)
    let pdf_bytes = synthetic_pdf_bytes(250);
    let tmp = tempfile::NamedTempFile::new().expect("tmp");
    std::fs::write(tmp.path(), &pdf_bytes).expect("write pdf");
    let mut pdf_open = Vec::new();
    for _ in 0..10 {
        let start = Instant::now();
        let doc = PdfDocument::open(tmp.path()).expect("open pdf");
        pdf_open.push(start.elapsed().as_secs_f64() * 1000.0);
        assert_eq!(doc.page_count(), 250);
    }
    report("pdf_cold_open_250p", &pdf_open);
    assert_budget(
        "pdf_cold_open_250p",
        percentiles(pdf_open).1,
        effective_budget("pdf_cold_open_250p", budget::PDF_COLD_OPEN_P95_MS),
    );

    // --- PDF sequential 20-page nav x 10 (fresh doc each sample to stay cold)
    let mut pdf_nav = Vec::new();
    for _ in 0..10 {
        let doc = PdfDocument::open(tmp.path()).expect("open pdf");
        let start = Instant::now();
        for p in 1..=20 {
            let page = doc.get_page(p).expect("page");
            assert_eq!(page.page_number, p);
        }
        pdf_nav.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("pdf_sequential_nav_20p", &pdf_nav);
    assert_budget(
        "pdf_sequential_nav_20p",
        percentiles(pdf_nav).1,
        effective_budget("pdf_sequential_nav_20p", budget::PDF_NAV_20P_P95_MS),
    );

    // --- 10k ingestion: 3 fresh-DB bulk-insert samples (expensive: not 10x)
    let mut ingest = Vec::new();
    for _ in 0..3 {
        let db_i = Database::open_in_memory().expect("db");
        ingest.push(seed_books(&db_i, 10_000));
    }
    report("bulk_ingest_10k", &ingest);
    assert_budget(
        "bulk_ingest_10k",
        percentiles(ingest).1,
        effective_budget("bulk_ingest_10k", budget::BULK_INGEST_10K_P95_MS),
    );

    // --- 10k pagination: one seeded DB, 20 samples of a 50-book page query
    let db_10k = Database::open_in_memory().expect("db");
    seed_books(&db_10k, 10_000);
    let repo_10k = BookRepository::new(db_10k.clone());
    // Warm-up
    for page in 0..10 {
        let _ = repo_10k.list(&filter, &sort, page, 50).expect("warmup");
    }
    let mut paginate10k = Vec::new();
    for i in 0..20 {
        let start = Instant::now();
        let results = repo_10k.list(&filter, &sort, i % 200, 50).expect("list");
        assert_eq!(results.len(), 50);
        paginate10k.push(start.elapsed().as_secs_f64() * 1000.0);
    }
    report("pagination_query_10k", &paginate10k);
    assert_budget(
        "pagination_query_10k",
        percentiles(paginate10k).1,
        effective_budget("pagination_query_10k", budget::PAGINATION_10K_QUERY_P95_MS),
    );
}

/// Create one book with a real EPUB file on disk, returning the BookId.
fn seed_book_with_epub(
    db: &Database,
    dir: &std::path::Path,
    chapters: usize,
) -> luma_core::ids::BookId {
    let book_repo = BookRepository::new(db.clone());
    let file_repo = BookFileRepository::new(db.clone());
    let device_id = DeviceId::new();

    let epub_path = dir.join("soak_book.epub");
    create_epub(&epub_path, "Soak Cycle Book", "Soak Author", chapters);
    let bytes = std::fs::metadata(&epub_path).expect("meta").len();

    let mut book = Book::new("Soak Cycle Book".to_string(), device_id);
    let file = BookFile::new(
        book.id,
        "soak_book.epub".to_string(),
        epub_path.to_string_lossy().to_string(),
        DocumentFormat::Epub,
        bytes,
        "soak-hash".to_string(),
    );
    book.primary_file_id = Some(file.id);
    book_repo.insert(&book).expect("insert book");
    file_repo.insert(&file).expect("insert file");
    book.id
}

// ============================================================================
// Tier 2: Soak — sustained open/close cycling, watch for degradation
// ============================================================================

#[tokio::test]
async fn test_soak_repeated_open_close_cycles() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let db = Database::open_in_memory().expect("db");
    let book_id = seed_book_with_epub(&db, temp_dir.path(), 12);
    let cache = CacheManager::new();
    let bus = EventBus::default();
    let reader_service = ReaderService::new(db.clone(), cache);
    let _search = SearchService::new(db.clone(), bus, CacheManager::new());

    // Warm-up: prime the session cache so sample 1 isn't a cold outlier.
    let _ = reader_service
        .open_document(&book_id, None)
        .await
        .expect("warmup open");

    // 200 open/close cycles.
    let mut cycle_durations_ms: Vec<f64> = Vec::with_capacity(200);
    for i in 0..200 {
        let start = Instant::now();
        let doc = reader_service
            .open_document(&book_id, None)
            .await
            .expect("open");
        let dur = start.elapsed().as_secs_f64() * 1000.0;
        assert!(doc.total_pages_or_spines > 0);
        if i % 50 == 0 {
            // Exercise a chapter fetch too, simulating page-turn traffic.
            let ch = reader_service
                .get_chapter(&book_id, i % 12)
                .await
                .expect("chapter");
            assert!(!ch.html_content.is_empty());
        }
        cycle_durations_ms.push(dur);
    }

    report("soak_open_close_200_cycles", &cycle_durations_ms);

    // Degradation guard: compare first-half vs second-half p50.
    let n = cycle_durations_ms.len();
    let (early_p50, _) = percentiles(cycle_durations_ms[..n / 2].to_vec());
    let (late_p50, _) = percentiles(cycle_durations_ms[n / 2..].to_vec());
    println!("SOAK-DEGRADATION|early_p50={early_p50:.3}ms|late_p50={late_p50:.3}ms");
    // Allow bounded drift (2x); a leak would show as monotonic growth.
    assert!(
        late_p50 < early_p50 * 2.0 + 1.0,
        "soak shows degradation: early p50 {early_p50:.3}ms vs late p50 {late_p50:.3}ms"
    );
}

// ============================================================================
// Tier 3: Spike — sudden demand burst + recovery measurement
// ============================================================================

#[tokio::test]
async fn test_spike_burst_and_recovery() {
    let db = Database::open_in_memory().expect("db");
    seed_books(&db, 1_000);
    let book_repo = BookRepository::new(db.clone());
    let filter = LibraryFilterOptions::default();
    let sort = LibrarySortOptions::default();

    // Baseline: single-page query latency.
    let base_start = Instant::now();
    let _ = book_repo.list(&filter, &sort, 0, 50).expect("baseline");
    let baseline_ms = base_start.elapsed().as_secs_f64() * 1000.0;

    // Spike: 200 rapid concurrent queries.
    let spike_start = Instant::now();
    let mut handles = Vec::new();
    for i in 0..200 {
        let db_c = db.clone();
        handles.push(tokio::task::spawn_blocking(move || {
            let repo = BookRepository::new(db_c);
            let f = LibraryFilterOptions::default();
            let s = LibrarySortOptions::default();
            repo.list(&f, &s, i % 20, 50).expect("spike query").len()
        }));
    }
    for h in handles {
        assert_eq!(h.await.expect("join"), 50);
    }
    let spike_duration_ms = spike_start.elapsed().as_secs_f64() * 1000.0;

    // Recovery: demand drops to a single query again.
    let rec_start = Instant::now();
    let _ = book_repo.list(&filter, &sort, 0, 50).expect("recovery");
    let recovery_ms = rec_start.elapsed().as_secs_f64() * 1000.0;

    println!(
        "SPIKE|baseline_ms={baseline_ms:.3}|burst_200q_ms={spike_duration_ms:.3}|recovery_ms={recovery_ms:.3}|recovery_vs_baseline={:.2}x",
        recovery_ms / baseline_ms.max(0.001)
    );
    // System must recover to near-baseline after the burst.
    assert!(
        recovery_ms < baseline_ms * 5.0 + 1.0,
        "recovery latency {recovery_ms:.3}ms did not return near baseline {baseline_ms:.3}ms"
    );
}

// ============================================================================
// Tier 4: Capacity ramp — find first budget breach and the limiting resource
// ============================================================================

#[tokio::test]
async fn test_capacity_ramp_to_first_breach() {
    // Ramp library size: 1k, 5k, 10k, 20k. Budget: page query p50 < 20 ms
    // (per PERF-02 budget). Named limiting resource at breach.
    let budget_ms = 20.0;
    let mut findings = Vec::new();
    for scale in [1_000usize, 5_000, 10_000, 20_000] {
        let db = Database::open_in_memory().expect("db");
        let seed_ms = seed_books(&db, scale);
        let repo = BookRepository::new(db.clone());
        let filter = LibraryFilterOptions::default();
        let sort = LibrarySortOptions::default();

        // Warm-up + 20 page-query samples.
        let _ = repo.list(&filter, &sort, 0, 50).expect("warmup");
        let mut samples = Vec::new();
        let max_page = (scale / 50) as i32 - 1;
        for i in 0..20 {
            let start = Instant::now();
            let results = repo
                .list(&filter, &sort, (i * 3 % max_page.max(1)) as usize, 50)
                .expect("list");
            assert_eq!(results.len(), 50);
            samples.push(start.elapsed().as_secs_f64() * 1000.0);
        }
        let (p50, p95) = percentiles(samples);
        let status = if p95 <= budget_ms { "OK" } else { "BREACH" };
        println!(
            "CAPACITY|scale={scale}|seed_ms={seed_ms:.1}|p50={p50:.3}ms|p95={p95:.3}ms|budget_p95=20ms|{status}"
        );
        findings.push((scale, p95, status));
    }

    // REGRESSION GUARD: the ramp must stay within budget at the recorded
    // operating capacity (20k books, per PERF-03 report §7). A real breach
    // fails the test.
    for (scale, p95, _) in &findings {
        assert_budget(
            &format!("capacity_ramp_scale_{scale}"),
            *p95,
            effective_budget("capacity_ramp", budget::CAPACITY_RAMP_P95_MS),
        );
    }

    // Capacity finding must name the limiting resource once a breach occurs,
    // or confirm the ceiling was not reached.
    let breached = findings.iter().find(|(_, _, s)| *s == "BREACH");
    match breached {
        Some((scale, p95, _)) => {
            println!(
                "CAPACITY-LIMIT|first_breach_scale={scale}|p95={p95:.3}ms|limiting_resource=SQLite_BTree_index_scan_CPU (in-memory db: no disk I/O or lock contention)"
            );
        }
        None => {
            println!(
                "CAPACITY-LIMIT|no_breach_up_to_20k_books|limiting_resource=NOT_REACHED (all p95 within 20 ms budget)"
            );
        }
    }
}
