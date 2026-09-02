use luma_core::ids::DeviceId;
use luma_core::models::annotation::{Annotation, AnnotationType};
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_security::{sanitize_relative_path, sanitize_untrusted_html, verify_archive_safety};
use luma_storage::db::Database;
use luma_storage::repos::{AnnotationRepository, BookFileRepository, BookRepository};
use std::path::PathBuf;
use std::sync::Arc;

#[test]
fn test_database_foreign_key_cascade_deletion() {
    let db = Database::open_in_memory().expect("in-memory db");
    let book_repo = BookRepository::new(db.clone());
    let file_repo = BookFileRepository::new(db.clone());
    let ann_repo = AnnotationRepository::new(db.clone());

    let device_id = DeviceId::new();
    let mut book = Book::new("Cascading Architecture", device_id);
    let book_id = book.id;

    let file = BookFile::new(
        book_id,
        "arch.epub".to_string(),
        "/path/arch.epub".to_string(),
        DocumentFormat::Epub,
        1024,
        "hash123".to_string(),
    );
    let file_id = file.id;
    book.primary_file_id = Some(file_id);

    let annotation = Annotation::new(
        book_id,
        AnnotationType::Highlight,
        "#FFDD00".to_string(),
        "Crucial insight".to_string(),
        "{}".to_string(),
        device_id,
    );

    book_repo.insert(&book).expect("insert book");
    file_repo.insert(&file).expect("insert file");
    ann_repo.insert(&annotation).expect("insert annotation");

    // Verify entities exist
    assert!(book_repo.get_by_id(&book_id).unwrap().is_some());
    assert!(file_repo.get_by_id(&file_id).unwrap().is_some());
    assert_eq!(ann_repo.list_by_book(&book_id).unwrap().len(), 1);

    // Delete parent book permanently
    book_repo.delete_permanently(&book_id).expect("delete book");

    // Verify ON DELETE CASCADE cleared book_files and annotations
    assert!(book_repo.get_by_id(&book_id).unwrap().is_none());
    assert!(file_repo.get_by_id(&file_id).unwrap().is_none());
    assert_eq!(ann_repo.list_by_book(&book_id).unwrap().len(), 0);
}

#[tokio::test]
async fn test_concurrent_reader_writer_stress_under_wal() {
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let db_path = temp_dir.path().join("wal_stress.db");
    let db = Database::open(&db_path).expect("open on-disk db");

    let device_id = DeviceId::new();
    let book_repo = BookRepository::new(db.clone());

    // Seed initial book
    let initial_book = Book::new("Base Book", device_id);
    let initial_id = initial_book.id;
    book_repo.insert(&initial_book).expect("insert base book");

    let db_arc = Arc::new(db);
    let mut reader_handles = Vec::new();

    // Spawn 10 concurrent reader tasks
    for _ in 0..10 {
        let db_clone = db_arc.clone();
        let target_id = initial_id;
        let handle = tokio::spawn(async move {
            let repo = BookRepository::new((*db_clone).clone());
            for _ in 0..50 {
                let res = repo.get_by_id(&target_id);
                assert!(res.is_ok());
                tokio::task::yield_now().await;
            }
        });
        reader_handles.push(handle);
    }

    // Spawn 5 concurrent writer tasks creating new books
    let mut writer_handles = Vec::new();
    for i in 0..5 {
        let db_clone = db_arc.clone();
        let dev = device_id;
        let handle = tokio::spawn(async move {
            let repo = BookRepository::new((*db_clone).clone());
            for j in 0..10 {
                let b = Book::new(format!("Concurrent Book {}-{}", i, j), dev);
                let _ = repo.insert(&b);
                tokio::task::yield_now().await;
            }
        });
        writer_handles.push(handle);
    }

    // Await all tasks
    for h in reader_handles {
        h.await.expect("reader task finished");
    }
    for h in writer_handles {
        h.await.expect("writer task finished");
    }

    // Final count check
    let final_repo = BookRepository::new((*db_arc).clone());
    let all = final_repo.list_all().expect("list all");
    assert!(all.len() >= 51);
}

#[test]
fn test_optimistic_concurrency_versioning() {
    let db = Database::open_in_memory().expect("in-memory db");
    let book_repo = BookRepository::new(db);
    let device_id = DeviceId::new();

    let mut book = Book::new("Versioned Knowledge", device_id);
    assert_eq!(book.sync.version.0, 1);

    book_repo.insert(&book).expect("insert");

    // Version progression on update
    book.title = "Updated Knowledge".to_string();
    book.sync.mark_updated(device_id);
    assert_eq!(book.sync.version.0, 2);
    book_repo.update(&book).expect("update");

    let fetched = book_repo.get_by_id(&book.id).unwrap().unwrap();
    assert_eq!(fetched.title, "Updated Knowledge");
    assert_eq!(fetched.sync.version.0, 2);
}

#[test]
fn test_security_bounds_and_defenses() {
    // 1. Path traversal detection
    let base = PathBuf::from("/safe/library");
    assert!(sanitize_relative_path(&base, "documents/book.epub").is_ok());
    assert!(sanitize_relative_path(&base, "../../etc/shadow").is_err());
    assert!(sanitize_relative_path(&base, "C:\\Windows\\System32").is_err());

    // 2. Zip bomb expansion limit
    assert!(verify_archive_safety(10_000_000, 20_000_000, 50).is_ok());
    assert!(verify_archive_safety(1_000, 200_000_000, 5).is_err()); // 200,000:1 ratio

    // 3. HTML Sanitization
    let xss_payload = "<p>Valid text</p><script>evil()</script><a href='javascript:steal()'>Link</a>";
    let cleaned = sanitize_untrusted_html(xss_payload);
    assert!(!cleaned.contains("<script"));
    assert!(!cleaned.contains("href='javascript:"));
    assert!(cleaned.contains("blocked-javascript:"));
    assert!(cleaned.contains("Valid text"));
}

