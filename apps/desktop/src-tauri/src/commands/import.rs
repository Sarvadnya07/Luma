use std::path::PathBuf;
use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::DeviceId;
use luma_core::models::ingest::ImportJob;

use crate::context::LumaAppContext;

#[tauri::command]
pub async fn import_files(
    ctx: State<'_, LumaAppContext>,
    file_paths: Vec<String>,
) -> Result<ImportJob, BackendError> {
    let device_id = DeviceId::new();
    let paths: Vec<PathBuf> = file_paths.into_iter().map(PathBuf::from).collect();

    ctx.import_service
        .import_files(&paths, device_id)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub async fn import_directory(
    ctx: State<'_, LumaAppContext>,
    dir_path: String,
    recursive: bool,
) -> Result<ImportJob, BackendError> {
    let device_id = DeviceId::new();

    ctx.import_service
        .scan_directory(PathBuf::from(dir_path), recursive, device_id)
        .await
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn reconcile_library_files(ctx: State<'_, LumaAppContext>) -> Result<usize, BackendError> {
    ctx.maintenance_service
        .reconcile_files()
        .map(|res| res.items_processed)
        .map_err(BackendError::from)
}
