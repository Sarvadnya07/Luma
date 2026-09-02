use luma_core::error::LumaError;
use luma_core::ids::{AnnotationId, BookId, BookmarkId, DeviceId, FileId};
use luma_core::models::book::{
    Book, BookFile, DocumentFormat, FileAvailability, LibraryState, ReadingStatus,
};
use luma_core::version::{EntityVersion, SyncMetadata};

// ============================================================================
// Constants – test‑specific messages and expected values
// ============================================================================

const BOOK_PREFIX: &str = "book_";
const FILE_PREFIX: &str = "file_";
const ANN_PREFIX: &str = "ann_";
const BMK_PREFIX: &str = "bmk_";
const DEV_PREFIX: &str = "dev_";

const INITIAL_VERSION_NUMBER: u64 = 1;
const UPDATED_VERSION_NUMBER: u64 = 2;
const DELETED_VERSION_NUMBER: u64 = 3;

const ENTITY_TYPE_BOOK: &str = "Book";
const ID_EXAMPLE: &str = "book_123";
const VALIDATION_ERROR_MSG: &str = "Invalid ISBN";
const SECURITY_ERROR_MSG: &str = "Path traversal attempt";

const BOOK_TITLE: &str = "Clean Architecture";
const FILENAME: &str = "clean_architecture.epub";
const RELATIVE_PATH: &str = "library/clean_architecture.epub";
const SHA256_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const FILE_SIZE_BYTES: u64 = 2048576;

// ============================================================================
// Helper functions
// ============================================================================

/// Asserts that the display representation of an ID starts with the expected prefix.
fn assert_id_prefix<Id: std::fmt::Display>(id: Id, expected_prefix: &str) {
    let as_string = id.to_string();
    assert!(
        as_string.starts_with(expected_prefix),
        "ID '{}' does not start with '{}'",
        as_string,
        expected_prefix
    );
}

// ============================================================================
// Tests
// ============================================================================

/// Tests that typed IDs have the correct prefix and are round‑trip parsable.
#[test]
fn test_typed_ids_format_prefix_invariance() {
    let book_id = BookId::new();
    let file_id = FileId::new();
    let ann_id = AnnotationId::new();
    let bmk_id = BookmarkId::new();
    let dev_id = DeviceId::new();

    assert_id_prefix(book_id, BOOK_PREFIX);
    assert_id_prefix(file_id, FILE_PREFIX);
    assert_id_prefix(ann_id, ANN_PREFIX);
    assert_id_prefix(bmk_id, BMK_PREFIX);
    assert_id_prefix(dev_id, DEV_PREFIX);

    // Round-trip parsing
    let parsed_book: BookId = book_id.to_string().parse().expect("parse book id");
    assert_eq!(book_id, parsed_book);
}

/// Tests the versioning and deletion semantics of `SyncMetadata`.
#[test]
fn test_sync_metadata_causality_and_version_progression() {
    let dev_id = DeviceId::new();
    let mut meta = SyncMetadata::new(dev_id);

    assert_eq!(meta.version, EntityVersion(INITIAL_VERSION_NUMBER));
    assert!(!meta.is_deleted);
    assert!(meta.deleted_at.is_none());

    meta.mark_updated(dev_id);
    assert_eq!(meta.version, EntityVersion(UPDATED_VERSION_NUMBER));
    assert!(meta.updated_at >= meta.created_at);

    meta.mark_deleted(dev_id);
    assert!(meta.is_deleted);
    assert!(meta.deleted_at.is_some());
    assert_eq!(meta.version, EntityVersion(DELETED_VERSION_NUMBER));
}

/// Verifies that `LumaError` variants render correctly and do not expose internal system details.
#[test]
fn test_error_type_encapsulation_does_not_leak_raw_system_types() {
    let not_found = LumaError::NotFound {
        entity_type: ENTITY_TYPE_BOOK.to_string(),
        id: ID_EXAMPLE.to_string(),
    };
    let expected_not_found = format!(
        "Entity not found: {} with ID {}",
        ENTITY_TYPE_BOOK, ID_EXAMPLE
    );
    assert_eq!(not_found.to_string(), expected_not_found);

    let validation = LumaError::ValidationError(VALIDATION_ERROR_MSG.to_string());
    let expected_validation = format!("Validation error: {}", VALIDATION_ERROR_MSG);
    assert_eq!(validation.to_string(), expected_validation);

    let security = LumaError::SecurityError(SECURITY_ERROR_MSG.to_string());
    let expected_security = format!("Security violation: {}", SECURITY_ERROR_MSG);
    assert_eq!(security.to_string(), expected_security);
}

/// Tests the creation and linking of `Book` and `BookFile` models.
#[test]
fn test_book_and_book_file_model_contract_decoupling() {
    let dev_id = DeviceId::new();
    let book = Book::new(BOOK_TITLE, dev_id);
    let book_file = BookFile::new(
        book.id,
        FILENAME,
        RELATIVE_PATH,
        DocumentFormat::Epub,
        FILE_SIZE_BYTES,
        SHA256_HASH,
    );

    assert_eq!(book_file.book_id, book.id);
    assert_eq!(book_file.availability, FileAvailability::Available);
    assert_eq!(book.reading_status, ReadingStatus::Unread);
    assert_eq!(book.library_state, LibraryState::Active);
}