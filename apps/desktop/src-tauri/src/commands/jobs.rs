use tauri::State;
use tracing::{debug, info, instrument};


use luma_core::error::BackendError;
use luma_storage::jobs::JobProgress;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages and configuration
// ============================================================================

const INVALID_JOB_ID_MSG: &str = "Job ID cannot be empty.";
const JOB_PROGRESS_RETRIEVED_MSG: &str = "Job progress retrieved successfully.";
const JOB_CANCELLED_MSG: &str = "Job cancelled successfully.";
const JOBS_LISTED_MSG: &str = "Recent jobs listed successfully.";
const DEFAULT_LIMIT: usize = 20;
const JOB_NOT_FOUND_MSG: &str = "Job not found.";

// ============================================================================
// Helper Functions
// ============================================================================

fn validate_job_id(id: &str) -> Result<(), BackendError> {
    if id.trim().is_empty() {
        return Err(BackendError::validation(INVALID_JOB_ID_MSG));
    }
    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(job_id = %job_id))]
#[tauri::command]
pub async fn get_job_progress(
    ctx: State<'_, LumaAppContext>,
    job_id: String,
) -> Result<Option<JobProgress>, BackendError> {
    validate_job_id(&job_id)?;
    debug!("Retrieving job progress");

    let progress = ctx.job_manager.get_job_progress(&job_id).await;
    if progress.is_some() {
        debug!(?progress, JOB_PROGRESS_RETRIEVED_MSG);
    } else {
        debug!(JOB_NOT_FOUND_MSG);
    }
    Ok(progress)
}

#[instrument(skip(ctx), fields(job_id = %job_id))]
#[tauri::command]
pub async fn cancel_job(
    ctx: State<'_, LumaAppContext>,
    job_id: String,
) -> Result<bool, BackendError> {
    validate_job_id(&job_id)?;
    debug!("Cancelling job");

    let cancelled = ctx.job_manager.cancel_job(&job_id).await;
    if cancelled {
        info!(JOB_CANCELLED_MSG);
    } else {
        debug!(JOB_NOT_FOUND_MSG);
    }
    Ok(cancelled)
}

#[instrument(skip(ctx), fields(limit = ?limit))]
#[tauri::command]
pub fn list_recent_jobs(
    ctx: State<'_, LumaAppContext>,
    limit: Option<usize>,
) -> Result<Vec<JobProgress>, BackendError> {
    let effective_limit = limit.unwrap_or(DEFAULT_LIMIT);
    debug!(effective_limit, "Listing recent jobs");

    let jobs = ctx.job_manager.list_recent_jobs(effective_limit);
    debug!(count = jobs.len(), JOBS_LISTED_MSG);
    Ok(jobs)
}