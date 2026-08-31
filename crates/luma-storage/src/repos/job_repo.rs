use crate::db::Database;
use crate::error::StorageResult;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum PersistentJobStatus {
    Queued,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for PersistentJobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PersistentJobStatus::Queued => write!(f, "queued"),
            PersistentJobStatus::Running => write!(f, "running"),
            PersistentJobStatus::Paused => write!(f, "paused"),
            PersistentJobStatus::Completed => write!(f, "completed"),
            PersistentJobStatus::Failed => write!(f, "failed"),
            PersistentJobStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

impl std::str::FromStr for PersistentJobStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "queued" => Ok(PersistentJobStatus::Queued),
            "running" => Ok(PersistentJobStatus::Running),
            "paused" => Ok(PersistentJobStatus::Paused),
            "completed" => Ok(PersistentJobStatus::Completed),
            "failed" => Ok(PersistentJobStatus::Failed),
            "cancelled" => Ok(PersistentJobStatus::Cancelled),
            _ => Ok(PersistentJobStatus::Queued),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRecord {
    pub id: String,
    pub job_type: String,
    pub status: PersistentJobStatus,
    pub total_units: u32,
    pub completed_units: u32,
    pub failed_units: u32,
    pub message: Option<String>,
    pub error_details: Option<String>,
    pub payload_json: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub ended_at: Option<String>,
}

#[derive(Clone)]
pub struct JobRepository {
    db: Database,
}

#[derive(Debug, Clone)]
pub struct JobProgressUpdate<'a> {
    pub status: PersistentJobStatus,
    pub completed_units: u32,
    pub failed_units: u32,
    pub message: Option<&'a str>,
    pub error_details: Option<&'a str>,
    pub ended_at: Option<&'a str>,
}

impl JobRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, job: &JobRecord) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO background_jobs (
                    id, job_type, status, total_units, completed_units, failed_units,
                    message, error_details, payload_json, created_at, updated_at, ended_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
                params![
                    job.id,
                    job.job_type,
                    job.status.to_string(),
                    job.total_units as i64,
                    job.completed_units as i64,
                    job.failed_units as i64,
                    job.message,
                    job.error_details,
                    job.payload_json,
                    job.created_at,
                    job.updated_at,
                    job.ended_at,
                ],
            )?;
            Ok(())
        })
    }

    pub fn update_progress(&self, id: &str, update: JobProgressUpdate<'_>) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                UPDATE background_jobs
                SET status = ?1,
                    completed_units = ?2,
                    failed_units = ?3,
                    message = COALESCE(?4, message),
                    error_details = COALESCE(?5, error_details),
                    updated_at = datetime('now'),
                    ended_at = COALESCE(?6, ended_at)
                WHERE id = ?7
                "#,
                params![
                    update.status.to_string(),
                    update.completed_units as i64,
                    update.failed_units as i64,
                    update.message,
                    update.error_details,
                    update.ended_at,
                    id,
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_by_id(&self, id: &str) -> StorageResult<Option<JobRecord>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, job_type, status, total_units, completed_units, failed_units,
                       message, error_details, payload_json, created_at, updated_at, ended_at
                FROM background_jobs
                WHERE id = ?1
                "#,
            )?;

            let mut rows = stmt.query([id])?;
            if let Some(r) = rows.next()? {
                let status_str: String = r.get(2)?;
                let status = status_str.parse().unwrap_or(PersistentJobStatus::Queued);
                Ok(Some(JobRecord {
                    id: r.get(0)?,
                    job_type: r.get(1)?,
                    status,
                    total_units: r.get::<_, i64>(3)? as u32,
                    completed_units: r.get::<_, i64>(4)? as u32,
                    failed_units: r.get::<_, i64>(5)? as u32,
                    message: r.get(6)?,
                    error_details: r.get(7)?,
                    payload_json: r.get(8)?,
                    created_at: r.get(9)?,
                    updated_at: r.get(10)?,
                    ended_at: r.get(11)?,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_recent(&self, limit: usize) -> StorageResult<Vec<JobRecord>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, job_type, status, total_units, completed_units, failed_units,
                       message, error_details, payload_json, created_at, updated_at, ended_at
                FROM background_jobs
                ORDER BY created_at DESC
                LIMIT ?1
                "#,
            )?;

            let rows = stmt.query_map([limit as i64], |r| {
                let status_str: String = r.get(2)?;
                let status = status_str.parse().unwrap_or(PersistentJobStatus::Queued);
                Ok(JobRecord {
                    id: r.get(0)?,
                    job_type: r.get(1)?,
                    status,
                    total_units: r.get::<_, i64>(3)? as u32,
                    completed_units: r.get::<_, i64>(4)? as u32,
                    failed_units: r.get::<_, i64>(5)? as u32,
                    message: r.get(6)?,
                    error_details: r.get(7)?,
                    payload_json: r.get(8)?,
                    created_at: r.get(9)?,
                    updated_at: r.get(10)?,
                    ended_at: r.get(11)?,
                })
            })?;

            let mut jobs = Vec::new();
            for j in rows.flatten() {
                jobs.push(j);
            }
            Ok(jobs)
        })
    }
}
