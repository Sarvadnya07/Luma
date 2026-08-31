pub mod db;
pub mod duplicate;
pub mod error;
pub mod migrations;
pub mod repos;
pub mod service;

pub use db::Database;
pub use duplicate::DuplicateDetector;
pub use error::{StorageError, StorageResult};
pub use migrations::run_migrations;
pub use repos::*;
pub use service::LibraryService;

#[cfg(test)]
mod tests {
    use super::*;
    use luma_core::ids::DeviceId;
    use luma_core::models::book::Book;

    #[test]
    fn test_database_initialization_and_migrations() {
        let db = Database::open_in_memory().expect("in-memory database should initialize");
        let book_repo = BookRepository::new(db.clone());

        let dev_id = DeviceId::new();
        let book = Book::new("The Rust Programming Language", dev_id);
        book_repo.insert(&book).expect("insert should succeed");

        let fetched = book_repo.get_by_id(&book.id).expect("query should succeed");
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().title, "The Rust Programming Language");
    }

    #[test]
    fn test_duplicate_detector() {
        let db = Database::open_in_memory().expect("in-memory database should initialize");
        let detector = DuplicateDetector::new(db.clone());

        let assessment = detector
            .assess(
                "abc123hash",
                Some("978-0131103627"),
                "The C Programming Language",
                Some("Kernighan"),
            )
            .expect("assessment should succeed");
        assert_eq!(
            assessment.level,
            luma_core::models::ingest::DuplicateMatchLevel::Unrelated
        );
    }
}
