pub mod db;
pub mod error;
pub mod migrations;
pub mod repos;

pub use db::Database;
pub use error::{StorageError, StorageResult};
pub use migrations::run_migrations;
pub use repos::*;

#[cfg(test)]
mod tests {
    use super::*;
    use luma_core::ids::{BookId, DeviceId};
    use luma_core::models::annotation::{Annotation, AnnotationType};
    use luma_core::models::book::Book;
    use luma_core::models::reading::ReadingProgress;
    use std::time::Instant;

    #[test]
    fn test_in_memory_database_crud() {
        let db = Database::open_in_memory().expect("in-memory db should open");
        let book_repo = BookRepository::new(db.clone());
        let ann_repo = AnnotationRepository::new(db.clone());
        let read_repo = ReadingProgressRepository::new(db.clone());

        let device_id = DeviceId::new();
        let book = Book::new("Designing Data-Intensive Applications", device_id);
        let book_id = book.id;

        // Insert book
        book_repo.insert(&book).expect("insert should succeed");

        // Retrieve book
        let retrieved = book_repo.get_by_id(&book_id).expect("get should succeed");
        assert!(retrieved.is_some());
        let retrieved_book = retrieved.unwrap();
        assert_eq!(retrieved_book.title, "Designing Data-Intensive Applications");

        // Insert annotation
        let ann = Annotation::new(
            book_id,
            AnnotationType::Highlight,
            "#FFEB3B",
            "Reliability means making systems work correctly",
            r#"{"exact":"Reliability means making systems work correctly"}"#,
            device_id,
        );
        ann_repo.insert(&ann).expect("insert annotation should succeed");

        let annotations = ann_repo.list_by_book(&book_id).expect("list annotations should succeed");
        assert_eq!(annotations.len(), 1);
        assert_eq!(annotations[0].quote, "Reliability means making systems work correctly");

        // Save reading progress
        let mut progress = ReadingProgress::new(book_id, "epubcfi(/6/4!/4/2/1:0)", device_id);
        progress.progress_percentage = 42.5;
        read_repo.save(&progress).expect("save progress should succeed");

        let loaded_progress = read_repo.get(&book_id).expect("get progress should succeed").unwrap();
        assert_eq!(loaded_progress.progress_percentage, 42.5);
    }

    #[test]
    fn test_storage_benchmarks() {
        let db = Database::open_in_memory().expect("in-memory db open");
        let book_repo = BookRepository::new(db.clone());
        let device_id = DeviceId::new();

        for count in [100, 1_000, 10_000] {
            let start = Instant::now();
            db.with_conn(|conn| {
                let tx = conn.transaction()?;
                for i in 0..count {
                    let book = Book::new(format!("Benchmark Book {}", i), device_id);
                    tx.execute(
                        "INSERT INTO books (id, title, version, created_at, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![
                            book.id.to_string(),
                            book.title,
                            book.sync.version.0 as i64,
                            book.sync.created_at.to_rfc3339(),
                            book.sync.updated_at.to_rfc3339(),
                            book.sync.device_id.to_string(),
                            0
                        ],
                    )?;
                }
                tx.commit()?;
                Ok(())
            }).expect("batch insert should succeed");
            let insert_duration = start.elapsed();

            let query_start = Instant::now();
            let all = book_repo.list_all().expect("list all should succeed");
            let query_duration = query_start.elapsed();

            println!(
                "SQLite Benchmark [{count} books]: insert in {:.2}ms, query all in {:.2}ms (count: {})",
                insert_duration.as_secs_f64() * 1000.0,
                query_duration.as_secs_f64() * 1000.0,
                all.len(),
            );
        }
    }
}
