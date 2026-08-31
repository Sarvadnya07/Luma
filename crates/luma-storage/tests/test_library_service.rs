use std::fs::File;
use std::io::Write;
use tempfile::{tempdir, NamedTempFile};
use zip::write::FileOptions;
use zip::ZipWriter;

use luma_core::ids::DeviceId;
use luma_core::models::book::{DocumentFormat, LibraryState, ReadingStatus};
use luma_core::models::ingest::DuplicateMatchLevel;
use luma_storage::repos::{BookRepository, LibraryFilterOptions, LibrarySortOptions};
use luma_storage::{Database, LibraryService};

fn create_sample_epub(title: &str, isbn: &str) -> NamedTempFile {
    let file = NamedTempFile::new().unwrap();
    let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
    let options: zip::write::FileOptions<()> =
        FileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("mimetype", options).unwrap();
    zip.write_all(b"application/epub+zip").unwrap();

    zip.start_file("META-INF/container.xml", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
    )
    .unwrap();

    zip.start_file("content.opf", options).unwrap();
    let opf = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{}</dc:title>
    <dc:creator>Test Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="pub-id">{}</dc:identifier>
    <dc:subject>Computer Science</dc:subject>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml" />
  </manifest>
  <spine>
    <itemref idref="ch1" />
  </spine>
</package>"#,
        title, isbn
    );
    zip.write_all(opf.as_bytes()).unwrap();

    zip.finish().unwrap();
    file
}

#[test]
fn test_library_ingestion_and_duplicate_detection() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_lib = tempdir().unwrap();
    let service = LibraryService::new(db.clone(), temp_lib.path());
    let device_id = DeviceId::new();

    let epub1 = create_sample_epub("Database Internals", "978-1492040347");

    // 1. Initial Import
    let (book1, file1, assessment1) = service
        .import_file(epub1.path(), device_id)
        .expect("import file 1");

    assert_eq!(book1.title, "Database Internals");
    assert_eq!(file1.format, DocumentFormat::Epub);
    assert_eq!(assessment1.level, DuplicateMatchLevel::Unrelated);

    // 2. Re-importing the exact same file (Level 1: Exact Hash Duplicate)
    let (dup_book, dup_file, assessment2) = service
        .import_file(epub1.path(), device_id)
        .expect("re-import file 1");

    assert_eq!(dup_book.id, book1.id);
    assert_eq!(dup_file.id, file1.id);
    assert_eq!(assessment2.level, DuplicateMatchLevel::ExactDuplicate);

    // 3. Importing another file with the same ISBN (Level 2: Likely Duplicate)
    let epub2_same_isbn = create_sample_epub("Database Internals Second Edition", "978-1492040347");
    let (_book2, _file2, assessment3) = service
        .import_file(epub2_same_isbn.path(), device_id)
        .expect("import file 2");

    assert_eq!(assessment3.level, DuplicateMatchLevel::LikelyDuplicate);
}

#[test]
fn test_library_repository_filtering_sorting_and_trash() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_lib = tempdir().unwrap();
    let service = LibraryService::new(db.clone(), temp_lib.path());
    let book_repo = BookRepository::new(db.clone());
    let device_id = DeviceId::new();

    let epub = create_sample_epub("Distributed Algorithms", "978-1558603486");
    let (book, _, _) = service.import_file(epub.path(), device_id).unwrap();

    // Verify Active list
    let active_books = book_repo
        .list(
            &LibraryFilterOptions {
                library_state: Some(LibraryState::Active),
                ..Default::default()
            },
            &LibrarySortOptions::default(),
            0,
            10,
        )
        .unwrap();
    assert_eq!(active_books.len(), 1);

    // Change Reading Status
    book_repo
        .set_reading_status(&book.id, ReadingStatus::Reading)
        .unwrap();
    let updated = book_repo.get_by_id(&book.id).unwrap().unwrap();
    assert_eq!(updated.reading_status, ReadingStatus::Reading);

    // Move to Trash
    book_repo.move_to_trash(&book.id).unwrap();
    let active_after_trash = book_repo
        .list(
            &LibraryFilterOptions {
                library_state: Some(LibraryState::Active),
                ..Default::default()
            },
            &LibrarySortOptions::default(),
            0,
            10,
        )
        .unwrap();
    assert_eq!(active_after_trash.len(), 0);

    let trashed_books = book_repo
        .list(
            &LibraryFilterOptions {
                library_state: Some(LibraryState::Trashed),
                ..Default::default()
            },
            &LibrarySortOptions::default(),
            0,
            10,
        )
        .unwrap();
    assert_eq!(trashed_books.len(), 1);

    // Restore from Trash
    book_repo.restore_from_trash(&book.id).unwrap();
    let active_after_restore = book_repo
        .list(
            &LibraryFilterOptions {
                library_state: Some(LibraryState::Active),
                ..Default::default()
            },
            &LibrarySortOptions::default(),
            0,
            10,
        )
        .unwrap();
    assert_eq!(active_after_restore.len(), 1);
}
