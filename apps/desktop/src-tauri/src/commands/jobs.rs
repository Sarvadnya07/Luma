use tauri::State;

use luma_core::error::BackendError;
use luma_storage::jobs::JobProgress;

use crate::context::LumaAppContext;

#[tauri::command]
pub async fn get_job_progress(
    ctx: State<'_, LumaAppContext>,
    job_id: String,
) -> Result<Option<JobProgress>, BackendError> {
    Ok(ctx.job_manager.get_job_progress(&job_id).await)
}

#[tauri::command]
pub async fn cancel_job(
    ctx: State<'_, LumaAppContext>,
    job_id: String,
) -> Result<bool, BackendError> {
    Ok(ctx.job_manager.cancel_job(&job_id).await)
}

#[tauri::command]
pub fn list_recent_jobs(
    ctx: State<'_, LumaAppContext>,
    limit: Option<usize>,
) -> Result<Vec<JobProgress>, BackendError> {
    Ok(ctx.job_manager.list_recent_jobs(limit.unwrap_or(20)))
}
