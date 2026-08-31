use luma_core::error::LumaError;
use luma_core::ids::{AnnotationId, BookId, BookmarkId, DeviceId, FileId};
use luma_core::models::book::{
    Book, BookFile, DocumentFormat, FileAvailability, LibraryState, ReadingStatus,
};
use luma_core::version::{EntityVersion, SyncMetadata};

#[test]
fn test_typed_ids_format_prefix_invariance() {
    let book_id = BookId::new();
    let file_id = FileId::new();
    let ann_id = AnnotationId::new();
    let bmk_id = BookmarkId::new();
    let dev_id = DeviceId::new();

    assert!(book_id.to_string().starts_with("book_"));
    assert!(file_id.to_string().starts_with("file_"));
    assert!(ann_id.to_string().starts_with("ann_"));
    assert!(bmk_id.to_string().starts_with("bmk_"));
    assert!(dev_id.to_string().starts_with("dev_"));

    // Round-trip parsing
    let parsed_book: BookId = book_id.to_string().parse().expect("parse book id");
    assert_eq!(book_id, parsed_book);
}

#[test]
fn test_sync_metadata_causality_and_version_progression() {
    let dev_id = DeviceId::new();
    let mut meta = SyncMetadata::new(dev_id);

    assert_eq!(meta.version, EntityVersion(1));
    assert!(!meta.is_deleted);
    assert!(meta.deleted_at.is_none());

    meta.mark_updated(dev_id);
    assert_eq!(meta.version, EntityVersion(2));
    assert!(meta.updated_at >= meta.created_at);

    meta.mark_deleted(dev_id);
    assert!(meta.is_deleted);
    assert!(meta.deleted_at.is_some());
    assert_eq!(meta.version, EntityVersion(3));
}

#[test]
fn test_error_type_encapsulation_does_not_leak_raw_system_types() {
    let not_found = LumaError::NotFound {
        entity_type: "Book".to_string(),
        id: "book_123".to_string(),
    };
    assert_eq!(
        not_found.to_string(),
        "Entity not found: Book with ID book_123"
    );

    let validation = LumaError::ValidationError("Invalid ISBN".to_string());
    assert_eq!(validation.to_string(), "Validation error: Invalid ISBN");

    let security = LumaError::SecurityError("Path traversal attempt".to_string());
    assert_eq!(
        security.to_string(),
        "Security violation: Path traversal attempt"
    );
}

#[test]
fn test_book_and_book_file_model_contract_decoupling() {
    let dev_id = DeviceId::new();
    let book = Book::new("Clean Architecture", dev_id);
    let book_file = BookFile::new(
        book.id,
        "clean_architecture.epub",
        "library/clean_architecture.epub",
        DocumentFormat::Epub,
        2048576,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );

    assert_eq!(book_file.book_id, book.id);
    assert_eq!(book_file.availability, FileAvailability::Available);
    assert_eq!(book.reading_status, ReadingStatus::Unread);
    assert_eq!(book.library_state, LibraryState::Active);
}
