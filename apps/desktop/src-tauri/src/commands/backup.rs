use std::path::PathBuf;
use tauri::State;

use luma_core::error::BackendError;
use luma_storage::repos::BackupRecord;
use luma_storage::services::{BackupManifest, BackupPreview};

use crate::context::LumaAppContext;

#[tauri::command]
pub fn create_backup(
    ctx: State<'_, LumaAppContext>,
    prefix: Option<String>,
) -> Result<BackupRecord, BackendError> {
    ctx.backup_service
        .create_backup(prefix.as_deref())
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn list_backups(ctx: State<'_, LumaAppContext>) -> Result<Vec<BackupRecord>, BackendError> {
    ctx.backup_service
        .list_backups()
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn inspect_backup(
    ctx: State<'_, LumaAppContext>,
    backup_path: String,
) -> Result<BackupPreview, BackendError> {
    ctx.backup_service
        .inspect_backup(PathBuf::from(backup_path))
        .map_err(BackendError::from)
}

#[tauri::command]
pub fn restore_backup(
    ctx: State<'_, LumaAppContext>,
    backup_path: String,
) -> Result<BackupManifest, BackendError> {
    ctx.backup_service
        .restore_backup(PathBuf::from(backup_path))
        .map_err(BackendError::from)
}
