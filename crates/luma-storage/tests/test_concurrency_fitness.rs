use std::sync::Arc;
use tempfile::tempdir;
use tokio::time::{sleep, Duration};

use luma_core::ids::DeviceId;
use luma_core::models::book::Book;
use luma_core::models::reading::ReadingProgress;
use luma_storage::db::Database;
use luma_storage::repos::{BookRepository, LibraryFilterOptions, ReadingProgressRepository};

#[tokio::test]
async fn test_concurrent_readers_during_long_write_transaction() {
    let temp = tempdir().expect("create temp dir");
    let db_path = temp.path().join("concurrency_test.db");

    let db = Database::open(&db_path).expect("open database");
    let book_repo = Arc::new(BookRepository::new(db.clone()));
    let progress_repo = Arc::new(ReadingProgressRepository::new(db.clone()));
    let device_id = DeviceId::new();

    // 1. Pre-populate with initial book
    let initial_book = Book::new("Concurrency Architecture in Rust", device_id);
    let book_id = initial_book.id;
    book_repo.insert(&initial_book).expect("insert initial");

    let mut initial_prog = ReadingProgress::new(book_id, "epubcfi(/6/2!/4/1:0)", device_id);
    initial_prog.progress_percentage = 0.25;
    initial_prog.current_chapter_title = Some("Chapter 1".to_string());
    initial_prog.current_page_number = Some(1);
    initial_prog.total_pages = Some(10);
    progress_repo
        .save(&initial_prog)
        .expect("save initial progress");

    // 2. Spawn a background task performing a simulated batch write transaction
    let db_clone = db.clone();
    let writer_handle = tokio::spawn(async move {
        db_clone
            .with_write_conn(|conn| {
                let tx = conn.transaction()?;
                // Insert 50 books inside a single transaction with a brief simulated processing sleep
                for i in 0..50 {
                    let b = Book::new(format!("Batch Book {}", i), device_id);
                    tx.execute(
                        "INSERT INTO books (id, title, version, created_at, updated_at, device_id, is_deleted, library_state, reading_status) VALUES (?1, ?2, 1, datetime('now'), datetime('now'), ?3, 0, 'active', 'unread')",
                        rusqlite::params![b.id.to_string(), b.title, device_id.to_string()],
                    )?;
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
                tx.commit()?;
                Ok(())
            })
            .expect("batch write should succeed");
    });

    // 3. Concurrently, multiple reader tasks read reading progress and book counts
    let mut reader_handles = Vec::new();
    for reader_idx in 0..10 {
        let b_repo = book_repo.clone();
        let p_repo = progress_repo.clone();
        let target_id = book_id;

        reader_handles.push(tokio::spawn(async move {
            for _ in 0..5 {
                // Read reading progress
                let prog = p_repo.get(&target_id).expect("read progress during write");
                assert!(
                    prog.is_some(),
                    "Progress must be readable by reader {}",
                    reader_idx
                );

                // Read book list
                let count = b_repo
                    .count(&LibraryFilterOptions::default())
                    .expect("count books during write");
                assert!(count >= 1, "Count must be at least 1");

                sleep(Duration::from_millis(5)).await;
            }
        }));
    }

    // Await all readers and writer
    writer_handle.await.expect("writer completed");
    for rh in reader_handles {
        rh.await.expect("reader completed without contention");
    }

    // Verify final state
    let final_count = book_repo
        .count(&LibraryFilterOptions::default())
        .expect("final count");
    assert_eq!(
        final_count, 51,
        "Initial book + 50 batch books = 51 total books"
    );
}

#[test]
fn test_query_only_enforced_on_read_connection() {
    let temp = tempdir().expect("create temp dir");
    let db_path = temp.path().join("read_only_test.db");
    let db = Database::open(&db_path).expect("open database");

    // Attempting a write query on the reader connection must fail safely due to PRAGMA query_only
    let write_attempt = db.with_read_conn(|conn| {
        let rows = conn.execute(
            "INSERT INTO settings (key, value_json, updated_at) VALUES ('forbidden', '{}', datetime('now'))",
            [],
        );
        match rows {
            Ok(n) => Ok(n),
            Err(e) => Err(luma_storage::StorageError::Sqlite(e)),
        }

    });

    assert!(
        write_attempt.is_err(),
        "Read connection must strictly reject write statements (PRAGMA query_only)"
    );
}
