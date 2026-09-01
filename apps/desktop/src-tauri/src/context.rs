use std::path::Path;
use tauri::{AppHandle, Emitter};

use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::{DomainEvent, EventBus};
use luma_storage::files::FileService;
use luma_storage::jobs::JobManager;
use luma_storage::repos::JobRepository;
use luma_storage::services::{
    AnnotationService, BackupService, BookService, BookmarkService, DiagnosticsService,
    ImportService, LibraryService, MaintenanceService, ReaderService, ReadingProgressService,
    SearchService, SettingsService,
};

#[derive(Clone)]
pub struct LumaAppContext {
    pub db: Database,
    pub event_bus: EventBus,
    #[allow(dead_code)]
    pub file_service: FileService,
    pub cover_store: luma_reader::cover::CoverStore,
    pub job_manager: JobManager,
    #[allow(dead_code)]
    pub cache: CacheManager,

    pub library_service: LibraryService,
    pub book_service: BookService,
    pub import_service: ImportService,
    pub reader_service: ReaderService,
    pub progress_service: ReadingProgressService,
    pub bookmark_service: BookmarkService,
    pub annotation_service: AnnotationService,
    pub search_service: SearchService,
    pub settings_service: SettingsService,
    pub backup_service: BackupService,
    pub maintenance_service: MaintenanceService,
    pub diagnostics_service: DiagnosticsService,
}

impl LumaAppContext {
    pub fn new<P: AsRef<Path>>(data_dir: P) -> Self {
        let data_path = data_dir.as_ref().to_path_buf();
        let _ = std::fs::create_dir_all(&data_path);
        let db_path = data_path.join("luma.db");

        let db = Database::open(&db_path).unwrap_or_else(|e| {
            tracing::warn!(
                "Failed to open persistent SQLite at {}: {}. Falling back to in-memory.",
                db_path.display(),
                e
            );
            Database::open_in_memory().expect("Failed to initialize fallback database")
        });

        let event_bus = EventBus::default();
        let file_service = FileService::new(&data_path);
        let cover_store = luma_reader::cover::CoverStore::new(file_service.covers_dir());
        let cache = CacheManager::new();

        let job_repo = JobRepository::new(db.clone());
        let job_manager = JobManager::new(job_repo, event_bus.clone());

        let library_service = LibraryService::new(db.clone(), event_bus.clone());
        let book_service = BookService::new(db.clone(), event_bus.clone(), cache.clone());
        let import_service = ImportService::new(
            db.clone(),
            file_service.clone(),
            event_bus.clone(),
            job_manager.clone(),
            cache.clone(),
        );
        let reader_service = ReaderService::new(db.clone(), cache.clone());
        let progress_service = ReadingProgressService::new(db.clone(), event_bus.clone());
        let bookmark_service = BookmarkService::new(db.clone(), event_bus.clone());
        let annotation_service =
            AnnotationService::new(db.clone(), event_bus.clone(), cache.clone());
        let search_service = SearchService::new(db.clone(), event_bus.clone(), cache.clone());
        let settings_service = SettingsService::new(db.clone(), event_bus.clone());
        let backup_service =
            BackupService::new(db.clone(), file_service.clone(), event_bus.clone());
        let maintenance_service = MaintenanceService::new(
            db.clone(),
            file_service.clone(),
            search_service.clone(),
            cache.clone(),
            event_bus.clone(),
        );
        let diagnostics_service = DiagnosticsService::new(
            db.clone(),
            file_service.clone(),
            job_manager.clone(),
            cache.clone(),
        );

        Self {
            db,
            event_bus,
            file_service,
            cover_store,
            job_manager,
            cache,
            library_service,
            book_service,
            import_service,
            reader_service,
            progress_service,
            bookmark_service,
            annotation_service,
            search_service,
            settings_service,
            backup_service,
            maintenance_service,
            diagnostics_service,
        }
    }

    /// Spawn background bridge forwarding internal domain events to Tauri webview events
    pub fn spawn_event_bridge(&self, app: AppHandle) {
        let mut rx = self.event_bus.subscribe();
        tauri::async_runtime::spawn(async move {
            while let Ok(event) = rx.recv().await {
                match &event {
                    DomainEvent::BookImported { .. } => {
                        let _ = app.emit("luma://library/book-imported", &event);
                    }
                    DomainEvent::BookUpdated { .. } => {
                        let _ = app.emit("luma://library/book-updated", &event);
                    }
                    DomainEvent::BookTrashed { .. }
                    | DomainEvent::BookRestored { .. }
                    | DomainEvent::BookDeleted { .. } => {
                        let _ = app.emit("luma://library/state-changed", &event);
                    }
                    DomainEvent::AnnotationCreated { .. }
                    | DomainEvent::AnnotationUpdated { .. }
                    | DomainEvent::AnnotationDeleted { .. } => {
                        let _ = app.emit("luma://annotation/changed", &event);
                    }
                    DomainEvent::ReadingProgressChanged { .. } => {
                        let _ = app.emit("luma://reading/progress-changed", &event);
                    }
                    DomainEvent::JobProgressUpdated { .. }
                    | DomainEvent::JobCompleted { .. }
                    | DomainEvent::JobFailed { .. } => {
                        let _ = app.emit("luma://job/progress", &event);
                    }
                    DomainEvent::SettingsChanged { .. } => {
                        let _ = app.emit("luma://settings/changed", &event);
                    }
                    DomainEvent::BackupCompleted { .. } => {
                        let _ = app.emit("luma://backup/completed", &event);
                    }
                    _ => {
                        let _ = app.emit("luma://domain-event", &event);
                    }
                }
            }
        });
    }
}
