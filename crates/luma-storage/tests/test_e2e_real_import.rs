use std::fs::File;
use std::io::Write;
use tempfile::tempdir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use luma_core::ids::DeviceId;
use luma_core::models::annotation::{Annotation, AnnotationType};
use luma_core::models::book::{DocumentFormat, LibraryState, ReadingStatus};
use luma_core::models::ingest::DuplicateMatchLevel;
use luma_core::models::reading::{Bookmark, ReadingProgress};
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::{
    AnnotationRepository, BookmarkRepository, JobRepository, LibraryFilterOptions,
    LibrarySortOptions, ReadingProgressRepository,
};
use luma_storage::services::{ImportService, LibraryService, SearchService};

fn create_valid_epub(dest_path: &std::path::Path, title: &str, author: &str, isbn: &str) {
    let file = File::create(dest_path).expect("create file");
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    // 1. mimetype
    zip.start_file("mimetype", options).unwrap();
    zip.write_all(b"application/epub+zip").unwrap();

    // 2. container.xml
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

    // 3. package.opf
    zip.start_file("EPUB/package.opf", options).unwrap();
    let opf = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{}</dc:title>
    <dc:creator>{}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="pub-id">{}</dc:identifier>
    <dc:description>A comprehensive exploration of distributed systems and local-first architecture.</dc:description>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml" />
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />
  </manifest>
  <spine>
    <itemref idref="ch1" />
  </spine>
</package>"#,
        title, author, isbn
    );
    zip.write_all(opf.as_bytes()).unwrap();

    // 4. Chapter content
    zip.start_file("EPUB/ch1.xhtml", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1</title></head>
<body>
  <h1>Chapter 1: The Principle of Architecture</h1>
  <p>In software engineering, local-first systems prioritize user ownership and data autonomy.</p>
</body>
</html>"#,
    )
    .unwrap();

    zip.finish().unwrap();
}

fn create_valid_pdf(dest_path: &std::path::Path, title: &str) {
    let mut file = File::create(dest_path).expect("create pdf");
    // Minimal valid PDF 1.4 document
    let pdf_content = format!(
        "%PDF-1.4\n\
        1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n\
        2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n\
        3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n\
        4 0 obj << /Length 55 >> stream\n\
        BT /F1 12 Tf 100 700 Td ({}) Tj ET\n\
        endstream endobj\n\
        xref\n\
        0 5\n\
        0000000000 65535 f \n\
        0000000009 00000 n \n\
        0000000058 00000 n \n\
        0000000115 00000 n \n\
        0000000210 00000 n \n\
        trailer << /Size 5 /Root 1 0 R >>\n\
        startxref\n\
        316\n\
        %%EOF",
        title
    );
    file.write_all(pdf_content.as_bytes()).unwrap();
}

#[tokio::test]
async fn test_end_to_end_user_import_and_persistence_flow() {
    let root_temp = tempdir().expect("create temp root");
    let fixtures_dir = root_temp.path().join("fixtures");
    let app_data_dir = root_temp.path().join("app_data");
    std::fs::create_dir_all(&fixtures_dir).unwrap();
    std::fs::create_dir_all(&app_data_dir).unwrap();

    let epub_path = fixtures_dir.join("architecture_of_stillness.epub");
    let pdf_path = fixtures_dir.join("system_design_handbook.pdf");

    create_valid_epub(
        &epub_path,
        "The Architecture of Stillness",
        "Elena Vance",
        "978-0143127741",
    );
    create_valid_pdf(&pdf_path, "System Design Handbook");

    // Also persist static repository fixtures in root tests/fixtures/ for manual testing
    let root_fixtures = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .map(|p| p.join("tests").join("fixtures"));
    if let Some(ref rdir) = root_fixtures {
        let _ = std::fs::create_dir_all(rdir);
        create_valid_epub(
            &rdir.join("sample_book.epub"),
            "The Architecture of Stillness",
            "Elena Vance",
            "978-0143127741",
        );
        create_valid_pdf(&rdir.join("sample_doc.pdf"), "System Design Handbook");
    }

    let db_path = app_data_dir.join("luma.db");

    // PHASE 1: Initialize real database and services
    let db = Database::open(&db_path).expect("open persistent sqlite");
    let event_bus = EventBus::default();
    let file_service = FileService::new(&app_data_dir);
    let cache = CacheManager::new();
    let job_repo = JobRepository::new(db.clone());
    let job_manager = JobManager::new(job_repo, event_bus.clone());

    let import_service = ImportService::new(
        db.clone(),
        file_service.clone(),
        event_bus.clone(),
        job_manager.clone(),
        cache.clone(),
    );
    let library_service = LibraryService::new(db.clone(), event_bus.clone());
    let search_service = SearchService::new(db.clone(), event_bus.clone(), cache.clone());

    let device_id = DeviceId::new();

    // 1. Initial State: Library is empty
    let initial_books = library_service
        .list_books(
            &LibraryFilterOptions::default(),
            &LibrarySortOptions::default(),
            0,
            100,
        )
        .expect("initial list");
    assert_eq!(initial_books.len(), 0, "Library must start truly empty");

    // 2. User Imports real EPUB file
    let import_job = import_service
        .import_files(std::slice::from_ref(&epub_path), device_id)
        .await
        .expect("import epub");

    assert_eq!(import_job.completed_count, 1);
    assert_eq!(import_job.failed_count, 0);

    // 3. Verify book appears in LibraryService with real extracted metadata
    let books = library_service
        .list_books(
            &LibraryFilterOptions::default(),
            &LibrarySortOptions::default(),
            0,
            100,
        )
        .expect("list after epub import");
    assert_eq!(books.len(), 1);
    let book = &books[0];
    assert_eq!(book.title, "The Architecture of Stillness");
    assert_eq!(book.isbn.as_deref(), Some("978-0143127741"));
    assert_eq!(book.reading_status, ReadingStatus::Unread);
    assert_eq!(book.library_state, LibraryState::Active);

    // 4. Verify book details view
    let details = library_service
        .get_book_details(&book.id)
        .expect("book details")
        .expect("must exist");
    assert_eq!(details.authors.len(), 1);
    assert_eq!(details.authors[0].name, "Elena Vance");
    assert_eq!(details.files.len(), 1);
    assert_eq!(details.files[0].format, DocumentFormat::Epub);

    // 5. Search by author & title in FTS5
    let search_res = search_service
        .search_library("Stillness", None, 10)
        .await
        .expect("fts search title");
    assert!(search_res.total_count >= 1);

    // 6. User reads book: save reading progress, bookmark, annotation
    let progress_repo = ReadingProgressRepository::new(db.clone());
    let mut prog = ReadingProgress::new(book.id, "epubcfi(/6/2!/4/1:0)", device_id);
    prog.progress_percentage = 0.42;
    prog.current_chapter_title = Some("Chapter 1: The Principle of Architecture".to_string());
    prog.current_page_number = Some(1);
    prog.total_pages = Some(10);
    progress_repo.save(&prog).expect("save progress");

    let bmk_repo = BookmarkRepository::new(db.clone());
    let mut bmk = Bookmark::new(book.id, "epubcfi(/6/2!/4/1:0)", device_id);
    bmk.title = Some("My Bookmark".to_string());
    bmk.chapter_title = Some("Chapter 1".to_string());
    bmk.page_number = Some(1);
    bmk_repo.insert(&bmk).expect("insert bookmark");

    let ann_repo = AnnotationRepository::new(db.clone());
    let ann = Annotation::new(
        book.id,
        AnnotationType::Highlight,
        "user ownership and data autonomy".to_string(),
        "{\"cfi\":\"epubcfi(/6/2!/4/100:0)\"}".to_string(),
        device_id,
    ).with_color("#FDE047");

    ann_repo.insert(&ann).expect("insert annotation");

    // 7. User imports real PDF file
    let pdf_job = import_service
        .import_files(std::slice::from_ref(&pdf_path), device_id)
        .await
        .expect("import pdf");
    assert_eq!(pdf_job.completed_count, 1);

    let all_books = library_service
        .list_books(
            &LibraryFilterOptions::default(),
            &LibrarySortOptions::default(),
            0,
            100,
        )
        .expect("list after pdf import");
    assert_eq!(all_books.len(), 2);

    // 8. Test Duplicate detection: re-importing the exact same EPUB
    let dup_job = import_service
        .import_files(std::slice::from_ref(&epub_path), device_id)
        .await
        .expect("re-import epub");
    assert_eq!(dup_job.items.len(), 1);
    assert_eq!(
        dup_job.items[0].duplicate_level,
        Some(DuplicateMatchLevel::ExactDuplicate)
    );

    // Drop previous database instance to simulate closing the application
    drop(db);

    // PHASE 2: RESTART APPLICATION (Simulate app launch on next day)
    let reloaded_db = Database::open(&db_path).expect("reopen persistent sqlite");
    let reloaded_lib_service = LibraryService::new(reloaded_db.clone(), EventBus::default());
    let reloaded_prog_repo = ReadingProgressRepository::new(reloaded_db.clone());
    let reloaded_bmk_repo = BookmarkRepository::new(reloaded_db.clone());
    let reloaded_ann_repo = AnnotationRepository::new(reloaded_db.clone());

    // 9. Verify books persisted across restart
    let persisted_books = reloaded_lib_service
        .list_books(
            &LibraryFilterOptions::default(),
            &LibrarySortOptions::default(),
            0,
            100,
        )
        .expect("list persisted books");
    assert_eq!(
        persisted_books.len(),
        2,
        "All imported books must survive application restart"
    );

    // 10. Verify reading progress persisted
    let restored_prog = reloaded_prog_repo
        .get(&book.id)
        .expect("get progress")
        .expect("progress must exist");
    assert_eq!(restored_prog.progress_percentage, 0.42);
    assert_eq!(
        restored_prog.current_chapter_title.as_deref(),
        Some("Chapter 1: The Principle of Architecture")
    );

    // 11. Verify bookmarks persisted
    let restored_bmks = reloaded_bmk_repo
        .list_by_book_id(&book.id)
        .expect("list bookmarks");
    assert_eq!(restored_bmks.len(), 1);
    assert_eq!(restored_bmks[0].title.as_deref(), Some("My Bookmark"));

    // 12. Verify annotations persisted
    let restored_anns = reloaded_ann_repo
        .list_by_book(&book.id)
        .expect("list annotations");

    assert_eq!(restored_anns.len(), 1);
    assert_eq!(restored_anns[0].quote, "user ownership and data autonomy");
}
