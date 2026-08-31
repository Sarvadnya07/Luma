use tauri::State;

use luma_core::error::BackendError;
use luma_storage::services::MaintenanceResult;

use crate::context::LumaAppContext;

#[tauri::command]
pub fn maintenance_reconcile_files(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    ctx.maintenance_service
        .reconcile_files()
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn maintenance_rebuild_search_index(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    ctx.maintenance_service
        .rebuild_search_index()
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn maintenance_cleanup_caches(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    ctx.maintenance_service
        .cleanup_caches()
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn maintenance_vacuum_database(
    ctx: State<'_, LumaAppContext>,
) -> Result<MaintenanceResult, BackendError> {
    ctx.maintenance_service
        .vacuum_database()
        .map_err(BackendError::from)
}
