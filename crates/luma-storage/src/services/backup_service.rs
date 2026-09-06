use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use luma_core::error::{LumaError, Result};
use luma_core::models::annotation::Annotation;
use luma_core::models::book::Book;
use luma_core::models::knowledge::{
    Flashcard, Note, ResearchDraft, ResearchEvidence, ResearchProject, ResearchQuestion,
    StudyReview,
};
use luma_core::models::reading::{Bookmark, ReadingProgress, ReadingSession};

use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::files::FileService;
use crate::repos::{
    AnnotationRepository, BackupRecord, BackupRecordRepository, BookRepository, BookmarkRepository,
    FlashcardRepository, NoteRepository, ReadingProgressRepository, ReadingSessionRepository,
    ResearchRepository, SettingsRepository, StudyReviewRepository,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub version: u32,
    pub created_at: String,
    pub books_count: usize,
    pub annotations_count: usize,
    pub bookmarks_count: usize,
    pub settings_count: usize,
    #[serde(default)]
    pub notes_count: usize,
    #[serde(default)]
    pub flashcards_count: usize,
    #[serde(default)]
    pub research_projects_count: usize,
    #[serde(default)]
    pub reading_sessions_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPreview {
    pub manifest: BackupManifest,
    pub file_size_bytes: u64,
    pub sha256_hash: String,
}

#[derive(Clone)]
pub struct BackupService {
    db: Database,
    file_service: FileService,
    event_bus: EventBus,
    record_repo: BackupRecordRepository,
}

impl BackupService {
    pub fn new(db: Database, file_service: FileService, event_bus: EventBus) -> Self {
        let record_repo = BackupRecordRepository::new(db.clone());
        Self {
            db,
            file_service,
            event_bus,
            record_repo,
        }
    }

    /// Create a verified local backup archive containing library metadata, annotations, bookmarks, progress, and settings
    pub fn create_backup(&self, backup_name_prefix: Option<&str>) -> Result<BackupRecord> {
        let now_str = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        let prefix = backup_name_prefix.unwrap_or("luma_backup");
        let filename = format!("{}_{}.luma-backup", prefix, now_str);
        let backup_path = self.file_service.backups_dir().join(&filename);

        // Fetch data from repositories
        let book_repo = BookRepository::new(self.db.clone());
        let ann_repo = AnnotationRepository::new(self.db.clone());
        let bm_repo = BookmarkRepository::new(self.db.clone());
        let prog_repo = ReadingProgressRepository::new(self.db.clone());
        let set_repo = SettingsRepository::new(self.db.clone());

        let books = book_repo
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let annotations = ann_repo
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let bookmarks = bm_repo
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let settings = set_repo
            .get_all_settings()
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // Fetch knowledge and session repositories
        let note_repo = NoteRepository::new(self.db.clone());
        let card_repo = FlashcardRepository::new(self.db.clone());
        let rev_repo = StudyReviewRepository::new(self.db.clone());
        let res_repo = ResearchRepository::new(self.db.clone());
        let sess_repo = ReadingSessionRepository::new(self.db.clone());

        let notes = note_repo.list_all().unwrap_or_default();
        let flashcards = card_repo.list_all().unwrap_or_default();
        let study_reviews = rev_repo.list_all().unwrap_or_default();
        let research_projects = res_repo.list_projects().unwrap_or_default();
        let research_questions = res_repo.list_all_questions().unwrap_or_default();
        let research_evidence = res_repo.list_all_evidence().unwrap_or_default();
        let research_drafts = res_repo.list_all_drafts().unwrap_or_default();
        let reading_sessions = sess_repo.list_all().unwrap_or_default();

        // Collect reading progress for all books
        let mut progress_list = Vec::new();
        for b in &books {
            if let Ok(Some(p)) = prog_repo.get(&b.id) {
                progress_list.push(p);
            }
        }

        let manifest = BackupManifest {
            version: 1,
            created_at: chrono::Utc::now().to_rfc3339(),
            books_count: books.len(),
            annotations_count: annotations.len(),
            bookmarks_count: bookmarks.len(),
            settings_count: settings.len(),
            notes_count: notes.len(),
            flashcards_count: flashcards.len(),
            research_projects_count: research_projects.len(),
            reading_sessions_count: reading_sessions.len(),
        };

        // Write ZIP archive
        let file = File::create(&backup_path)
            .map_err(|e| LumaError::StorageError(format!("Failed to create backup file: {}", e)))?;
        let mut zip = ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // 1. Manifest
        zip.start_file("manifest.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(serde_json::to_string_pretty(&manifest).unwrap().as_bytes())
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 2. Books
        zip.start_file("books.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(serde_json::to_string_pretty(&books).unwrap().as_bytes())
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 3. Annotations
        zip.start_file("annotations.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&annotations)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 4. Bookmarks
        zip.start_file("bookmarks.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(serde_json::to_string_pretty(&bookmarks).unwrap().as_bytes())
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 5. Reading Progress
        zip.start_file("reading_progress.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&progress_list)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 6. Settings
        zip.start_file("settings.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(serde_json::to_string_pretty(&settings).unwrap().as_bytes())
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 7. Notes
        zip.start_file("notes.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(serde_json::to_string_pretty(&notes).unwrap().as_bytes())
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 8. Flashcards & Study Reviews
        zip.start_file("flashcards.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&flashcards)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        zip.start_file("study_reviews.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&study_reviews)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 9. Research Projects, Questions, Evidence, Drafts
        zip.start_file("research_projects.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&research_projects)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        zip.start_file("research_questions.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&research_questions)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        zip.start_file("research_evidence.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&research_evidence)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        zip.start_file("research_drafts.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&research_drafts)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // 10. Reading Sessions
        zip.start_file("reading_sessions.json", options)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        zip.write_all(
            serde_json::to_string_pretty(&reading_sessions)
                .unwrap()
                .as_bytes(),
        )
        .map_err(|e| LumaError::StorageError(e.to_string()))?;

        zip.finish().map_err(|e| {
            LumaError::StorageError(format!("Failed to finalize backup ZIP: {}", e))
        })?;

        // Verify SHA-256 and size
        let (sha256_hash, file_size_bytes) = self.file_service.hash_file(&backup_path)?;

        let record = BackupRecord {
            id: format!("backup_{}", uuid::Uuid::new_v4().simple()),
            backup_name: filename,
            file_path: backup_path.to_string_lossy().to_string(),
            file_size_bytes,
            sha256_hash,
            books_count: books.len() as u32,
            annotations_count: annotations.len() as u32,
            bookmarks_count: bookmarks.len() as u32,
            created_at: manifest.created_at,
        };

        self.record_repo
            .insert(&record)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.event_bus.publish(DomainEvent::BackupCompleted {
            backup_id: record.id.clone(),
        });

        Ok(record)
    }

    /// List past backups
    pub fn list_backups(&self) -> Result<Vec<BackupRecord>> {
        self.record_repo
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    /// Inspect a backup archive without restoring
    pub fn inspect_backup<P: AsRef<Path>>(&self, backup_path: P) -> Result<BackupPreview> {
        let path = backup_path.as_ref();
        if !path.exists() {
            return Err(LumaError::NotFound {
                entity_type: "BackupFile".to_string(),
                id: path.to_string_lossy().to_string(),
            });
        }

        let (sha256_hash, file_size_bytes) = self.file_service.hash_file(path)?;
        let file = File::open(path).map_err(|e| LumaError::StorageError(e.to_string()))?;
        let mut zip = ZipArchive::new(file)
            .map_err(|e| LumaError::CorruptedDocument(format!("Invalid ZIP archive: {}", e)))?;

        let mut manifest_file = zip.by_name("manifest.json").map_err(|_| {
            LumaError::CorruptedDocument("Missing manifest.json in backup archive".to_string())
        })?;

        let mut manifest_str = String::new();
        manifest_file
            .read_to_string(&mut manifest_str)
            .map_err(|e| {
                LumaError::StorageError(format!("Failed to read backup manifest: {}", e))
            })?;

        let manifest: BackupManifest = serde_json::from_str(&manifest_str)
            .map_err(|e| LumaError::CorruptedDocument(format!("Invalid manifest format: {}", e)))?;

        Ok(BackupPreview {
            manifest,
            file_size_bytes,
            sha256_hash,
        })
    }

    /// Safely restore metadata, annotations, bookmarks, progress, and settings from backup
    pub fn restore_backup<P: AsRef<Path>>(&self, backup_path: P) -> Result<BackupManifest> {
        let preview = self.inspect_backup(backup_path.as_ref())?;
        let file =
            File::open(backup_path.as_ref()).map_err(|e| LumaError::StorageError(e.to_string()))?;
        let mut zip =
            ZipArchive::new(file).map_err(|e| LumaError::CorruptedDocument(e.to_string()))?;

        // 1. Read books
        if let Ok(mut f) = zip.by_name("books.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(books) = serde_json::from_str::<Vec<Book>>(&s) {
                    let repo = BookRepository::new(self.db.clone());
                    for b in books {
                        let _ = repo.insert(&b);
                    }
                }
            }
        }

        // 2. Read annotations
        if let Ok(mut f) = zip.by_name("annotations.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(annotations) = serde_json::from_str::<Vec<Annotation>>(&s) {
                    let repo = AnnotationRepository::new(self.db.clone());
                    for a in annotations {
                        let _ = repo.insert(&a);
                    }
                }
            }
        }

        // 3. Read bookmarks
        if let Ok(mut f) = zip.by_name("bookmarks.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(bookmarks) = serde_json::from_str::<Vec<Bookmark>>(&s) {
                    let repo = BookmarkRepository::new(self.db.clone());
                    for b in bookmarks {
                        let _ = repo.insert(&b);
                    }
                }
            }
        }

        // 4. Read reading progress
        if let Ok(mut f) = zip.by_name("reading_progress.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(progress_list) = serde_json::from_str::<Vec<ReadingProgress>>(&s) {
                    let repo = ReadingProgressRepository::new(self.db.clone());
                    for p in progress_list {
                        let _ = repo.save(&p);
                    }
                }
            }
        }

        // 5. Read settings
        if let Ok(mut f) = zip.by_name("settings.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(settings_map) =
                    serde_json::from_str::<std::collections::HashMap<String, serde_json::Value>>(&s)
                {
                    let repo = SettingsRepository::new(self.db.clone());
                    for (k, v) in settings_map {
                        let _ = repo.set_setting(&k, &v);
                    }
                }
            }
        }

        // 6. Read notes
        if let Ok(mut f) = zip.by_name("notes.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(notes) = serde_json::from_str::<Vec<Note>>(&s) {
                    let repo = NoteRepository::new(self.db.clone());
                    for n in notes {
                        let _ = repo.insert(&n);
                    }
                }
            }
        }

        // 7. Read flashcards & study reviews
        if let Ok(mut f) = zip.by_name("flashcards.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(cards) = serde_json::from_str::<Vec<Flashcard>>(&s) {
                    let repo = FlashcardRepository::new(self.db.clone());
                    for c in cards {
                        let _ = repo.insert(&c);
                    }
                }
            }
        }

        if let Ok(mut f) = zip.by_name("study_reviews.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(reviews) = serde_json::from_str::<Vec<StudyReview>>(&s) {
                    let repo = StudyReviewRepository::new(self.db.clone());
                    for r in reviews {
                        let _ = repo.insert(&r);
                    }
                }
            }
        }

        // 8. Read research entities
        if let Ok(mut f) = zip.by_name("research_projects.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(projects) = serde_json::from_str::<Vec<ResearchProject>>(&s) {
                    let repo = ResearchRepository::new(self.db.clone());
                    for p in projects {
                        let _ = repo.insert_project(&p);
                    }
                }
            }
        }

        if let Ok(mut f) = zip.by_name("research_questions.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(questions) = serde_json::from_str::<Vec<ResearchQuestion>>(&s) {
                    let repo = ResearchRepository::new(self.db.clone());
                    for q in questions {
                        let _ = repo.insert_question(&q);
                    }
                }
            }
        }

        if let Ok(mut f) = zip.by_name("research_evidence.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(evidence) = serde_json::from_str::<Vec<ResearchEvidence>>(&s) {
                    let repo = ResearchRepository::new(self.db.clone());
                    for e in evidence {
                        let _ = repo.insert_evidence(&e);
                    }
                }
            }
        }

        if let Ok(mut f) = zip.by_name("research_drafts.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(drafts) = serde_json::from_str::<Vec<ResearchDraft>>(&s) {
                    let repo = ResearchRepository::new(self.db.clone());
                    for d in drafts {
                        let _ = repo.save_draft(&d);
                    }
                }
            }
        }

        // 9. Read reading sessions
        if let Ok(mut f) = zip.by_name("reading_sessions.json") {
            let mut s = String::new();
            if f.read_to_string(&mut s).is_ok() {
                if let Ok(sessions) = serde_json::from_str::<Vec<ReadingSession>>(&s) {
                    let repo = ReadingSessionRepository::new(self.db.clone());
                    for sess in sessions {
                        let _ = repo.insert(&sess);
                    }
                }
            }
        }

        Ok(preview.manifest)
    }
}
