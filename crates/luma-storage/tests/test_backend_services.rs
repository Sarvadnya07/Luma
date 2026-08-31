use tempfile::tempdir;

use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::{JobManager, JobType};
use luma_storage::repos::JobRepository;
use luma_storage::services::{
    BackupService, DiagnosticsService, MaintenanceService, SearchService, SettingsService,
};

#[tokio::test]
async fn test_settings_service_operations() {
    let db = Database::open_in_memory().expect("in-memory db");
    let event_bus = EventBus::default();
    let service = SettingsService::new(db, event_bus);

    service
        .set_setting("theme", &serde_json::json!("nord"))
        .expect("set setting");

    let val = service.get_setting("theme").expect("get setting");
    assert_eq!(val, Some(serde_json::json!("nord")));

    let all = service.get_all_settings().expect("get all");
    assert_eq!(all.get("theme"), Some(&serde_json::json!("nord")));
}

#[tokio::test]
async fn test_diagnostics_service() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_lib = tempdir().unwrap();
    let file_service = FileService::new(temp_lib.path());
    let event_bus = EventBus::default();
    let job_repo = JobRepository::new(db.clone());
    let job_manager = JobManager::new(job_repo, event_bus);
    let cache = CacheManager::new();

    let diag = DiagnosticsService::new(db, file_service, job_manager, cache);
    let report = diag.run_diagnostics().await.expect("diagnostics run");

    assert_eq!(
        report.overall_status,
        luma_storage::services::HealthStatus::Healthy
    );
    assert_eq!(report.subsystems.len(), 5);
}

#[tokio::test]
async fn test_backup_and_inspect_service() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_lib = tempdir().unwrap();
    let file_service = FileService::new(temp_lib.path());
    let event_bus = EventBus::default();

    let backup_service = BackupService::new(db, file_service, event_bus);

    let record = backup_service
        .create_backup(Some("test_snapshot"))
        .expect("create backup");

    assert!(record.backup_name.starts_with("test_snapshot"));
    assert!(record.file_size_bytes > 0);
    assert_eq!(record.sha256_hash.len(), 64);

    let preview = backup_service
        .inspect_backup(&record.file_path)
        .expect("inspect backup");

    assert_eq!(preview.manifest.version, 1);
    assert_eq!(preview.sha256_hash, record.sha256_hash);

    let backups = backup_service.list_backups().expect("list backups");
    assert_eq!(backups.len(), 1);
    assert_eq!(backups[0].id, record.id);
}

#[tokio::test]
async fn test_maintenance_service() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_lib = tempdir().unwrap();
    let file_service = FileService::new(temp_lib.path());
    let event_bus = EventBus::default();
    let cache = CacheManager::new();
    let search_service = SearchService::new(db.clone(), event_bus.clone(), cache.clone());

    let maintenance = MaintenanceService::new(db, file_service, search_service, cache, event_bus);

    let reconcile = maintenance.reconcile_files().expect("reconcile");
    assert_eq!(reconcile.operation, "reconcile_files");

    let clean = maintenance.cleanup_caches().await.expect("cleanup");
    assert_eq!(clean.operation, "cleanup_caches");

    let vac = maintenance.vacuum_database().expect("vacuum");
    assert_eq!(vac.operation, "vacuum_database");
}

#[tokio::test]
async fn test_job_manager_lifecycle_and_cancellation() {
    let db = Database::open_in_memory().expect("in-memory db");
    let event_bus = EventBus::default();
    let job_repo = JobRepository::new(db);
    let job_manager = JobManager::new(job_repo, event_bus);

    let (job_id, cancellation) = job_manager
        .create_job(JobType::Import, 10, Some("Batch import"))
        .await;

    assert!(!cancellation.is_cancelled());

    job_manager
        .update_progress(&job_id, "Processing", 3, 0, Some("file_3.epub"))
        .await;

    let progress = job_manager
        .get_job_progress(&job_id)
        .await
        .expect("job progress");

    assert_eq!(progress.current, 3);
    assert_eq!(progress.total, 10);
    assert_eq!(progress.percent, 30.0);

    let cancelled = job_manager.cancel_job(&job_id).await;
    assert!(cancelled);
    assert!(cancellation.is_cancelled());

    let updated_progress = job_manager
        .get_job_progress(&job_id)
        .await
        .expect("progress after cancel");
    assert_eq!(
        updated_progress.status,
        luma_storage::jobs::JobStatus::Cancelled
    );
}
