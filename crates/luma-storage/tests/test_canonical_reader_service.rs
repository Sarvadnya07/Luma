use luma_core::ids::DeviceId;
use luma_core::models::book::DocumentFormat;
use luma_core::models::canonical::{DocumentPosition, DocumentRange};
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
async fn test_canonical_reader_service_queries() {
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

    // 1. Setup Markdown document with rich structure
    let md_path = dir.path().join("canonical_study.md");
    {
        let mut f = File::create(&md_path).expect("create md");
        f.write_all(b"# Empirical Epistemology\n\nEpistemology investigates the nature of knowledge.\n\n## Rationalism vs Empiricism\n\nEmpiricism emphasizes evidence from sensory perception.\n\n> Knowledge without perception is barren.\n").expect("write");
    }

    let (book, file, _) = import_service
        .import_single_file(&md_path, device_id)
        .expect("import md");
    assert_eq!(file.format, DocumentFormat::Md);

    // Open document through ReaderService
    let open_res = reader
        .open_document(&book.id, None)
        .await
        .expect("open document");
    assert_eq!(open_res.metadata.format, DocumentFormat::Md);

    // 2. Query DocumentStructure
    let structure = reader
        .get_document_structure(&book.id)
        .await
        .expect("get document structure");
    assert!(structure.total_paragraphs >= 2);
    assert!(structure.total_words > 10);

    // 3. Query Headings
    let headings = reader
        .get_document_headings(&book.id)
        .await
        .expect("get headings");
    assert_eq!(headings.len(), 2);
    assert_eq!(headings[0].text.as_deref(), Some("Empirical Epistemology"));
    assert_eq!(headings[1].text.as_deref(), Some("Rationalism vs Empiricism"));

    // 4. Query Paragraph by Index
    let p0 = reader
        .get_paragraph(&book.id, 0, 0)
        .await
        .expect("get paragraph 0");
    assert_eq!(p0, "Epistemology investigates the nature of knowledge.");

    let p1 = reader
        .get_paragraph(&book.id, 0, 1)
        .await
        .expect("get paragraph 1");
    assert_eq!(p1, "Empiricism emphasizes evidence from sensory perception.");

    // 5. Query Node Text by ID
    let node_text = reader
        .get_node_text(&book.id, "p0")
        .await
        .expect("get node text for p0");
    assert_eq!(node_text, "Epistemology investigates the nature of knowledge.");

    // 6. Query Range Text
    let range = DocumentRange::new(
        DocumentPosition::new(0, 0),
        DocumentPosition::new(0, 24),
    );
    let range_text = reader
        .get_range_text(&book.id, &range)
        .await
        .expect("get range text");
    assert_eq!(range_text, "# Empirical Epistemology");

    // 7. Generate Citation Context
    let cit_range = DocumentRange::new(
        DocumentPosition::new(0, 26),
        DocumentPosition::new(0, 76),
    );
    let citation = reader
        .get_document_citation(&book.id, &cit_range)
        .await
        .expect("get citation");
    assert_eq!(citation.quote, "Epistemology investigates the nature of knowledge.");
    assert!(citation.formatted_citation.contains("Empirical Epistemology"));

    // 8. Canonical Search
    let matches = reader
        .search_canonical(&book.id, "sensory")
        .await
        .expect("search canonical");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].section_index, 0);
    assert!(matches[0].snippet.contains("sensory"));
}
