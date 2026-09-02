use std::path::PathBuf;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_storage::repos::BackupRecord;
use luma_storage::services::{BackupManifest, BackupPreview};

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised error messages
// ============================================================================

const INVALID_BACKUP_PATH_MSG: &str = "Backup path cannot be empty.";
const BACKUP_CREATED_MSG: &str = "Backup created successfully.";
const BACKUP_RESTORED_MSG: &str = "Backup restored successfully.";

// ============================================================================
// Helpers
// ============================================================================

/// Converts a string to a PathBuf and validates it's not empty.
fn parse_backup_path(path: &str) -> Result<PathBuf, BackendError> {
    if path.trim().is_empty() {
        return Err(BackendError::validation(INVALID_BACKUP_PATH_MSG));
    }
    Ok(PathBuf::from(path))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx), fields(prefix = ?prefix))]
#[tauri::command]
pub fn create_backup(
    ctx: State<'_, LumaAppContext>,
    prefix: Option<String>,
) -> Result<BackupRecord, BackendError> {
    debug!("Creating backup with prefix: {:?}", prefix);
    let record = ctx.backup_service
        .create_backup(prefix.as_deref())
        .map_err(|e| {
            error!(error = %e, "Failed to create backup");
            BackendError::from(e)
        })?;
    info!(backup_id = %record.id, BACKUP_CREATED_MSG);
    Ok(record)
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_backups(ctx: State<'_, LumaAppContext>) -> Result<Vec<BackupRecord>, BackendError> {
    debug!("Listing backups");
    let backups = ctx.backup_service
        .list_backups()
        .map_err(|e| {
            error!(error = %e, "Failed to list backups");
            BackendError::from(e)
        })?;
    debug!(count = backups.len(), "Retrieved backups");
    Ok(backups)
}

#[instrument(skip(ctx), fields(backup_path = %backup_path))]
#[tauri::command]
pub fn inspect_backup(
    ctx: State<'_, LumaAppContext>,
    backup_path: String,
) -> Result<BackupPreview, BackendError> {
    let path = parse_backup_path(&backup_path)?;
    debug!(?path, "Inspecting backup");
    let preview = ctx.backup_service
        .inspect_backup(path)
        .map_err(|e| {
            error!(error = %e, "Failed to inspect backup");
            BackendError::from(e)
        })?;
    debug!(?preview, "Backup inspection successful");
    Ok(preview)
}

#[instrument(skip(ctx), fields(backup_path = %backup_path))]
#[tauri::command]
pub fn restore_backup(
    ctx: State<'_, LumaAppContext>,
    backup_path: String,
) -> Result<BackupManifest, BackendError> {
    let path = parse_backup_path(&backup_path)?;
    debug!(?path, "Restoring backup");
    let manifest = ctx.backup_service
        .restore_backup(path)
        .map_err(|e| {
            error!(error = %e, "Failed to restore backup");
            BackendError::from(e)
        })?;
    info!(BACKUP_RESTORED_MSG);
    Ok(manifest)
}