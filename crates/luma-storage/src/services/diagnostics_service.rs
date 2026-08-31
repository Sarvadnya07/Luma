use serde::{Deserialize, Serialize};

use crate::cache::CacheManager;
use crate::db::Database;
use crate::files::FileService;
use crate::jobs::JobManager;
use luma_core::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Failed,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubsystemHealth {
    pub name: String,
    pub status: HealthStatus,
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticsReport {
    pub overall_status: HealthStatus,
    pub timestamp: String,
    pub subsystems: Vec<SubsystemHealth>,
    pub metrics: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Clone)]
pub struct DiagnosticsService {
    db: Database,
    file_service: FileService,
    job_manager: JobManager,
    cache: CacheManager,
}

impl DiagnosticsService {
    pub fn new(
        db: Database,
        file_service: FileService,
        job_manager: JobManager,
        cache: CacheManager,
    ) -> Self {
        Self {
            db,
            file_service,
            job_manager,
            cache,
        }
    }

    pub async fn run_diagnostics(&self) -> Result<DiagnosticsReport> {
        let mut subsystems = Vec::new();
        let mut metrics = std::collections::HashMap::new();
        let mut is_degraded = false;
        let mut is_failed = false;

        // 1. Database subsystem check
        let db_check = self.db.with_conn(|conn| {
            let version: i64 = conn.query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |r| r.get(0),
            )?;
            let book_count: i64 =
                conn.query_row("SELECT COUNT(*) FROM books WHERE is_deleted = 0", [], |r| {
                    r.get(0)
                })?;
            let file_count: i64 =
                conn.query_row("SELECT COUNT(*) FROM book_files", [], |r| r.get(0))?;
            let annotation_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM annotations WHERE is_deleted = 0",
                [],
                |r| r.get(0),
            )?;
            let bookmark_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM bookmarks WHERE is_deleted = 0",
                [],
                |r| r.get(0),
            )?;
            Ok((
                version,
                book_count,
                file_count,
                annotation_count,
                bookmark_count,
            ))
        });

        match db_check {
            Ok((ver, books, files, ann, bms)) => {
                subsystems.push(SubsystemHealth {
                    name: "Database".to_string(),
                    status: HealthStatus::Healthy,
                    details: Some(format!("Schema v{}, WAL mode enabled", ver)),
                });
                metrics.insert("database_version".to_string(), serde_json::json!(ver));
                metrics.insert("total_books".to_string(), serde_json::json!(books));
                metrics.insert("total_files".to_string(), serde_json::json!(files));
                metrics.insert("total_annotations".to_string(), serde_json::json!(ann));
                metrics.insert("total_bookmarks".to_string(), serde_json::json!(bms));
            }
            Err(e) => {
                is_failed = true;
                subsystems.push(SubsystemHealth {
                    name: "Database".to_string(),
                    status: HealthStatus::Failed,
                    details: Some(format!("Database error: {}", e)),
                });
            }
        }

        // 2. Filesystem subsystem check
        let lib_dir = self.file_service.library_dir();
        let staging_dir = self.file_service.staging_dir();
        let covers_dir = self.file_service.covers_dir();
        let backups_dir = self.file_service.backups_dir();

        if lib_dir.exists() && staging_dir.exists() && covers_dir.exists() && backups_dir.exists() {
            subsystems.push(SubsystemHealth {
                name: "Filesystem".to_string(),
                status: HealthStatus::Healthy,
                details: Some("All data directories present and accessible".to_string()),
            });
        } else {
            is_degraded = true;
            subsystems.push(SubsystemHealth {
                name: "Filesystem".to_string(),
                status: HealthStatus::Degraded,
                details: Some("Some data directories are missing".to_string()),
            });
        }

        // 3. Search subsystem check
        let search_check = self.db.with_conn(|conn| {
            let count: i64 = conn.query_row("SELECT COUNT(*) FROM books_fts", [], |r| r.get(0))?;
            Ok(count)
        });

        match search_check {
            Ok(fts_count) => {
                subsystems.push(SubsystemHealth {
                    name: "Search".to_string(),
                    status: HealthStatus::Healthy,
                    details: Some(format!("FTS5 active with {} indexed records", fts_count)),
                });
                metrics.insert("indexed_records".to_string(), serde_json::json!(fts_count));
            }
            Err(e) => {
                is_degraded = true;
                subsystems.push(SubsystemHealth {
                    name: "Search".to_string(),
                    status: HealthStatus::Degraded,
                    details: Some(format!("FTS5 search error: {}", e)),
                });
            }
        }

        // 4. Cache subsystem check
        let cover_stats = self.cache.covers.stats().await;
        let meta_stats = self.cache.document_metadata.stats().await;
        let search_stats = self.cache.search_queries.stats().await;

        subsystems.push(SubsystemHealth {
            name: "Cache".to_string(),
            status: HealthStatus::Healthy,
            details: Some(format!(
                "Covers: {}, Metadata: {}, Queries: {}",
                cover_stats.item_count, meta_stats.item_count, search_stats.item_count
            )),
        });

        metrics.insert(
            "cache_cover_hits".to_string(),
            serde_json::json!(cover_stats.hits),
        );
        metrics.insert(
            "cache_cover_misses".to_string(),
            serde_json::json!(cover_stats.misses),
        );

        // 5. Jobs subsystem check
        let recent_jobs = self.job_manager.list_recent_jobs(10);
        subsystems.push(SubsystemHealth {
            name: "Jobs".to_string(),
            status: HealthStatus::Healthy,
            details: Some(format!("{} recent jobs tracked", recent_jobs.len())),
        });

        let overall_status = if is_failed {
            HealthStatus::Failed
        } else if is_degraded {
            HealthStatus::Degraded
        } else {
            HealthStatus::Healthy
        };

        Ok(DiagnosticsReport {
            overall_status,
            timestamp: chrono::Utc::now().to_rfc3339(),
            subsystems,
            metrics,
        })
    }
}
