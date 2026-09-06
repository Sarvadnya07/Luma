use chrono::Utc;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use tempfile::tempdir;

use luma_core::ids::{DeviceId, SessionId};
use luma_core::models::annotation::{Annotation, AnnotationType};
use luma_core::models::book::{Book, DocumentFormat};
use luma_core::models::knowledge::{
    Flashcard, FlashcardState, Note, ResearchDraft, ResearchEvidence, ResearchProject,
    ResearchQuestion, StudyReview,
};
use luma_core::models::reading::{ReadingProgress, ReadingSession};
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::{
    AnnotationRepository, BookRepository, FlashcardRepository, JobRepository, NoteRepository,
    ReadingProgressRepository, ReadingSessionRepository, ResearchRepository, StudyReviewRepository,
};
use luma_storage::services::{BackupService, ImportService, ReaderService};

fn sample_fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("tests")
        .join("fixtures")
        .join(name)
}

// ---------------------------------------------------------------------------
// 1. TXT Imports and Opens
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_txt_imports_and_opens() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let cache = CacheManager::default();
    let file_service = FileService::new(tmp.path());
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
    let dev_id = DeviceId::new();

    let txt_path = tmp.path().join("quantum_computing.txt");
    {
        let mut f = File::create(&txt_path).unwrap();
        f.write_all(b"Quantum Computing in the Modern Era\n\nQuantum superposition enables simultaneous state evaluation.\n\nQuantum entanglement provides non-local state correlations.")
            .unwrap();
    }

    let (book, file, _) = import_service
        .import_single_file(&txt_path, dev_id)
        .expect("import txt file");
    assert_eq!(file.format, DocumentFormat::Txt);

    // Open via ReaderService
    let doc_meta = reader
        .open_document(&book.id, None)
        .await
        .expect("open txt document");
    assert_eq!(doc_meta.metadata.format, DocumentFormat::Txt);
    assert_eq!(doc_meta.total_pages_or_spines, 1);
    assert_eq!(doc_meta.toc.len(), 1);

    // Read Chapter 0
    let ch0 = reader
        .get_chapter(&book.id, 0)
        .await
        .expect("get txt chapter 0");
    assert!(ch0
        .html_content
        .contains("Quantum Computing in the Modern Era"));
    assert!(ch0.html_content.contains("Quantum superposition enables"));

    // Search in TXT
    let matches = reader
        .search_document(&book.id, "entanglement")
        .await
        .expect("search txt");
    assert!(!matches.is_empty());
    assert!(matches[0].snippet.contains("entanglement"));
}

// ---------------------------------------------------------------------------
// 2. Markdown Imports and Opens
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_markdown_imports_and_opens() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let cache = CacheManager::default();
    let file_service = FileService::new(tmp.path());
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
    let dev_id = DeviceId::new();

    let md_path = tmp.path().join("distributed_systems.md");
    {
        let mut f = File::create(&md_path).unwrap();
        f.write_all(b"# Distributed Systems Principles\n\nOverview of distributed consensus.\n\n## Paxos and Raft\n\nConsensus algorithms guarantee safety under network partitions.\n\n## Vector Clocks\n\nVector clocks capture causal relationships between distributed events.")
            .unwrap();
    }

    let (book, file, _) = import_service
        .import_single_file(&md_path, dev_id)
        .expect("import md file");
    assert_eq!(file.format, DocumentFormat::Md);

    let doc_meta = reader
        .open_document(&book.id, None)
        .await
        .expect("open md document");
    assert_eq!(doc_meta.metadata.format, DocumentFormat::Md);
    // Hierarchical TOC check
    assert!(doc_meta.toc.len() >= 2);
    assert_eq!(doc_meta.toc[0].title, "Distributed Systems Principles");

    let ch0 = reader
        .get_chapter(&book.id, 0)
        .await
        .expect("get md chapter 0");
    assert!(ch0.html_content.contains("<h1"));
    assert!(ch0
        .html_content
        .contains("Distributed Systems Principles</h1>"));
    assert!(ch0.html_content.contains("<h2"));
    assert!(ch0.html_content.contains("Paxos and Raft</h2>"));
    assert!(ch0.html_content.contains("Vector clocks capture causal"));

    let matches = reader
        .search_document(&book.id, "consensus")
        .await
        .expect("search md");
    assert!(!matches.is_empty());
}

// ---------------------------------------------------------------------------
// 3. HTML Imports and Opens
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_html_imports_and_opens() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let cache = CacheManager::default();
    let file_service = FileService::new(tmp.path());
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
    let dev_id = DeviceId::new();

    let html_path = tmp.path().join("article.html");
    {
        let mut f = File::create(&html_path).unwrap();
        f.write_all(b"<!DOCTYPE html><html><head><title>Web Architecture</title><script>malicious();</script></head><body><h1>Web Architecture Evolution</h1><p>Modern local-first software utilizes edge replication.</p></body></html>")
            .unwrap();
    }

    let (book, file, _) = import_service
        .import_single_file(&html_path, dev_id)
        .expect("import html file");
    assert_eq!(file.format, DocumentFormat::Html);

    let doc_meta = reader
        .open_document(&book.id, None)
        .await
        .expect("open html document");
    assert_eq!(doc_meta.metadata.format, DocumentFormat::Html);
    assert_eq!(doc_meta.toc[0].title, "Web Architecture Evolution");

    let ch0 = reader
        .get_chapter(&book.id, 0)
        .await
        .expect("get html chapter 0");
    // Script must be sanitized away
    assert!(!ch0.html_content.contains("malicious"));
    assert!(ch0.html_content.contains("Web Architecture Evolution"));
    assert!(ch0
        .html_content
        .contains("local-first software utilizes edge replication"));

    let matches = reader
        .search_document(&book.id, "replication")
        .await
        .expect("search html");
    assert!(!matches.is_empty());
}

// ---------------------------------------------------------------------------
// 4. EPUB Still Opens
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_epub_still_opens() {
    let epub_fixture = sample_fixture_path("sample_book.epub");
    assert!(epub_fixture.exists(), "sample_book.epub fixture exists");

    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let cache = CacheManager::default();
    let file_service = FileService::new(tmp.path());
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
    let dev_id = DeviceId::new();

    let (book, file, _) = import_service
        .import_single_file(&epub_fixture, dev_id)
        .expect("import epub");
    assert_eq!(file.format, DocumentFormat::Epub);

    let doc_meta = reader
        .open_document(&book.id, None)
        .await
        .expect("open epub document");
    assert_eq!(doc_meta.metadata.format, DocumentFormat::Epub);
    assert!(doc_meta.total_pages_or_spines >= 1);

    let ch0 = reader
        .get_chapter(&book.id, 0)
        .await
        .expect("get epub chapter 0");
    assert!(!ch0.html_content.is_empty());
}

// ---------------------------------------------------------------------------
// 5. PDF Still Opens
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_pdf_still_opens() {
    let pdf_fixture = sample_fixture_path("sample_doc.pdf");
    assert!(pdf_fixture.exists(), "sample_doc.pdf fixture exists");

    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let cache = CacheManager::default();
    let file_service = FileService::new(tmp.path());
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
    let dev_id = DeviceId::new();

    let (book, file, _) = import_service
        .import_single_file(&pdf_fixture, dev_id)
        .expect("import pdf");
    assert_eq!(file.format, DocumentFormat::Pdf);

    let doc_meta = reader
        .open_document(&book.id, None)
        .await
        .expect("open pdf document");
    assert_eq!(doc_meta.metadata.format, DocumentFormat::Pdf);
    assert!(doc_meta.total_pages_or_spines >= 1);
}

// ---------------------------------------------------------------------------
// 6. Annotations Still Work
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_annotations_work() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let dev_id = DeviceId::new();

    let book = Book::new("Annotation Testing Volume", dev_id);
    let book_repo = BookRepository::new(db.clone());
    book_repo.insert(&book).unwrap();

    let ann_repo = AnnotationRepository::new(db.clone());
    let ann = Annotation::new(
        book.id,
        AnnotationType::Highlight,
        "Local-first software retains full offline data ownership.",
        r#"{"exact":"Local-first software retains full offline data ownership.","prefix":"In digital ethics, ","suffix":" This is critical for privacy."}"#,
        dev_id,
    )
    .with_color("#3b82f6")
    .with_note(Some("Essential privacy guarantee".to_string()));

    ann_repo.insert(&ann).expect("insert annotation");

    let loaded = ann_repo.list_by_book(&book.id).expect("list annotations");
    assert_eq!(loaded.len(), 1);
    assert_eq!(
        loaded[0].quote,
        "Local-first software retains full offline data ownership."
    );
    assert_eq!(loaded[0].color_hex, "#3b82f6");
    assert_eq!(
        loaded[0].note.as_deref(),
        Some("Essential privacy guarantee")
    );
}

// ---------------------------------------------------------------------------
// 7. Progress Still Persists
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_progress_persists() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("test_luma.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let dev_id = DeviceId::new();

    let book = Book::new("Progress Testing Volume", dev_id);
    let book_repo = BookRepository::new(db.clone());
    book_repo.insert(&book).unwrap();

    let progress_repo = ReadingProgressRepository::new(db.clone());
    let mut prog = ReadingProgress::new(book.id, "chapter_03#paragraph_12", dev_id);
    prog.progress_percentage = 48.75;

    progress_repo.save(&prog).expect("save progress");

    let loaded = progress_repo
        .get(&book.id)
        .expect("get progress")
        .expect("progress exists");
    assert_eq!(loaded.current_locator, "chapter_03#paragraph_12");
    assert!((loaded.progress_percentage - 48.75).abs() < 0.001);
}

// ---------------------------------------------------------------------------
// 8. Notes Survive Full Application Restart
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_notes_survive_restart() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("luma_restart_notes.db");
    let note_id = "note_restart_001".to_string();

    // Session 1: Create Note in SQLite and terminate context
    {
        let db = Database::open(&db_path).expect("open db phase 1");
        let note_repo = NoteRepository::new(db.clone());
        let note = Note {
            id: note_id.clone(),
            book_id: None,
            annotation_id: None,
            source_type: "Standalone".to_string(),
            source_title: "Architecture Journal".to_string(),
            title: "Durable SQLite Architecture".to_string(),
            content: "All knowledge entities must survive application exit without loss."
                .to_string(),
            quote: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        };
        note_repo.insert(&note).expect("insert note");
        // db is dropped here, closing database handle
    }

    // Session 2: Reopen brand new Database handle from the exact same disk file
    {
        let db_reopened = Database::open(&db_path).expect("reopen db phase 2");
        let note_repo2 = NoteRepository::new(db_reopened);
        let note = note_repo2
            .get_by_id(&note_id)
            .expect("get note")
            .expect("note exists after restart");
        assert_eq!(note.title, "Durable SQLite Architecture");
        assert_eq!(
            note.content,
            "All knowledge entities must survive application exit without loss."
        );
        assert_eq!(note.source_title, "Architecture Journal");
    }
}

// ---------------------------------------------------------------------------
// 9. Flashcards Survive Full Application Restart
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_flashcards_survive_restart() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("luma_restart_flashcards.db");
    let card_id = "card_restart_001".to_string();
    let review_id = "review_restart_001".to_string();

    // Session 1: Create Flashcard + StudyReview and close
    {
        let db = Database::open(&db_path).expect("open db phase 1");
        let card_repo = FlashcardRepository::new(db.clone());
        let review_repo = StudyReviewRepository::new(db.clone());

        let card = Flashcard {
            id: card_id.clone(),
            front: "What does SQLite WAL mode provide?".to_string(),
            back: "Write-Ahead Logging provides concurrent reader access while writes occur."
                .to_string(),
            source_book_id: None,
            source_annotation_id: None,
            deck_id: "engineering".to_string(),
            state: FlashcardState::Review,
            interval_days: 3,
            ease_factor: 2.6,
            repetitions: 2,
            due_at: Utc::now(),
            last_reviewed_at: Some(Utc::now()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        };
        card_repo.insert(&card).expect("insert flashcard");

        let review = StudyReview {
            id: review_id.clone(),
            flashcard_id: card_id.clone(),
            rating: 4,
            interval_before: 1,
            interval_after: 3,
            ease_factor: 2.6,
            reviewed_at: Utc::now(),
        };
        review_repo.insert(&review).expect("insert review");
    }

    // Session 2: Reopen brand new Database handle from same disk file
    {
        let db_reopened = Database::open(&db_path).expect("reopen db phase 2");
        let card_repo2 = FlashcardRepository::new(db_reopened.clone());
        let review_repo2 = StudyReviewRepository::new(db_reopened);

        let cards = card_repo2.list_all().expect("list cards");
        let card = cards
            .into_iter()
            .find(|c| c.id == card_id)
            .expect("card exists");
        assert_eq!(card.deck_id, "engineering");
        assert_eq!(card.repetitions, 2);
        assert_eq!(card.front, "What does SQLite WAL mode provide?");

        let reviews = review_repo2.list_all().expect("list reviews");
        let card_reviews: Vec<_> = reviews
            .into_iter()
            .filter(|r| r.flashcard_id == card_id)
            .collect();
        assert_eq!(card_reviews.len(), 1);
        assert_eq!(card_reviews[0].rating, 4);
    }
}

// ---------------------------------------------------------------------------
// 10. Research Survives Full Application Restart
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_research_survives_restart() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("luma_restart_research.db");
    let proj_id = "proj_restart_001".to_string();

    // Session 1: Create Research Project, Questions, Evidence, Draft
    {
        let db = Database::open(&db_path).expect("open db phase 1");
        let research_repo = ResearchRepository::new(db.clone());

        let project = ResearchProject {
            id: proj_id.clone(),
            title: "Local-First Knowledge Architectures".to_string(),
            description: Some(
                "Evaluating durability across desktop and distributed nodes.".to_string(),
            ),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        };
        research_repo
            .insert_project(&project)
            .expect("insert project");

        let question = ResearchQuestion {
            id: "q_restart_001".to_string(),
            project_id: proj_id.clone(),
            question: "How does WAL mode prevent readers from blocking writers?".to_string(),
            status: "open".to_string(),
            created_at: Utc::now(),
        };
        research_repo
            .insert_question(&question)
            .expect("insert question");

        let evidence = ResearchEvidence {
            id: "ev_restart_001".to_string(),
            project_id: proj_id.clone(),
            question_id: Some("q_restart_001".to_string()),
            source_title: "SQLite Database Architecture".to_string(),
            quote: "Readers read unmodified pages from the main DB or modified pages from the WAL index without taking write locks.".to_string(),
            notes: Some("Key insight into zero-blocking concurrency.".to_string()),
            stance: "supporting".to_string(),
            book_id: None,
            locator: None,
            created_at: Utc::now(),
        };
        research_repo
            .insert_evidence(&evidence)
            .expect("insert evidence");

        let draft = ResearchDraft {
            id: "draft_restart_001".to_string(),
            project_id: proj_id.clone(),
            title: "Zero-Loss Durability Synthesis".to_string(),
            content: "Draft synthesizes empirical findings on zero-loss durability.".to_string(),
            updated_at: Utc::now(),
        };
        research_repo.save_draft(&draft).expect("save draft");
    }

    // Session 2: Reopen brand new Database handle from same disk file
    {
        let db_reopened = Database::open(&db_path).expect("reopen db phase 2");
        let research_repo2 = ResearchRepository::new(db_reopened);

        let projects = research_repo2.list_projects().expect("list projects");
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].title, "Local-First Knowledge Architectures");

        let questions = research_repo2
            .list_questions_by_project(&proj_id)
            .expect("list questions");
        assert_eq!(questions.len(), 1);
        assert_eq!(
            questions[0].question,
            "How does WAL mode prevent readers from blocking writers?"
        );

        let evidence = research_repo2
            .list_evidence_by_project(&proj_id)
            .expect("list evidence");
        assert_eq!(evidence.len(), 1);
        assert!(evidence[0]
            .quote
            .contains("WAL index without taking write locks"));

        let draft = research_repo2
            .get_draft_by_project(&proj_id)
            .expect("get draft")
            .expect("draft exists");
        assert_eq!(
            draft.content,
            "Draft synthesizes empirical findings on zero-loss durability."
        );
    }
}

// ---------------------------------------------------------------------------
// 11. Reading Analytics Reflect Real Sessions
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_reading_analytics_reflect_real_sessions() {
    let tmp = tempdir().expect("tempdir");
    let db_path = tmp.path().join("luma_sessions.db");
    let db = Database::open(&db_path).expect("open on-disk db");
    let dev_id = DeviceId::new();

    let book = Book::new("Epistemology and Logic", dev_id);
    let book_repo = BookRepository::new(db.clone());
    book_repo.insert(&book).unwrap();

    let session_repo = ReadingSessionRepository::new(db.clone());

    // Start and Complete Session 1 (1800s = 30m, 10% -> 40%)
    let sess_id = SessionId::new();
    let sess = ReadingSession {
        id: sess_id,
        book_id: book.id,
        device_id: dev_id,
        started_at: Utc::now() - chrono::Duration::seconds(1800),
        ended_at: None,
        duration_seconds: 0,
        start_progress_pct: 10.0,
        end_progress_pct: 10.0,
    };
    session_repo.insert(&sess).expect("insert session");
    session_repo
        .complete_session(&sess_id, 40.0, 1800)
        .expect("complete session");

    // Fetch real analytics
    let analytics = session_repo.get_analytics().expect("get analytics");
    assert_eq!(analytics.total_reading_time_seconds, 1800);
    assert_eq!(analytics.weekly_reading_seconds, 1800);
    assert_eq!(analytics.recent_sessions.len(), 1);
    assert_eq!(
        analytics.recent_sessions[0].book_title,
        "Epistemology and Logic"
    );
    assert_eq!(analytics.recent_sessions[0].duration_seconds, 1800);

    // Verify 28-day calendar intensity reflects today's 30m
    let today_str = Utc::now().format("%Y-%m-%d").to_string();
    let today_cell = analytics
        .daily_reading_minutes_last_28_days
        .iter()
        .find(|c| c.date == today_str);
    assert!(
        today_cell.is_some(),
        "today's cell is present in 28-day calendar"
    );
    let cell = today_cell.unwrap();
    assert_eq!(cell.minutes, 30);
    assert!(cell.intensity >= 1, "intensity is positive for active day");
}

// ---------------------------------------------------------------------------
// 12 & 13. Backup Includes Knowledge & Restore Recovers Knowledge
// ---------------------------------------------------------------------------
#[tokio::test]
async fn test_runtime_matrix_backup_includes_knowledge_and_restore_recovers() {
    let tmp_src = tempdir().expect("tempdir src");
    let db_src_path = tmp_src.path().join("luma_src.db");
    let db_src = Database::open(&db_src_path).expect("open src db");
    let file_service_src = FileService::new(tmp_src.path());
    let event_bus_src = EventBus::default();

    let dev_id = DeviceId::new();
    let book = Book::new("Foundations of Geometry", dev_id);
    let book_repo = BookRepository::new(db_src.clone());
    book_repo.insert(&book).unwrap();

    let note_repo = NoteRepository::new(db_src.clone());
    note_repo
        .insert(&Note {
            id: "note_geom_1".to_string(),
            book_id: Some(book.id),
            annotation_id: None,
            source_type: "Book".to_string(),
            source_title: "Foundations of Geometry".to_string(),
            title: "Axiom of Parallels".to_string(),
            content: "Hilbert's reformulated incidence axioms.".to_string(),
            quote: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        })
        .unwrap();

    let card_repo = FlashcardRepository::new(db_src.clone());
    card_repo
        .insert(&Flashcard {
            id: "card_geom_1".to_string(),
            front: "State the five groups of Hilbert's axioms.".to_string(),
            back: "Incidence, Order, Congruence, Parallels, Continuity.".to_string(),
            source_book_id: Some(book.id),
            source_annotation_id: None,
            deck_id: "mathematics".to_string(),
            state: FlashcardState::Learning,
            interval_days: 1,
            ease_factor: 2.5,
            repetitions: 1,
            due_at: Utc::now(),
            last_reviewed_at: Some(Utc::now()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            is_deleted: false,
        })
        .unwrap();

    let session_repo = ReadingSessionRepository::new(db_src.clone());
    let sess_id = SessionId::new();
    session_repo
        .insert(&ReadingSession {
            id: sess_id,
            book_id: book.id,
            device_id: dev_id,
            started_at: Utc::now() - chrono::Duration::seconds(900),
            ended_at: Some(Utc::now()),
            duration_seconds: 900,
            start_progress_pct: 0.0,
            end_progress_pct: 25.0,
        })
        .unwrap();

    // Create Backup
    let backup_service_src = BackupService::new(db_src.clone(), file_service_src, event_bus_src);
    let record = backup_service_src
        .create_backup(Some("runtime_acceptance_backup"))
        .expect("create backup");
    assert!(Path::new(&record.file_path).exists());

    // Inspect Backup
    let preview = backup_service_src
        .inspect_backup(&record.file_path)
        .expect("inspect backup");
    assert_eq!(preview.manifest.notes_count, 1);
    assert_eq!(preview.manifest.flashcards_count, 1);
    assert_eq!(preview.manifest.reading_sessions_count, 1);

    // Restore into Fresh Destination Database
    let tmp_dest = tempdir().expect("tempdir dest");
    let db_dest_path = tmp_dest.path().join("luma_dest.db");
    let db_dest = Database::open(&db_dest_path).expect("open dest db");
    let file_service_dest = FileService::new(tmp_dest.path());
    let event_bus_dest = EventBus::default();
    let backup_service_dest =
        BackupService::new(db_dest.clone(), file_service_dest, event_bus_dest);

    backup_service_dest
        .restore_backup(&record.file_path)
        .expect("restore backup");

    // Verify Destination Database has all data
    let dest_note_repo = NoteRepository::new(db_dest.clone());
    let dest_notes = dest_note_repo.list_all().expect("list restored notes");
    assert_eq!(dest_notes.len(), 1);
    assert_eq!(dest_notes[0].title, "Axiom of Parallels");

    let dest_card_repo = FlashcardRepository::new(db_dest.clone());
    let dest_cards = dest_card_repo.list_all().expect("list restored cards");
    assert_eq!(dest_cards.len(), 1);
    assert_eq!(
        dest_cards[0].front,
        "State the five groups of Hilbert's axioms."
    );

    let dest_session_repo = ReadingSessionRepository::new(db_dest);
    let dest_analytics = dest_session_repo
        .get_analytics()
        .expect("get restored analytics");
    assert_eq!(dest_analytics.total_reading_time_seconds, 900);
}
