use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::FileAvailability;

use crate::cache::CacheManager;
use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::files::FileService;
use crate::repos::BookFileRepository;
use crate::services::SearchService;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceResult {
    pub operation: String,
    pub items_processed: usize,
    pub duration_ms: f64,
    pub message: String,
}

#[derive(Clone)]
pub struct MaintenanceService {
    db: Database,
    file_service: FileService,
    search_service: SearchService,
    cache: CacheManager,
    event_bus: EventBus,
}

impl MaintenanceService {
    pub fn new(
        db: Database,
        file_service: FileService,
        search_service: SearchService,
        cache: CacheManager,
        event_bus: EventBus,
    ) -> Self {
        Self {
            db,
            file_service,
            search_service,
            cache,
            event_bus,
        }
    }

    /// Reconcile file availability against the filesystem
    pub fn reconcile_files(&self) -> Result<MaintenanceResult> {
        let start = std::time::Instant::now();
        let file_repo = BookFileRepository::new(self.db.clone());
        let files = file_repo
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let mut updated = 0;

        for file in files {
            let path = Path::new(&file.relative_path);
            let new_avail = if !path.exists() {
                FileAvailability::Missing
            } else if let Ok(meta) = fs::metadata(path) {
                if meta.len() != file.file_size_bytes {
                    FileAvailability::Changed
                } else {
                    FileAvailability::Available
                }
            } else {
                FileAvailability::Invalid
            };

            if new_avail != file.availability
                && file_repo.update_availability(&file.id, new_avail).is_ok()
            {
                updated += 1;
            }
        }

        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;
        self.event_bus.publish(DomainEvent::LibraryReconciled {
            reconciled_count: updated,
        });

        Ok(MaintenanceResult {
            operation: "reconcile_files".to_string(),
            items_processed: updated,
            duration_ms,
            message: format!("Reconciled files: {} status updates made", updated),
        })
    }

    /// Rebuild search index
    pub async fn rebuild_search_index(&self) -> Result<MaintenanceResult> {
        let start = std::time::Instant::now();
        let count = self.search_service.rebuild_index().await?;
        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(MaintenanceResult {
            operation: "rebuild_search_index".to_string(),
            items_processed: count,
            duration_ms,
            message: format!("FTS5 search index rebuilt with {} books", count),
        })
    }

    /// Clean memory caches and staging area
    pub async fn cleanup_caches(&self) -> Result<MaintenanceResult> {
        let start = std::time::Instant::now();
        self.cache.clear_all().await;
        let staged_cleaned = self.file_service.cleanup_staging().unwrap_or(0);
        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(MaintenanceResult {
            operation: "cleanup_caches".to_string(),
            items_processed: staged_cleaned,
            duration_ms,
            message: format!(
                "In-memory caches cleared, {} staging files removed",
                staged_cleaned
            ),
        })
    }

    /// Run SQLite VACUUM and optimize
    pub fn vacuum_database(&self) -> Result<MaintenanceResult> {
        let start = std::time::Instant::now();
        self.db
            .with_conn(|conn| {
                conn.execute("PRAGMA optimize;", [])?;
                conn.execute("VACUUM;", [])?;
                Ok(())
            })
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

        Ok(MaintenanceResult {
            operation: "vacuum_database".to_string(),
            items_processed: 1,
            duration_ms,
            message: "Database VACUUM and optimization executed successfully".to_string(),
        })
    }
}
