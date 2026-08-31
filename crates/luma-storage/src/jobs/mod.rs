use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::events::{DomainEvent, EventBus};
use crate::repos::{JobProgressUpdate, JobRecord, JobRepository, PersistentJobStatus};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum JobType {
    Import,
    DirectoryScan,
    FileReconciliation,
    IndexRebuild,
    Backup,
    Restore,
    Maintenance,
    Other(String),
}

impl std::fmt::Display for JobType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            JobType::Import => write!(f, "import"),
            JobType::DirectoryScan => write!(f, "directory_scan"),
            JobType::FileReconciliation => write!(f, "file_reconciliation"),
            JobType::IndexRebuild => write!(f, "index_rebuild"),
            JobType::Backup => write!(f, "backup"),
            JobType::Restore => write!(f, "restore"),
            JobType::Maintenance => write!(f, "maintenance"),
            JobType::Other(s) => write!(f, "{}", s),
        }
    }
}

impl std::str::FromStr for JobType {
    type Err = std::convert::Infallible;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "import" => Ok(JobType::Import),
            "directory_scan" => Ok(JobType::DirectoryScan),
            "file_reconciliation" => Ok(JobType::FileReconciliation),
            "index_rebuild" => Ok(JobType::IndexRebuild),
            "backup" => Ok(JobType::Backup),
            "restore" => Ok(JobType::Restore),
            "maintenance" => Ok(JobType::Maintenance),
            other => Ok(JobType::Other(other.to_string())),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum JobStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl From<PersistentJobStatus> for JobStatus {
    fn from(p: PersistentJobStatus) -> Self {
        match p {
            PersistentJobStatus::Queued => JobStatus::Queued,
            PersistentJobStatus::Running => JobStatus::Running,
            PersistentJobStatus::Paused => JobStatus::Paused,
            PersistentJobStatus::Completed => JobStatus::Completed,
            PersistentJobStatus::Failed => JobStatus::Failed,
            PersistentJobStatus::Cancelled => JobStatus::Cancelled,
        }
    }
}

impl From<JobStatus> for PersistentJobStatus {
    fn from(s: JobStatus) -> Self {
        match s {
            JobStatus::Queued => PersistentJobStatus::Queued,
            JobStatus::Running => PersistentJobStatus::Running,
            JobStatus::Paused => PersistentJobStatus::Paused,
            JobStatus::Completed => PersistentJobStatus::Completed,
            JobStatus::Failed => PersistentJobStatus::Failed,
            JobStatus::Cancelled => PersistentJobStatus::Cancelled,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub job_id: String,
    pub job_type: String,
    pub stage: String,
    pub current: u32,
    pub total: u32,
    pub percent: f64,
    pub message: Option<String>,
    pub status: JobStatus,
}

#[derive(Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}

impl CancellationToken {
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

#[derive(Clone)]
pub struct ActiveJobState {
    pub id: String,
    pub job_type: JobType,
    pub status: JobStatus,
    pub total_units: u32,
    pub completed_units: u32,
    pub failed_units: u32,
    pub stage: String,
    pub message: Option<String>,
    pub cancellation_token: CancellationToken,
}

#[derive(Clone)]
pub struct JobManager {
    repo: JobRepository,
    event_bus: EventBus,
    active_jobs: Arc<RwLock<HashMap<String, ActiveJobState>>>,
}

impl JobManager {
    pub fn new(repo: JobRepository, event_bus: EventBus) -> Self {
        Self {
            repo,
            event_bus,
            active_jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create and register a new job
    pub async fn create_job(
        &self,
        job_type: JobType,
        total_units: u32,
        message: Option<&str>,
    ) -> (String, CancellationToken) {
        let id = format!("job_{}", uuid::Uuid::new_v4().simple());
        let cancellation_token = CancellationToken::new();

        let state = ActiveJobState {
            id: id.clone(),
            job_type: job_type.clone(),
            status: JobStatus::Queued,
            total_units,
            completed_units: 0,
            failed_units: 0,
            stage: "queued".to_string(),
            message: message.map(|s| s.to_string()),
            cancellation_token: cancellation_token.clone(),
        };

        {
            let mut lock = self.active_jobs.write().await;
            lock.insert(id.clone(), state);
        }

        let now = chrono::Utc::now().to_rfc3339();
        let record = JobRecord {
            id: id.clone(),
            job_type: job_type.to_string(),
            status: PersistentJobStatus::Queued,
            total_units,
            completed_units: 0,
            failed_units: 0,
            message: message.map(|s| s.to_string()),
            error_details: None,
            payload_json: None,
            created_at: now.clone(),
            updated_at: now,
            ended_at: None,
        };

        let _ = self.repo.insert(&record);

        self.event_bus.publish(DomainEvent::JobProgressUpdated {
            job_id: id.clone(),
            job_type: job_type.to_string(),
            status: "queued".to_string(),
            completed: 0,
            total: total_units,
            message: message.map(|s| s.to_string()),
        });

        (id, cancellation_token)
    }

    /// Mark job as running and update progress stage
    pub async fn update_progress(
        &self,
        job_id: &str,
        stage: &str,
        completed: u32,
        failed: u32,
        message: Option<&str>,
    ) {
        let mut job_type_str = "unknown".to_string();
        let mut total = 0;

        {
            let mut lock = self.active_jobs.write().await;
            if let Some(state) = lock.get_mut(job_id) {
                state.status = JobStatus::Running;
                state.stage = stage.to_string();
                state.completed_units = completed;
                state.failed_units = failed;
                state.message = message.map(|s| s.to_string());
                job_type_str = state.job_type.to_string();
                total = state.total_units;
            }
        }

        let _ = self.repo.update_progress(
            job_id,
            JobProgressUpdate {
                status: PersistentJobStatus::Running,
                completed_units: completed,
                failed_units: failed,
                message,
                error_details: None,
                ended_at: None,
            },
        );

        self.event_bus.publish(DomainEvent::JobProgressUpdated {
            job_id: job_id.to_string(),
            job_type: job_type_str,
            status: "running".to_string(),
            completed,
            total,
            message: message.map(|s| s.to_string()),
        });
    }

    /// Mark job as completed
    pub async fn complete_job(&self, job_id: &str, message: Option<&str>) {
        let mut job_type_str = "unknown".to_string();
        let mut completed = 0;
        let mut total = 0;

        {
            let mut lock = self.active_jobs.write().await;
            if let Some(state) = lock.get_mut(job_id) {
                state.status = JobStatus::Completed;
                state.stage = "completed".to_string();
                state.message = message.map(|s| s.to_string());
                job_type_str = state.job_type.to_string();
                completed = state.completed_units;
                total = state.total_units;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        let _ = self.repo.update_progress(
            job_id,
            JobProgressUpdate {
                status: PersistentJobStatus::Completed,
                completed_units: completed,
                failed_units: 0,
                message,
                error_details: None,
                ended_at: Some(&now),
            },
        );

        self.event_bus.publish(DomainEvent::JobCompleted {
            job_id: job_id.to_string(),
            job_type: job_type_str.clone(),
        });

        self.event_bus.publish(DomainEvent::JobProgressUpdated {
            job_id: job_id.to_string(),
            job_type: job_type_str,
            status: "completed".to_string(),
            completed: if total > 0 { total } else { completed },
            total,
            message: message.map(|s| s.to_string()),
        });
    }

    /// Mark job as failed
    pub async fn fail_job(&self, job_id: &str, error: &str) {
        let mut job_type_str = "unknown".to_string();
        let mut completed = 0;
        let mut failed = 1;
        let mut total = 0;

        {
            let mut lock = self.active_jobs.write().await;
            if let Some(state) = lock.get_mut(job_id) {
                state.status = JobStatus::Failed;
                state.stage = "failed".to_string();
                state.message = Some(error.to_string());
                job_type_str = state.job_type.to_string();
                completed = state.completed_units;
                failed = state.failed_units.max(1);
                total = state.total_units;
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        let _ = self.repo.update_progress(
            job_id,
            JobProgressUpdate {
                status: PersistentJobStatus::Failed,
                completed_units: completed,
                failed_units: failed,
                message: Some(error),
                error_details: Some(error),
                ended_at: Some(&now),
            },
        );

        self.event_bus.publish(DomainEvent::JobFailed {
            job_id: job_id.to_string(),
            job_type: job_type_str.clone(),
            error: error.to_string(),
        });

        self.event_bus.publish(DomainEvent::JobProgressUpdated {
            job_id: job_id.to_string(),
            job_type: job_type_str,
            status: "failed".to_string(),
            completed,
            total,
            message: Some(error.to_string()),
        });
    }

    /// Cancel a running job cooperatively
    pub async fn cancel_job(&self, job_id: &str) -> bool {
        let mut job_type_str = "unknown".to_string();
        let mut found = false;

        {
            let mut lock = self.active_jobs.write().await;
            if let Some(state) = lock.get_mut(job_id) {
                state.cancellation_token.cancel();
                state.status = JobStatus::Cancelled;
                state.stage = "cancelled".to_string();
                job_type_str = state.job_type.to_string();
                found = true;
            }
        }

        if found {
            let now = chrono::Utc::now().to_rfc3339();
            let _ = self.repo.update_progress(
                job_id,
                JobProgressUpdate {
                    status: PersistentJobStatus::Cancelled,
                    completed_units: 0,
                    failed_units: 0,
                    message: Some("Job cancelled by user"),
                    error_details: None,
                    ended_at: Some(&now),
                },
            );

            self.event_bus.publish(DomainEvent::JobProgressUpdated {
                job_id: job_id.to_string(),
                job_type: job_type_str,
                status: "cancelled".to_string(),
                completed: 0,
                total: 0,
                message: Some("Job cancelled by user".to_string()),
            });
        }

        found
    }

    /// Query active job progress or fall back to repository
    pub async fn get_job_progress(&self, job_id: &str) -> Option<JobProgress> {
        {
            let lock = self.active_jobs.read().await;
            if let Some(state) = lock.get(job_id) {
                let percent = if state.total_units > 0 {
                    (state.completed_units as f64 / state.total_units as f64) * 100.0
                } else if state.status == JobStatus::Completed {
                    100.0
                } else {
                    0.0
                };

                return Some(JobProgress {
                    job_id: state.id.clone(),
                    job_type: state.job_type.to_string(),
                    stage: state.stage.clone(),
                    current: state.completed_units,
                    total: state.total_units,
                    percent,
                    message: state.message.clone(),
                    status: state.status.clone(),
                });
            }
        }

        // Fall back to database record
        if let Ok(Some(record)) = self.repo.get_by_id(job_id) {
            let percent = if record.total_units > 0 {
                (record.completed_units as f64 / record.total_units as f64) * 100.0
            } else if record.status == PersistentJobStatus::Completed {
                100.0
            } else {
                0.0
            };

            Some(JobProgress {
                job_id: record.id,
                job_type: record.job_type,
                stage: format!("{}", record.status),
                current: record.completed_units,
                total: record.total_units,
                percent,
                message: record.message,
                status: record.status.into(),
            })
        } else {
            None
        }
    }

    /// List recent jobs
    pub fn list_recent_jobs(&self, limit: usize) -> Vec<JobProgress> {
        self.repo
            .list_recent(limit)
            .unwrap_or_default()
            .into_iter()
            .map(|r| {
                let percent = if r.total_units > 0 {
                    (r.completed_units as f64 / r.total_units as f64) * 100.0
                } else if r.status == PersistentJobStatus::Completed {
                    100.0
                } else {
                    0.0
                };
                JobProgress {
                    job_id: r.id,
                    job_type: r.job_type,
                    stage: format!("{}", r.status),
                    current: r.completed_units,
                    total: r.total_units,
                    percent,
                    message: r.message,
                    status: r.status.into(),
                }
            })
            .collect()
    }
}
