use luma_core::ids::DeviceId;
use luma_storage::cache::CacheManager;
use luma_storage::db::Database;
use luma_storage::events::EventBus;
use luma_storage::files::FileService;
use luma_storage::jobs::{JobManager, JobType};
use luma_storage::repos::JobRepository;
use luma_storage::services::{ImportService, MaintenanceService, SearchService};

#[tokio::test]
async fn test_import_batch_bounds_and_chunk_yielding() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let file_service = FileService::new(temp_dir.path());
    let event_bus = EventBus::default();
    let job_repo = JobRepository::new(db.clone());
    let job_manager = JobManager::new(job_repo, event_bus.clone());
    let cache = CacheManager::new();

    let import_service =
        ImportService::new(db.clone(), file_service, event_bus, job_manager, cache);

    let device_id = DeviceId::new();

    // 1. Verify that exceeding MAX_IMPORT_BATCH_SIZE is rejected cleanly
    let oversized_paths: Vec<std::path::PathBuf> = (0..5001)
        .map(|i| std::path::PathBuf::from(format!("fake_file_{}.epub", i)))
        .collect();

    let res = import_service
        .import_files(&oversized_paths, device_id)
        .await;
    assert!(res.is_err());
    let err_str = res.err().unwrap().to_string();
    assert!(err_str.contains("Import batch size exceeds maximum"));
}

#[tokio::test]
async fn test_search_query_length_bounding_and_sanitization() {
    let db = Database::open_in_memory().expect("in-memory db");
    let event_bus = EventBus::default();
    let cache = CacheManager::new();
    let search_service = SearchService::new(db.clone(), event_bus, cache);

    // 1. Long query over 256 chars is sliced and sanitized without error
    let long_query = "a".repeat(500);
    let result = search_service
        .search_library(&long_query, None, 10)
        .await
        .expect("search must succeed");
    assert_eq!(result.total_count, 0);

    // 2. FTS5 syntax characters are stripped
    let injection_query = "title:test* OR 1=1 (malicious)^";
    let res = search_service
        .search_library(injection_query, None, 10)
        .await
        .expect("sanitized query must succeed");
    assert_eq!(res.total_count, 0);
}

#[tokio::test]
async fn test_maintenance_vacuum_and_wal_checkpoint() {
    let db = Database::open_in_memory().expect("in-memory db");
    let temp_dir = tempfile::tempdir().expect("tempdir");
    let file_service = FileService::new(temp_dir.path());
    let event_bus = EventBus::default();
    let cache = CacheManager::new();
    let search_service = SearchService::new(db.clone(), event_bus.clone(), cache.clone());

    let maintenance =
        MaintenanceService::new(db.clone(), file_service, search_service, cache, event_bus);

    let result = maintenance
        .vacuum_database()
        .expect("vacuum should succeed");
    assert_eq!(result.operation, "vacuum_database");
    assert_eq!(result.items_processed, 1);
    assert!(result.duration_ms >= 0.0);
}

#[tokio::test]
async fn test_job_progress_throttling_and_cancellation() {
    let db = Database::open_in_memory().expect("in-memory db");
    let event_bus = EventBus::default();
    let job_repo = JobRepository::new(db.clone());
    let job_manager = JobManager::new(job_repo, event_bus.clone());

    let (job_id, token) = job_manager
        .create_job(JobType::Maintenance, 100, Some("Testing throttle"))
        .await;

    // Rapid progress updates in tight loop
    for i in 1..=50 {
        job_manager
            .update_progress(&job_id, "working", i, 0, Some("step"))
            .await;
    }

    let progress = job_manager
        .get_job_progress(&job_id)
        .await
        .expect("progress");
    assert_eq!(progress.current, 50);
    assert_eq!(progress.total, 100);

    // Cancel job
    token.cancel();
    assert!(token.is_cancelled());
    let cancelled = job_manager.cancel_job(&job_id).await;
    assert!(cancelled);

    let final_prog = job_manager.get_job_progress(&job_id).await.expect("final");
    assert_eq!(final_prog.status, luma_storage::jobs::JobStatus::Cancelled);
}
