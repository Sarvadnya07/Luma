use anyhow::{Context, Result};
use luma_core::ids::DeviceId;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::{BookRepository, JobRepository, LibraryFilterOptions, LibrarySortOptions};
use luma_storage::services::{ImportService, ReaderService, ReadingProgressService, SearchService};
use serde_json::json;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use zip::write::{SimpleFileOptions, ZipWriter};

// ============================================================================
// Configuration
// ============================================================================

#[derive(Debug, Clone)]
pub struct BenchmarkConfig {
    pub num_books: usize,
    pub num_chapters_per_book: usize,
    pub title_prefix: String,
    pub author_prefix: String,
    pub search_query: String,
    pub max_search_results: usize,
    pub page_size: usize,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            num_books: 10,
            num_chapters_per_book: 12,
            title_prefix: "Masterpiece Novel Volume".to_string(),
            author_prefix: "Author Surname".to_string(),
            search_query: "Novel Volume".to_string(),
            max_search_results: 50,
            page_size: 50,
        }
    }
}

// ============================================================================
// EPUB Generator
// ============================================================================

fn create_epub(dest_path: &Path, title: &str, author: &str, num_chapters: usize) -> Result<()> {
    let file = File::create(dest_path).context("Failed to open file for EPUB creation")?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let raw_options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("mimetype", raw_options)?;
    zip.write_all(b"application/epub+zip")?;

    zip.start_file("META-INF/container.xml", options)?;
    zip.write_all(
        br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
    )?;

    zip.start_file("EPUB/package.opf", options)?;
    let mut manifest = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{}</dc:title>
    <dc:creator>{}</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
"#,
        title, author
    );

    let mut spine = String::from("  <spine>\n");
    for i in 0..num_chapters {
        manifest.push_str(&format!(
            r#"    <item id="ch{}" href="ch{}.xhtml" media-type="application/xhtml+xml"/>"#,
            i, i
        ));
        manifest.push('\n');
        spine.push_str(&format!(r#"    <itemref idref="ch{}"/>"#, i));
        spine.push('\n');
    }
    manifest.push_str("  </manifest>\n");
    spine.push_str("  </spine>\n</package>");
    zip.write_all(format!("{}{}", manifest, spine).as_bytes())?;

    for i in 0..num_chapters {
        zip.start_file(format!("EPUB/ch{}.xhtml", i), options)?;
        zip.write_all(
            format!(
                r#"<!DOCTYPE html><html><body><h1>Chapter {}</h1><p>Realistic body paragraph with Novel Volume text for search indexing and reading evaluation.</p></body></html>"#,
                i + 1
            )
            .as_bytes(),
        )?;
    }

    zip.finish()?;
    Ok(())
}

fn generate_epub_files(dir: &Path, config: &BenchmarkConfig) -> Result<Vec<PathBuf>> {
    let mut files = Vec::with_capacity(config.num_books);
    for i in 0..config.num_books {
        let title = format!("{} {:02}", config.title_prefix, i);
        let author = format!("{} {:02}", config.author_prefix, i % 3);
        let file_path = dir.join(format!("book_{:02}.epub", i));
        create_epub(&file_path, &title, &author, config.num_chapters_per_book)
            .with_context(|| format!("Failed to create EPUB for '{}'", title))?;
        files.push(file_path);
    }
    Ok(files)
}

// ============================================================================
// Benchmark Result
// ============================================================================

#[derive(Debug, Clone)]
pub struct BenchmarkResult {
    pub import_duration: Duration,
    pub open_duration: Duration,
    pub chapter_duration: Duration,
    pub search_duration: Duration,
    pub progress_duration: Duration,
    pub num_books: usize,
    pub num_chapters: usize,
}

impl BenchmarkResult {
    pub fn to_json(&self) -> serde_json::Value {
        json!({
            "import_duration_ms": self.import_duration.as_millis(),
            "open_duration_ms": self.open_duration.as_millis(),
            "chapter_duration_ms": self.chapter_duration.as_millis(),
            "search_duration_ms": self.search_duration.as_millis(),
            "progress_duration_ms": self.progress_duration.as_millis(),
            "num_books": self.num_books,
            "num_chapters": self.num_chapters,
            "import_duration_sec": self.import_duration.as_secs_f64(),
            "open_duration_sec": self.open_duration.as_secs_f64(),
            "chapter_duration_sec": self.chapter_duration.as_secs_f64(),
            "search_duration_sec": self.search_duration.as_secs_f64(),
            "progress_duration_sec": self.progress_duration.as_secs_f64(),
        })
    }
}

// ============================================================================
// Main Test
// ============================================================================

#[tokio::test]
async fn test_benchmark_end_to_end_real_import_pipeline() -> Result<()> {
    let _ = env_logger::builder().is_test(true).try_init();

    let config = BenchmarkConfig::default();
    let temp_dir = tempfile::tempdir().context("Failed to create temp dir")?;
    let data_path = temp_dir.path().to_path_buf();
    let fixtures_dir = data_path.join("fixtures");
    std::fs::create_dir_all(&fixtures_dir)?;

    let db = Database::open(data_path.join("luma_bench.db")).context("Failed to open database")?;
    let event_bus = EventBus::default();
    let file_service = FileService::new(&data_path);
    let cache = CacheManager::new();
    let job_repo = JobRepository::new(db.clone());
    let job_manager = JobManager::new(job_repo, event_bus.clone());

    let search_service = SearchService::new(db.clone(), event_bus.clone(), cache.clone());
    let import_service = ImportService::new(
        db.clone(),
        file_service.clone(),
        event_bus.clone(),
        job_manager.clone(),
        cache.clone(),
    );

    let reader_service = ReaderService::new(db.clone(), cache.clone());
    let progress_service = ReadingProgressService::new(db.clone(), event_bus.clone());

    // Generate EPUB files
    let file_paths = generate_epub_files(&fixtures_dir, &config)?;
    let device_id = DeviceId::new();

    // 1. Import
    let import_start = Instant::now();
    let import_job = import_service
        .import_files(&file_paths, device_id)
        .await
        .context("Import failed")?;
    let import_duration = import_start.elapsed();

    eprintln!(
        "Real E2E Import Pipeline ({} EPUBs with {} chapters each): {:?}",
        config.num_books, config.num_chapters_per_book, import_duration
    );
    assert_eq!(import_job.total_files as usize, config.num_books);
    assert_eq!(import_job.completed_count as usize, config.num_books);

    // 2. List books
    let book_repo = BookRepository::new(db.clone());
    let all_books = book_repo
        .list(
            &LibraryFilterOptions::default(),
            &LibrarySortOptions::default(),
            0,
            config.page_size,
        )
        .context("Failed to list books")?;
    assert_eq!(
        all_books.len(),
        config.num_books,
        "Expected {} books, got {}",
        config.num_books,
        all_books.len()
    );

    let first_book_id = all_books[0].id;

    // 3. Open document
    let open_start = Instant::now();
    let doc_data = reader_service
        .open_document(&first_book_id, None)
        .await
        .context("Failed to open document")?;
    let open_duration = open_start.elapsed();
    eprintln!("Real Backend Open Document Pipeline (Consolidated Payload): {:?}", open_duration);
    assert_eq!(
        doc_data.total_pages_or_spines,
        config.num_chapters_per_book as u32,
        "Expected {} pages/spines, got {}",
        config.num_chapters_per_book,
        doc_data.total_pages_or_spines
    );

    // 4. Retrieve chapter
    let chapter_start = Instant::now();
    let ch0 = reader_service
        .get_chapter(&first_book_id, 0)
        .await
        .context("Failed to get chapter 0")?;
    let chapter_duration = chapter_start.elapsed();
    eprintln!("Real Chapter 0 Retrieval (Session cached): {:?}", chapter_duration);
    assert!(
        ch0.html_content.contains("Chapter 1"),
        "Chapter content missing expected text"
    );

    // 5. Search
    search_service
        .rebuild_index()
        .await
        .context("Failed to rebuild search index")?;
    let search_start = Instant::now();
    let search_res = search_service
        .search_library(&config.search_query, None, config.max_search_results)
        .await
        .context("Search failed")?;
    let search_duration = search_start.elapsed();
    eprintln!(
        "Real FTS5 Search Query Duration ({} books): {:?}",
        config.num_books, search_duration
    );
    assert!(!search_res.hits.is_empty(), "Search returned no results");

    // 6. Save reading progress
    let mut progress = luma_core::models::reading::ReadingProgress::new(
        first_book_id,
        "epubcfi(/6/4[ch0]!/4/2/1:0)".to_string(),
        device_id,
    );
    progress.progress_percentage = 0.25;
    progress.current_chapter_title = Some("Chapter 1".to_string());
    progress.current_page_number = Some(1);
    progress.total_pages = Some(config.num_chapters_per_book as u32);

    let progress_start = Instant::now();
    progress_service
        .save_progress(&progress)
        .context("Failed to save progress")?;
    let progress_duration = progress_start.elapsed();
    eprintln!(
        "Reading Progress SQLite Transaction Duration: {:?}",
        progress_duration
    );

    // 7. Output results
    let result = BenchmarkResult {
        import_duration,
        open_duration,
        chapter_duration,
        search_duration,
        progress_duration,
        num_books: config.num_books,
        num_chapters: config.num_chapters_per_book,
    };

    println!("{}", serde_json::to_string_pretty(&result.to_json())?);
    Ok(())
}