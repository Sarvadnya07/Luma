use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_storage::services::DiagnosticsReport;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages
// ============================================================================

const DIAGNOSTICS_SUCCESS_MSG: &str = "Diagnostics completed successfully.";
const DIAGNOSTICS_FAILED_MSG: &str = "Diagnostics failed.";

// ============================================================================
// Tauri Command
// ============================================================================

#[instrument(skip(ctx))]
#[tauri::command]
pub async fn run_diagnostics(
    ctx: State<'_, LumaAppContext>,
) -> Result<DiagnosticsReport, BackendError> {
    debug!("Running diagnostics");

    let report = ctx
        .diagnostics_service
        .run_diagnostics()
        .await
        .map_err(|e| {
            error!(error = %e, DIAGNOSTICS_FAILED_MSG);
            BackendError::from(e)
        })?;

    debug!(?report, "Diagnostics report generated");
    info!(DIAGNOSTICS_SUCCESS_MSG);
    Ok(report)
}