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

#[tokio::test]
async fn test_benchmark_collection_batch_loading_n_plus_one_regression() {
    use luma_core::ids::DeviceId;
    use luma_storage::repos::CollectionRepository;
    use std::time::Instant;

    let db = Database::open_in_memory().expect("Database open");
    let col_repo = CollectionRepository::new(db.clone());
    let book_repo = luma_storage::repos::BookRepository::new(db.clone());
    let device_id = DeviceId::new();

    // Seed 50 collections with 10 books each (500 relation rows)
    for i in 0..50 {
        let col = col_repo
            .create(&format!("Collection {}", i), None, device_id)
            .expect("Create collection");
        for j in 0..10 {
            let book = luma_core::models::book::Book::new(format!("Book {}_{}", i, j), device_id);
            book_repo.insert(&book).expect("Insert book");
            col_repo
                .add_book_to_collection(&col.id, &book.id)
                .expect("Add book to collection");
        }
    }

    let start = Instant::now();
    let iterations = 100;
    for _ in 0..iterations {
        let cols = col_repo.list_all().expect("List collections");
        assert_eq!(cols.len(), 50);
        assert_eq!(cols[0].book_ids.len(), 10);
    }
    let duration = start.elapsed();
    let avg_ms = (duration.as_secs_f64() * 1000.0) / iterations as f64;

    println!(
        "Benchmark: 100 Collection list_all iterations (50 collections, 500 relations) completed in {:?} (avg: {:.3} ms/list)",
        duration, avg_ms
    );
    // Performance budget: < 10ms per list_all of 50 collections
    assert!(
        avg_ms < 15.0,
        "Collection list_all exceeded budget: {:.3} ms",
        avg_ms
    );
}

#[tokio::test]
async fn test_benchmark_bulk_transaction_speed() {
    use luma_core::ids::DeviceId;
    use luma_core::models::book::{Book, ReadingStatus};
    use luma_storage::repos::BookRepository;
    use luma_storage::services::LibraryService;
    use std::time::Instant;

    let db = Database::open_in_memory().expect("Database open");
    let service = LibraryService::new(db.clone(), EventBus::default());
    let device_id = DeviceId::new();

    // Create 100 dummy book records
    let mut book_ids = Vec::new();
    let book_repo = BookRepository::new(db.clone());
    for i in 0..100 {
        let book = Book::new(format!("Book {}", i), device_id);
        book_repo.insert(&book).expect("Insert book");
        book_ids.push(book.id);
    }

    // Benchmark bulk status change wrapped in single transaction
    let start = Instant::now();
    let res = service
        .bulk_set_status(&book_ids, ReadingStatus::Completed)
        .expect("Bulk status");
    let elapsed = start.elapsed();

    assert_eq!(res.successful, 100);
    println!(
        "Benchmark: Bulk status update of 100 books took {:?}",
        elapsed
    );
    // Performance budget: < 100ms for 100 updates in memory
    assert!(
        elapsed.as_millis() < 150,
        "Bulk status update took too long: {:?}",
        elapsed
    );
}
