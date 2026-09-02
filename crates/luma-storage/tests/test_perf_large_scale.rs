use luma_core::ids::DeviceId;
use luma_core::models::book::{Book, ReadingStatus};
use luma_reader::PdfDocument;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::repos::{AuthorRepository, BookRepository, LibraryFilterOptions, LibrarySortOptions};
use luma_storage::services::{ReaderService, SearchService};
use std::fs::File;
use std::io::Write;
use std::time::Instant;


fn create_synthetic_pdf(num_pages: usize) -> tempfile::NamedTempFile {
    let temp_file = tempfile::NamedTempFile::new().expect("temp file");
    let mut file = File::create(temp_file.path()).expect("create");

    let mut content = String::from("%PDF-1.7\n");
    for i in 1..=num_pages {
        content.push_str(&format!(
            "{} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n",
            i + 2
        ));
        content.push_str(&format!(
            "{} 0 obj\n<< /Length 60 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Page {} content with text payload) Tj\nET\nendstream\nendobj\n",
            i + 1000, i
        ));
    }
    content.push_str("2 0 obj\n<< /Type /Pages /Count ");
    content.push_str(&num_pages.to_string());
    content.push_str(" >>\nendobj\n%%EOF\n");

    file.write_all(content.as_bytes()).expect("write");
    temp_file
}

#[tokio::test]
async fn test_benchmark_pdf_random_access_and_caching() {
    let pdf_file = create_synthetic_pdf(250);
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
    println!("PDF 20 Sequential Page Navigation (Cold extraction): {:?}", seq_duration);

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

            let state_str = b.library_state.to_string();
            let status_str = b.reading_status.to_string();
            let created_str = b.sync.created_at.to_rfc3339();
            let updated_str = b.sync.updated_at.to_rfc3339();
            let dev_str = b.sync.device_id.to_string();

            tx.execute(
                r#"
                INSERT INTO books (
                    id, title, subtitle, series_id, series_index, description,
                    publisher, published_date, language, isbn, cover_image_path,
                    primary_file_id, reading_status, library_state, trashed_at,
                    version, created_at, updated_at, device_id, is_deleted
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
                "#,
                rusqlite::params![
                    b.id.to_string(),
                    b.title,
                    b.subtitle,
                    b.series_id.map(|s| s.to_string()),
                    b.series_index,
                    b.description,
                    b.publisher,
                    b.published_date,
                    b.language,
                    b.isbn,
                    b.cover_image_path,
                    b.primary_file_id.map(|f| f.to_string()),
                    status_str,
                    state_str,
                    b.trashed_at.map(|t| t.to_rfc3339()),
                    b.sync.version.0 as i64,
                    created_str,
                    updated_str,
                    dev_str,
                    0
                ],
            )?;

            tx.execute(
                "INSERT INTO book_authors (book_id, author_id, position) VALUES (?1, ?2, ?3)",
                rusqlite::params![b.id.to_string(), b.author_ids[0].to_string(), 0],
            )?;
        }
        tx.commit()?;
        Ok(())
    }).expect("bulk insert");

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
    println!("100 Paginated List Queries (5,000 books fetched total from 10k db): {:?}", list_duration);

    // 2. Filtered Query (reading_status = Reading)
    let reading_filter = LibraryFilterOptions {
        reading_status: Some(ReadingStatus::Reading),
        ..Default::default()
    };

    let filter_start = Instant::now();
    for page in 0..20 {
        let results = book_repo.list(&reading_filter, &sort, page, 50).expect("filter list");
        assert_eq!(results.len(), 50);
    }
    let filter_duration = filter_start.elapsed();
    println!("20 Filtered List Queries (reading_status = Reading): {:?}", filter_duration);
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

    println!("Full App Context & Database Startup Duration: {:?}", startup_duration);
    assert!(startup_duration.as_millis() < 500);
}
