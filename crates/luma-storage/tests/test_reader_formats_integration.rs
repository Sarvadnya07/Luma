use luma_core::ids::DeviceId;
use luma_core::models::book::DocumentFormat;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::JobRepository;
use luma_storage::services::{ImportService, ReaderService};
use std::fs::File;
use std::io::Write;
use tempfile::tempdir;

#[tokio::test]
async fn test_reader_service_polymorphic_formats() {
    let dir = tempdir().expect("temp dir");
    let db = Database::open_in_memory().expect("in-memory db");
    let cache = CacheManager::default();
    let file_service = FileService::new(dir.path());
    let event_bus = EventBus::default();
    let job_repo = JobRepository::new(db.clone());
    let job_manager = JobManager::new(job_repo, event_bus.clone());
    let import_service = ImportService::new(
        db.clone(),
        file_service,
        event_bus,
        job_manager,
        cache.clone(),
    );
    let reader = ReaderService::new(db.clone(), cache);
    let device_id = DeviceId::new();

    // 1. Plaintext Document (.txt)
    let txt_path = dir.path().join("scholarly_essay.txt");
    {
        let mut f = File::create(&txt_path).expect("create txt");
        f.write_all(b"Scholarly Epistemology Essay\n\nFirst paragraph of deep philosophical inquiry.\n\nSecond paragraph examining empiricism.").expect("write");
    }

    let (txt_book, txt_file, _) = import_service
        .import_single_file(&txt_path, device_id)
        .expect("import txt");
    assert_eq!(txt_file.format, DocumentFormat::Txt);

    // Open TXT via ReaderService
    let txt_open = reader
        .open_document(&txt_book.id, None)
        .await
        .expect("open txt document");
    assert_eq!(txt_open.total_pages_or_spines, 1);
    assert_eq!(txt_open.metadata.format, DocumentFormat::Txt);
    assert_eq!(txt_open.toc.len(), 1);

    // Retrieve Chapter 0 of TXT
    let txt_chapter = reader
        .get_chapter(&txt_book.id, 0)
        .await
        .expect("get txt chapter 0");
    assert!(txt_chapter
        .html_content
        .contains("Scholarly Epistemology Essay"));
    assert!(txt_chapter
        .html_content
        .contains("First paragraph of deep philosophical inquiry"));

    // Search in TXT
    let txt_search = reader
        .search_document(&txt_book.id, "empiricism")
        .await
        .expect("search txt");
    assert_eq!(txt_search.len(), 1);

    // 2. Markdown Document (.md)
    let md_path = dir.path().join("notes.md");
    {
        let mut f = File::create(&md_path).expect("create md");
        f.write_all(b"# Introduction to Logic\n\nLogic is the study of **valid inference**.\n\n## Syllogisms\n\nAristotle formalized categorical syllogisms.").expect("write");
    }

    let (md_book, md_file, _) = import_service
        .import_single_file(&md_path, device_id)
        .expect("import md");
    assert_eq!(md_file.format, DocumentFormat::Md);

    // Open MD via ReaderService
    let md_open = reader
        .open_document(&md_book.id, None)
        .await
        .expect("open md document");
    assert_eq!(md_open.total_pages_or_spines, 1);
    assert_eq!(md_open.metadata.format, DocumentFormat::Md);
    assert!(md_open.toc.len() >= 2);

    // Retrieve Chapter 0 of MD
    let md_chapter = reader
        .get_chapter(&md_book.id, 0)
        .await
        .expect("get md chapter 0");
    assert!(md_chapter
        .html_content
        .contains("<strong>valid inference</strong>"));
    assert!(md_chapter
        .html_content
        .contains("Aristotle formalized categorical syllogisms"));

    // Search in MD
    let md_search = reader
        .search_document(&md_book.id, "syllogisms")
        .await
        .expect("search md");
    assert_eq!(md_search.len(), 2);

    // 3. HTML Document (.html)
    let html_path = dir.path().join("article.html");
    {
        let mut f = File::create(&html_path).expect("create html");
        f.write_all(b"<html><head><title>Quantum Foundations</title></head><body><h1>Wave-Particle Duality</h1><p>Light exhibits properties of both waves and particles.</p></body></html>").expect("write");
    }

    let (html_book, html_file, _) = import_service
        .import_single_file(&html_path, device_id)
        .expect("import html");
    assert_eq!(html_file.format, DocumentFormat::Html);

    // Open HTML via ReaderService
    let html_open = reader
        .open_document(&html_book.id, None)
        .await
        .expect("open html document");
    assert_eq!(html_open.total_pages_or_spines, 1);
    assert_eq!(html_open.metadata.format, DocumentFormat::Html);

    // Retrieve Chapter 0 of HTML
    let html_chapter = reader
        .get_chapter(&html_book.id, 0)
        .await
        .expect("get html chapter 0");
    assert!(html_chapter.html_content.contains("Wave-Particle Duality"));
    assert!(html_chapter
        .html_content
        .contains("both waves and particles"));

    // Search in HTML
    let html_search = reader
        .search_document(&html_book.id, "duality")
        .await
        .expect("search html");
    assert_eq!(html_search.len(), 1);
}
