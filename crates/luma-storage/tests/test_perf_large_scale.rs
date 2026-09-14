mod common;

use common::{insert_book, synthetic_pdf_bytes};
use luma_core::ids::DeviceId;
use luma_core::models::book::{Book, ReadingStatus};
use luma_reader::PdfDocument;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::repos::{
    AuthorRepository, BookRepository, LibraryFilterOptions, LibrarySortOptions,
};
use luma_storage::services::{ReaderService, SearchService};
use std::time::Instant;

fn create_synthetic_pdf_file(num_pages: usize) -> tempfile::NamedTempFile {
    let temp_file = tempfile::NamedTempFile::new().expect("temp file");
    std::fs::write(temp_file.path(), synthetic_pdf_bytes(num_pages)).expect("write pdf");
    temp_file
}

#[tokio::test]
async fn test_benchmark_pdf_random_access_and_caching() {
    let pdf_file = create_synthetic_pdf_file(250);
    let path = pdf_file.path();

    // 1. Cold Open & First Page Measurement
    let open_start = Instant::now();
    let doc = PdfDocument::open(path).expect("open pdf");
    let open_duration = open_start.elapsed();
    println!("PDF (250 pages) Cold Open Duration: {:?}", open_duration);
    assert_eq!(doc.page_count(), 250);

    // 2. Sequential Navigation (Page 1 -> 20)
    let seq_start = Instant::now();
    for p in 1..=20 {
        let page = doc.get_page(p).expect("get page");
        assert_eq!(page.page_number, p);
    }
    let seq_duration = seq_start.elapsed();
    println!(
        "PDF 20 Sequential Page Navigation (Cold extraction): {:?}",
        seq_duration
    );

    // 3. Page Cache Hit Navigation (Page 1 -> 20 revisited)
    let cache_start = Instant::now();
    for p in 1..=20 {
        let page = doc.get_page(p).expect("get page");
        assert_eq!(page.page_number, p);
    }
    let cache_duration = cache_start.elapsed();
    println!("PDF 20 Page Cache Hit Navigation: {:?}", cache_duration);
    assert!(cache_duration < seq_duration);

    // 4. Random Access (Pages 1, 10, 50, 100, 200, 250)
    let random_targets = [1, 10, 50, 100, 200, 250];
    let rand_start = Instant::now();
    for &p in &random_targets {
        let page = doc.get_page(p).expect("random page");
        assert_eq!(page.page_number, p);
    }
    let rand_duration = rand_start.elapsed();
    println!("PDF 6 Random Access Page Jumps: {:?}", rand_duration);
}

#[tokio::test]
async fn test_benchmark_large_scale_10k_library() {
    let db = Database::open_in_memory().expect("in-memory db");
    let book_repo = BookRepository::new(db.clone());
    let author_repo = AuthorRepository::new(db.clone());
    let device_id = DeviceId::new();

    // Create 50 authors
    let mut author_ids = Vec::new();
    for i in 0..50 {
        let auth = author_repo
            .get_or_create_by_name(&format!("Author {:03}", i), device_id)
            .expect("author");
        author_ids.push(auth.id);
    }

    // Insert 10,000 books in transactions
    let insert_start = Instant::now();
    db.with_write_conn(|conn| {
        let tx = conn.transaction()?;
        for i in 0..10_000 {
            let mut b = Book::new(format!("Scale Test Book {:05}", i), device_id);
            b.author_ids.push(author_ids[i % author_ids.len()]);
            if i % 3 == 0 {
                b.reading_status = ReadingStatus::Reading;
            } else if i % 5 == 0 {
                b.reading_status = ReadingStatus::Completed;
            }
            insert_book(&tx, &b);
        }
        tx.commit()?;
        Ok(())
    })
    .expect("bulk insert");

    let insert_duration = insert_start.elapsed();
    println!("10,000 Books Bulk Ingestion Time: {:?}", insert_duration);

    // 1. Benchmark Paginated Library List (100 pages of 50 items = 5,000 items)
    let filter = LibraryFilterOptions::default();
    let sort = LibrarySortOptions::default();

    let list_start = Instant::now();
    for page in 0..100 {
        let results = book_repo.list(&filter, &sort, page, 50).expect("list");
        assert_eq!(results.len(), 50);
        assert!(!results[0].author_ids.is_empty());
    }
    let list_duration = list_start.elapsed();
    println!(
        "100 Paginated List Queries (5,000 books fetched total from 10k db): {:?}",
        list_duration
    );

    // 2. Filtered Query (reading_status = Reading)
    let reading_filter = LibraryFilterOptions {
        reading_status: Some(ReadingStatus::Reading),
        ..Default::default()
    };

    let filter_start = Instant::now();
    for page in 0..20 {
        let results = book_repo
            .list(&reading_filter, &sort, page, 50)
            .expect("filter list");
        assert_eq!(results.len(), 50);
    }
    let filter_duration = filter_start.elapsed();
    println!(
        "20 Filtered List Queries (reading_status = Reading): {:?}",
        filter_duration
    );
}

#[tokio::test]
async fn test_benchmark_startup_and_initialization() {
    let start = Instant::now();
    let db = Database::open_in_memory().expect("db open");
    let cache = CacheManager::new();
    let event_bus = EventBus::default();
    let _search = SearchService::new(db.clone(), event_bus.clone(), cache.clone());
    let _reader = ReaderService::new(db.clone(), cache.clone());
    let startup_duration = start.elapsed();

    println!(
        "Full App Context & Database Startup Duration: {:?}",
        startup_duration
    );
    assert!(startup_duration.as_millis() < 500);
}
