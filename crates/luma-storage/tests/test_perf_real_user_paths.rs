use luma_core::ids::DeviceId;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;

use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::JobRepository;
use luma_storage::services::{ImportService, ReaderService, ReadingProgressService, SearchService};
use std::fs::File;
use std::io::Write;
use std::time::Instant;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

fn create_realistic_epub(title: &str, author: &str, num_chapters: usize) -> tempfile::NamedTempFile {
    let temp_file = tempfile::NamedTempFile::new().expect("temp file");
    let file = File::create(temp_file.path()).expect("create");
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    let raw_options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    zip.start_file("mimetype", raw_options).expect("mimetype");
    zip.write_all(b"application/epub+zip").expect("write");

    zip.start_file("META-INF/container.xml", options).expect("container");
    zip.write_all(br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#).expect("write");

    zip.start_file("OEBPS/content.opf", options).expect("opf");
    let mut manifest = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{}</dc:title>
    <dc:creator>{}</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
"#,
        title, author
    );

    let mut spine = String::from("  <spine>\n");
    for i in 0..num_chapters {
        manifest.push_str(&format!(
            r#"    <item id="ch{}" href="ch{}.xhtml" media-type="application/xhtml+xml"/>"#,
            i, i
        ));
        manifest.push('\n');
        spine.push_str(&format!(r#"    <itemref idref="ch{}"/>"#, i));
        spine.push('\n');
    }
    manifest.push_str("  </manifest>\n");
    spine.push_str("  </spine>\n</package>");
    zip.write_all(format!("{}{}", manifest, spine).as_bytes()).expect("write");

    for i in 0..num_chapters {
        zip.start_file(format!("OEBPS/ch{}.xhtml", i), options).expect("ch");
        zip.write_all(format!(
            r#"<!DOCTYPE html><html><body><h1>Chapter {}</h1><p>Realistic body paragraph with text for search indexing and reading evaluation.</p></body></html>"#,
            i + 1
        ).as_bytes()).expect("write");
    }

    zip.finish().expect("finish");
    temp_file
}

#[tokio::test]
async fn test_benchmark_end_to_end_real_import_pipeline() {
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let data_path = temp_dir.path().to_path_buf();
    let db = Database::open(data_path.join("luma_bench.db")).expect("open db");
    let event_bus = EventBus::default();
    let file_service = FileService::new(&data_path);
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

    let search_service = SearchService::new(db.clone(), event_bus.clone(), cache.clone());
    let reader_service = ReaderService::new(db.clone(), cache.clone());
    let progress_service = ReadingProgressService::new(db.clone(), event_bus.clone());

    // Generate 10 realistic EPUB files on disk
    let mut files = Vec::new();
    for i in 0..10 {
        let epub = create_realistic_epub(
            &format!("Masterpiece Novel Volume {:02}", i),
            &format!("Author Surname {:02}", i % 3),
            12,
        );
        files.push(epub);
    }
    let file_paths: Vec<std::path::PathBuf> = files.iter().map(|f| f.path().to_path_buf()).collect();

    let device_id = DeviceId::new();

    // 1. Measure Real End-to-End Import Pipeline (10 Books)
    let import_start = Instant::now();
    let import_job = import_service
        .import_files(&file_paths, device_id)
        .await
        .expect("import");
    let import_duration = import_start.elapsed();

    println!(
        "Real E2E Import Pipeline (10 EPUBs with 12 chapters each, metadata, hashing, duplicate detection, DB tx, events): {:?}",
        import_duration
    );
    assert_eq!(import_job.total_files, 10);
    assert_eq!(import_job.completed_count, 10);

    let book_repo = luma_storage::repos::BookRepository::new(db.clone());
    let all_books = book_repo
        .list(
            &luma_storage::repos::LibraryFilterOptions::default(),
            &luma_storage::repos::LibrarySortOptions::default(),
            0,
            50,
        )
        .expect("list books");
    assert_eq!(all_books.len(), 10);

    let first_book_id = all_books[0].id;

    // 2. Measure Real Reader Open Flow (Consolidated Payload: Metadata + TOC + Progress + Annotations + Bookmarks + Session Cache)
    let open_start = Instant::now();
    let doc_data = reader_service
        .open_document(&first_book_id, None)
        .await
        .expect("open document");
    let open_duration = open_start.elapsed();
    println!("Real Backend Open Document Pipeline (Consolidated Payload): {:?}", open_duration);
    assert_eq!(doc_data.total_pages_or_spines, 12);

    // 3. Measure Chapter Retrieval from Session Cache
    let chapter_start = Instant::now();
    let ch0 = reader_service
        .get_chapter(&first_book_id, 0)
        .await
        .expect("chapter");
    let chapter_duration = chapter_start.elapsed();
    println!("Real Chapter 0 Retrieval (Session cached): {:?}", chapter_duration);
    assert!(ch0.html_content.contains("Chapter 1"));

    // 4. Measure FTS5 Search across Real Ingested Books
    let _ = search_service.rebuild_index().await;
    let search_start = Instant::now();
    let search_res = search_service
        .search_library("Novel Volume", None, 50)
        .await
        .expect("search");
    let search_duration = search_start.elapsed();
    println!("Real FTS5 Search Query Duration (10 books): {:?}", search_duration);
    assert!(!search_res.hits.is_empty());

    // 5. Measure Reading Progress Save
    let mut prog = luma_core::models::reading::ReadingProgress::new(
        first_book_id,
        "epubcfi(/6/4[ch0]!/4/2/1:0)".to_string(),
        device_id,
    );
    prog.progress_percentage = 0.25;
    prog.current_chapter_title = Some("Chapter 1".to_string());
    prog.current_page_number = Some(1);
    prog.total_pages = Some(12);

    let prog_start = Instant::now();
    progress_service.save_progress(&prog).expect("save progress");
    let prog_duration = prog_start.elapsed();
    println!("Reading Progress SQLite Transaction Duration: {:?}", prog_duration);

}
