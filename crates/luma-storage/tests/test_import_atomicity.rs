//! Regression tests for BACKEND-02 remediation BE-001 (import atomicity).
//!
//! Previously the import's database writes (book → book_file → tags → FTS)
//! were independent autocommit statements, so a failure mid-sequence left a
//! partial state (book without file, file without book, stale FTS). The
//! persistence phase now runs in ONE transaction on the writer connection,
//! and the already-committed library file is removed as compensation when
//! the transaction fails.
//!
//! The failure is forced deterministically: a soft-deleted tag with name
//! "stoicism" exists (is_deleted = 1), so `get_or_create_by_name` misses it
//! in the SELECT (which filters `is_deleted = 0`) and the INSERT hits the
//! `tags.name UNIQUE` constraint — failing the transaction AFTER the book
//! and book_file inserts succeeded.

use std::fs::File;
use std::io::Write;
use tempfile::tempdir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use luma_core::ids::DeviceId;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::{BookRepository, JobRepository, TagRepository};
use luma_storage::services::ImportService;

fn create_epub_with_subjects(
    dest_path: &std::path::Path,
    title: &str,
    author: &str,
    subjects: &[&str],
) {
    let file = File::create(dest_path).expect("create file");
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("mimetype", options).unwrap();
    zip.write_all(b"application/epub+zip").unwrap();

    zip.start_file("META-INF/container.xml", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
    )
    .unwrap();

    let subjects_xml = subjects
        .iter()
        .map(|s| format!("<dc:subject>{}</dc:subject>", s))
        .collect::<Vec<_>>()
        .join("");
    let opf = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{}</dc:title>
    <dc:creator>{}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="pub-id">urn:uuid:12345678-1234-1234-1234-123456789abc</dc:identifier>
    {}
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml" />
  </manifest>
  <spine><itemref idref="ch1" /></spine>
</package>"#,
        title, author, subjects_xml
    );
    zip.start_file("EPUB/package.opf", options).unwrap();
    zip.write_all(opf.as_bytes()).unwrap();

    zip.start_file("EPUB/ch1.xhtml", options).unwrap();
    zip.write_all(b"<html><body><p>Chapter one content.</p></body></html>")
        .unwrap();

    zip.finish().unwrap();
}

fn build_import_service(dir: &std::path::Path) -> (ImportService, FileService, Database) {
    let db = Database::open(dir.join("luma.db")).expect("db");
    let event_bus = EventBus::default();
    let file_service = FileService::new(dir);
    let job_manager = JobManager::new(JobRepository::new(db.clone()), event_bus.clone());
    let import_service = ImportService::new(
        db.clone(),
        file_service.clone(),
        event_bus,
        job_manager,
        CacheManager::new(),
    );
    (import_service, file_service, db)
}

#[tokio::test]
async fn import_failure_rolls_back_all_database_writes_and_removes_library_file() {
    let dir = tempdir().expect("tempdir");
    let (import_service, file_service, db) = build_import_service(dir.path());
    let device_id = DeviceId::new();

    // Pre-create a soft-deleted "stoicism" tag so the in-transaction tag
    // insert violates the UNIQUE(name) constraint.
    let tag_repo = TagRepository::new(db.clone());
    let tag = tag_repo
        .get_or_create_by_name("stoicism", device_id)
        .expect("seed tag");
    db.with_write_conn(|conn| {
        conn.execute(
            "UPDATE tags SET is_deleted = 1 WHERE id = ?1",
            rusqlite::params![tag.id.to_string()],
        )
        .map_err(luma_storage::error::StorageError::from)?;
        Ok(())
    })
    .expect("soft-delete tag");

    let book_title = "Atomicity Regression Book";
    let epub_path = dir.path().join("atomicity_book.epub");
    create_epub_with_subjects(&epub_path, book_title, "Test Author", &["stoicism"]);

    let result = import_service.import_single_file(&epub_path, device_id);
    assert!(
        result.is_err(),
        "import must fail on the in-transaction UNIQUE violation"
    );
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("UNIQUE constraint failed: tags.name"),
        "unexpected error: {err_msg}"
    );

    // 1. No book row survived the failed transaction (rolled back).
    let book_repo = BookRepository::new(db.clone());
    let total = book_repo
        .count(&luma_storage::repos::LibraryFilterOptions::default())
        .expect("count");
    assert_eq!(
        total, 0,
        "book insert must be rolled back with the transaction"
    );

    // 2. The staged library file was removed as compensation (no orphan).
    //    (The covers subdirectory is created eagerly by FileService and is not
    //    an import artifact.)
    let library_files: Vec<_> = std::fs::read_dir(file_service.library_dir())
        .expect("library dir")
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy() != "covers")
        .collect();
    assert!(
        library_files.is_empty(),
        "failed import must not leave an orphaned library file, found {:?}",
        library_files
            .iter()
            .map(|f| f.file_name())
            .collect::<Vec<_>>()
    );
}

#[tokio::test]
async fn successful_import_persists_book_file_tags_and_fts_together() {
    let dir = tempdir().expect("tempdir");
    let (import_service, _file_service, db) = build_import_service(dir.path());
    let device_id = DeviceId::new();

    let epub_path = dir.path().join("happy_book.epub");
    create_epub_with_subjects(
        &epub_path,
        "Happy Path Book",
        "Happy Author",
        &["philosophy", "stoicism"],
    );

    let (book, book_file, _assessment) = import_service
        .import_single_file(&epub_path, device_id)
        .expect("import succeeds");

    // Book + file records exist and the file is on disk.
    let book_repo = BookRepository::new(db.clone());
    let found = book_repo
        .get_by_id(&book.id)
        .expect("get book")
        .expect("book persisted");
    assert_eq!(found.title, "Happy Path Book");
    let canonical = std::path::PathBuf::from(book_file.canonical_path.clone().unwrap());
    assert!(canonical.exists(), "library file must exist after success");

    // Tags were linked inside the same transaction.
    let tag_count: i64 = db
        .with_read_conn(|conn| {
            conn.query_row(
                "SELECT COUNT(*) FROM book_tags WHERE book_id = ?1",
                [book.id.to_string()],
                |r| r.get(0),
            )
            .map_err(luma_storage::error::StorageError::from)
        })
        .expect("tag count");
    assert_eq!(tag_count, 2, "both subjects must be linked as tags");

    // FTS row exists for the same book (written inside the same transaction).
    let fts_count: i64 = db
        .with_read_conn(|conn| {
            conn.query_row(
                "SELECT COUNT(*) FROM books_fts WHERE book_id = ?1",
                [book.id.to_string()],
                |r| r.get(0),
            )
            .map_err(luma_storage::error::StorageError::from)
        })
        .expect("fts count");
    assert_eq!(fts_count, 1, "FTS index row must be present");
}
