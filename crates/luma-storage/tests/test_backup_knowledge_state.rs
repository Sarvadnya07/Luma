use chrono::Utc;
use tempfile::tempdir;

use luma_core::ids::{DeviceId, SessionId};
use luma_core::models::book::Book;
use luma_core::models::knowledge::{
    Flashcard, FlashcardState, Note, ResearchDraft, ResearchEvidence, ResearchProject,
    ResearchQuestion, StudyReview,
};
use luma_core::models::reading::ReadingSession;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::repos::{
    BookRepository, FlashcardRepository, NoteRepository, ReadingSessionRepository,
    ResearchRepository, StudyReviewRepository,
};
use luma_storage::services::BackupService;

#[tokio::test]
async fn test_backup_and_restore_knowledge_and_sessions() {
    let db1 = Database::open_in_memory().expect("in-memory db1");
    let temp_lib1 = tempdir().unwrap();
    let file_service1 = FileService::new(temp_lib1.path());
    let event_bus1 = EventBus::default();

    let dev_id = DeviceId::new();
    let book = Book::new("Critique of Pure Reason", dev_id);
    let book_repo1 = BookRepository::new(db1.clone());
    book_repo1.insert(&book).expect("insert book");

    // 1. Insert Note
    let note_repo1 = NoteRepository::new(db1.clone());
    let note = Note {
        id: "note_kant_1".to_string(),
        book_id: Some(book.id),
        annotation_id: None,
        source_type: "Book".to_string(),
        source_title: "Critique of Pure Reason".to_string(),
        title: "Synthetic A Priori Judgments".to_string(),
        content: "Judgments whose predicate B belongs to subject A as something unthought in it..."
            .to_string(),
        quote: Some(
            "Thoughts without content are empty, intuitions without concepts are blind."
                .to_string(),
        ),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_deleted: false,
    };
    note_repo1.insert(&note).expect("insert note");

    // 2. Insert Flashcard
    let card_repo1 = FlashcardRepository::new(db1.clone());
    let card = Flashcard {
        id: "card_kant_1".to_string(),
        front: "What is transcendental idealism?".to_string(),
        back: "The doctrine that appearances are to be regarded as representations, not things in themselves.".to_string(),
        source_book_id: Some(book.id),
        source_annotation_id: None,
        deck_id: "KANTIAN EPISTEMOLOGY".to_string(),
        state: FlashcardState::Review,
        interval_days: 4,
        ease_factor: 2.6,
        repetitions: 2,
        due_at: Utc::now(),
        last_reviewed_at: Some(Utc::now()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_deleted: false,
    };
    card_repo1.insert(&card).expect("insert flashcard");

    // 3. Insert Study Review
    let rev_repo1 = StudyReviewRepository::new(db1.clone());
    let review = StudyReview {
        id: "rev_kant_1".to_string(),
        flashcard_id: "card_kant_1".to_string(),
        rating: 4,
        interval_before: 1,
        interval_after: 4,
        ease_factor: 2.6,
        reviewed_at: Utc::now(),
    };
    rev_repo1.insert(&review).expect("insert review");

    // 4. Insert Research Project, Question, Evidence, Draft
    let res_repo1 = ResearchRepository::new(db1.clone());
    let project = ResearchProject {
        id: "proj_epistemology".to_string(),
        title: "German Idealism & Transcendental Logic".to_string(),
        description: Some("Investigation into the synthetic a priori".to_string()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        is_deleted: false,
    };
    res_repo1.insert_project(&project).expect("insert project");

    let question = ResearchQuestion {
        id: "q_kant_1".to_string(),
        project_id: "proj_epistemology".to_string(),
        question: "How are synthetic a priori judgments possible in geometry?".to_string(),
        status: "answered".to_string(),
        created_at: Utc::now(),
    };
    res_repo1
        .insert_question(&question)
        .expect("insert question");

    let evidence = ResearchEvidence {
        id: "ev_kant_1".to_string(),
        project_id: "proj_epistemology".to_string(),
        question_id: Some("q_kant_1".to_string()),
        source_title: "Critique of Pure Reason, B40".to_string(),
        quote: "Space is not an empirical concept which has been derived from outer experiences."
            .to_string(),
        notes: Some("Pure intuition of space grounding Euclidean geometry".to_string()),
        stance: "supporting".to_string(),
        book_id: Some(book.id),
        locator: Some("epubcfi(/6/4)".to_string()),
        created_at: Utc::now(),
    };
    res_repo1
        .insert_evidence(&evidence)
        .expect("insert evidence");

    let draft = ResearchDraft {
        id: "draft_kant_1".to_string(),
        project_id: "proj_epistemology".to_string(),
        title: "The Spatial Form of Pure Intuition".to_string(),
        content: "Kant demonstrates that mathematical propositions are always synthetic..."
            .to_string(),
        updated_at: Utc::now(),
    };
    res_repo1.save_draft(&draft).expect("save draft");

    // 5. Insert Reading Session
    let sess_repo1 = ReadingSessionRepository::new(db1.clone());
    let mut session = ReadingSession::start(book.id, dev_id, 0.1);
    session.id = SessionId::new();
    session.complete(0.35);
    session.duration_seconds = 1800; // 30 minutes
    sess_repo1.insert(&session).expect("insert session");

    // Check pre-backup analytics
    let analytics1 = sess_repo1.get_analytics().expect("get analytics 1");
    assert_eq!(analytics1.total_reading_time_seconds, 1800);
    assert_eq!(analytics1.recent_sessions.len(), 1);
    assert_eq!(
        analytics1.recent_sessions[0].book_title,
        "Critique of Pure Reason"
    );

    // 6. Create Backup
    let backup_service1 = BackupService::new(db1, file_service1, event_bus1);
    let record = backup_service1
        .create_backup(Some("test_knowledge_backup"))
        .expect("create backup");

    assert_eq!(record.books_count, 1);

    let preview = backup_service1
        .inspect_backup(&record.file_path)
        .expect("inspect backup");

    assert_eq!(preview.manifest.version, 1);
    assert_eq!(preview.manifest.books_count, 1);
    assert_eq!(preview.manifest.notes_count, 1);
    assert_eq!(preview.manifest.flashcards_count, 1);
    assert_eq!(preview.manifest.research_projects_count, 1);
    assert_eq!(preview.manifest.reading_sessions_count, 1);

    // 7. Restore into Fresh Database (db2)
    let db2 = Database::open_in_memory().expect("in-memory db2");
    let temp_lib2 = tempdir().unwrap();
    let file_service2 = FileService::new(temp_lib2.path());
    let event_bus2 = EventBus::default();
    let backup_service2 = BackupService::new(db2.clone(), file_service2, event_bus2);

    let restored_manifest = backup_service2
        .restore_backup(&record.file_path)
        .expect("restore backup");

    assert_eq!(restored_manifest.notes_count, 1);
    assert_eq!(restored_manifest.reading_sessions_count, 1);

    // 8. Verify knowledge entities in restored DB
    let note_repo2 = NoteRepository::new(db2.clone());
    let restored_notes = note_repo2.list_all().expect("list restored notes");
    assert_eq!(restored_notes.len(), 1);
    assert_eq!(restored_notes[0].id, "note_kant_1");
    assert_eq!(restored_notes[0].title, "Synthetic A Priori Judgments");
    assert_eq!(
        restored_notes[0].quote.as_deref(),
        Some("Thoughts without content are empty, intuitions without concepts are blind.")
    );

    let card_repo2 = FlashcardRepository::new(db2.clone());
    let restored_cards = card_repo2.list_all().expect("list restored cards");
    assert_eq!(restored_cards.len(), 1);
    assert_eq!(restored_cards[0].id, "card_kant_1");
    assert_eq!(restored_cards[0].front, "What is transcendental idealism?");
    assert_eq!(restored_cards[0].deck_id, "KANTIAN EPISTEMOLOGY");

    let rev_repo2 = StudyReviewRepository::new(db2.clone());
    let review_count = rev_repo2.count_total().expect("count reviews");
    assert_eq!(review_count, 1);

    let res_repo2 = ResearchRepository::new(db2.clone());
    let restored_projects = res_repo2.list_projects().expect("list restored projects");
    assert_eq!(restored_projects.len(), 1);
    assert_eq!(restored_projects[0].id, "proj_epistemology");

    let restored_questions = res_repo2
        .list_questions_by_project("proj_epistemology")
        .expect("list questions");
    assert_eq!(restored_questions.len(), 1);
    assert_eq!(
        restored_questions[0].question,
        "How are synthetic a priori judgments possible in geometry?"
    );

    let restored_evidence = res_repo2
        .list_evidence_by_project("proj_epistemology")
        .expect("list evidence");
    assert_eq!(restored_evidence.len(), 1);
    assert_eq!(restored_evidence[0].id, "ev_kant_1");
    assert_eq!(restored_evidence[0].stance, "supporting");

    let restored_draft = res_repo2
        .get_draft_by_project("proj_epistemology")
        .expect("get draft");
    assert!(restored_draft.is_some());
    assert_eq!(
        restored_draft.unwrap().title,
        "The Spatial Form of Pure Intuition"
    );

    // 9. Verify reading session & analytics in restored DB
    let sess_repo2 = ReadingSessionRepository::new(db2.clone());
    let analytics2 = sess_repo2.get_analytics().expect("get analytics 2");
    assert_eq!(analytics2.total_reading_time_seconds, 1800);
    assert_eq!(analytics2.recent_sessions.len(), 1);
    assert_eq!(
        analytics2.recent_sessions[0].book_title,
        "Critique of Pure Reason"
    );
    assert_eq!(analytics2.recent_sessions[0].duration_seconds, 1800);
}
