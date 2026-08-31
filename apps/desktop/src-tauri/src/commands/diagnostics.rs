use tauri::State;

use luma_core::error::BackendError;
use luma_storage::services::DiagnosticsReport;

use crate::context::LumaAppContext;

#[tauri::command]
pub async fn run_diagnostics(
    ctx: State<'_, LumaAppContext>,
) -> Result<DiagnosticsReport, BackendError> {
    ctx.diagnostics_service
        .run_diagnostics()
        .await
        .map_err(BackendError::from)
}
