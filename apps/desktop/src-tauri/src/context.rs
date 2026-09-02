use std::path::Path;
use tauri::{AppHandle, Emitter, Runtime};


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

// ============================================================================
// Constants – centralised messages and event names
// ============================================================================

const IN_MEMORY_DB_FAIL: &str = "Failed to initialize fallback in-memory database";
const SHUTDOWN_START_MSG: &str = "Initiating graceful shutdown of LumaAppContext...";
const SHUTDOWN_COMPLETE_MSG: &str = "LumaAppContext graceful shutdown complete.";

// Tauri event names
pub const EVENT_BOOK_IMPORTED: &str = "luma://library/book-imported";
pub const EVENT_BOOK_UPDATED: &str = "luma://library/book-updated";
pub const EVENT_LIBRARY_STATE_CHANGED: &str = "luma://library/state-changed";
pub const EVENT_ANNOTATION_CHANGED: &str = "luma://annotation/changed";
pub const EVENT_PROGRESS_CHANGED: &str = "luma://reading/progress-changed";
pub const EVENT_JOB_PROGRESS: &str = "luma://job/progress";
pub const EVENT_SETTINGS_CHANGED: &str = "luma://settings/changed";
pub const EVENT_BACKUP_COMPLETED: &str = "luma://backup/completed";
pub const EVENT_DOMAIN: &str = "luma://domain-event";

// ============================================================================
// Configuration
// ============================================================================

#[derive(Debug, Clone)]
pub struct LumaAppContextConfig {
    pub data_dir: std::path::PathBuf,
    pub db_filename: String,
}

impl LumaAppContextConfig {
    pub fn new(data_dir: impl AsRef<Path>) -> Self {
        Self {
            data_dir: data_dir.as_ref().to_path_buf(),
            db_filename: "luma.db".to_string(),
        }
    }

    pub fn db_path(&self) -> std::path::PathBuf {
        self.data_dir.join(&self.db_filename)
    }
}

// ============================================================================
// Application Context
// ============================================================================

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
    pub fn new(config: LumaAppContextConfig) -> Self {
        let db_path = config.db_path();
        let data_dir = config.data_dir;

        // Ensure data directory exists

        std::fs::create_dir_all(&data_dir)
            .expect("Failed to create data directory");

        // Open database, falling back to in-memory on failure
        let db = Database::open(&db_path).unwrap_or_else(|e| {
            tracing::warn!(
                "Failed to open database at {}: {}. Falling back to in-memory.",
                db_path.display(),
                e
            );
            Database::open_in_memory()
                .expect(IN_MEMORY_DB_FAIL)
        });


        let event_bus = EventBus::default();
        let file_service = FileService::new(&data_dir);
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
    pub fn spawn_event_bridge<R: Runtime>(&self, app: AppHandle<R>) {
        let mut rx = self.event_bus.subscribe();

        tauri::async_runtime::spawn(async move {
            while let Ok(event) = rx.recv().await {
                let event_name = match &event {
                    DomainEvent::BookImported { .. } => EVENT_BOOK_IMPORTED,
                    DomainEvent::BookUpdated { .. } => EVENT_BOOK_UPDATED,
                    DomainEvent::BookTrashed { .. }
                    | DomainEvent::BookRestored { .. }
                    | DomainEvent::BookDeleted { .. } => EVENT_LIBRARY_STATE_CHANGED,
                    DomainEvent::AnnotationCreated { .. }
                    | DomainEvent::AnnotationUpdated { .. }
                    | DomainEvent::AnnotationDeleted { .. } => EVENT_ANNOTATION_CHANGED,
                    DomainEvent::ReadingProgressChanged { .. } => EVENT_PROGRESS_CHANGED,
                    DomainEvent::JobProgressUpdated { .. }
                    | DomainEvent::JobCompleted { .. }
                    | DomainEvent::JobFailed { .. } => EVENT_JOB_PROGRESS,
                    DomainEvent::SettingsChanged { .. } => EVENT_SETTINGS_CHANGED,
                    DomainEvent::BackupCompleted { .. } => EVENT_BACKUP_COMPLETED,
                    _ => EVENT_DOMAIN,
                };
                let _ = app.emit(event_name, &event);
            }
        });
    }

    /// Perform clean shutdown: flush caches, cleanup staging, and checkpoint SQLite WAL
    pub fn shutdown(&self) {
        tracing::info!("{}", SHUTDOWN_START_MSG);
        let _ = self.file_service.cleanup_staging();
        let _ = self.db.with_conn(|conn| {
            let _ = conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", []);
            let _ = conn.execute("PRAGMA optimize;", []);
            Ok(())
        });
        tracing::info!("{}", SHUTDOWN_COMPLETE_MSG);
    }
}   