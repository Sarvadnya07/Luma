use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_storage::services::MaintenanceResult;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages
// ============================================================================

const MAINTENANCE_RECONCILE_MSG: &str = "Files reconciled successfully.";
const MAINTENANCE_REBUILD_INDEX_MSG: &str = "Search index rebuilt successfully.";
const MAINTENANCE_CLEANUP_CACHES_MSG: &str = "Caches cleaned up successfully.";
const MAINTENANCE_VACUUM_DB_MSG: &str = "Database vacuumed successfully.";


// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx))]
#[tauri::command]
pub fn maintenance_reconcile_files(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    debug!("Running maintenance: reconcile files");

    let result = ctx
        .maintenance_service
        .reconcile_files()
        .map_err(|e| {
            error!(error = %e, "Reconcile files failed");
            BackendError::from(e)
        })?;

    info!(items_processed = result.items_processed, duration_ms = result.duration_ms, MAINTENANCE_RECONCILE_MSG);
    Ok(result)
}

#[instrument(skip(ctx))]
#[tauri::command]
pub async fn maintenance_rebuild_search_index(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    debug!("Running maintenance: rebuild search index");

    let result = ctx
        .maintenance_service
        .rebuild_search_index()
        .await
        .map_err(|e| {
            error!(error = %e, "Rebuild search index failed");
            BackendError::from(e)
        })?;

    info!(items_processed = result.items_processed, duration_ms = result.duration_ms, MAINTENANCE_REBUILD_INDEX_MSG);
    Ok(result)
}

#[instrument(skip(ctx))]
#[tauri::command]
pub async fn maintenance_cleanup_caches(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    debug!("Running maintenance: cleanup caches");

    let result = ctx
        .maintenance_service
        .cleanup_caches()
        .await
        .map_err(|e| {
            error!(error = %e, "Cleanup caches failed");
            BackendError::from(e)
        })?;

    info!(items_processed = result.items_processed, duration_ms = result.duration_ms, MAINTENANCE_CLEANUP_CACHES_MSG);
    Ok(result)
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn maintenance_vacuum_database(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    debug!("Running maintenance: vacuum database");

    let result = ctx
        .maintenance_service
        .vacuum_database()
        .map_err(|e| {
            error!(error = %e, "Vacuum database failed");
            BackendError::from(e)
        })?;

    info!(items_processed = result.items_processed, duration_ms = result.duration_ms, MAINTENANCE_VACUUM_DB_MSG);
    Ok(result)
}