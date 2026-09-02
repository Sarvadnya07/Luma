use std::io::Write;
use std::path::PathBuf;
use tauri::State;

use tracing::{debug, error, info, instrument, warn};

use luma_core::error::BackendError;
use luma_core::ids::DeviceId;
use luma_core::models::ingest::ImportJob;

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised messages and configuration
// ============================================================================

const IMPORT_DIALOG_TITLE: &str = "Import Books into Luma";
const FOLDER_DIALOG_TITLE: &str = "Select Folder to Import into Luma";
const IMPORT_SUCCESS_MSG: &str = "Files imported successfully.";
const DIRECTORY_IMPORT_SUCCESS_MSG: &str = "Directory imported successfully.";
const BYTES_IMPORT_SUCCESS_MSG: &str = "File bytes imported successfully.";
const RECONCILE_SUCCESS_MSG: &str = "Library files reconciled successfully.";
const STAGING_DIR_CREATE_FAILED_MSG: &str = "Failed to create staging directory.";
const STAGING_FILE_CREATE_FAILED_MSG: &str = "Failed to create temporary staging file.";
const STAGING_FILE_WRITE_FAILED_MSG: &str = "Failed to write data to staging file.";
const TEMP_FILE_CLEANUP_FAILED_MSG: &str = "Failed to clean up temporary file.";
const INVALID_PATH_MSG: &str = "Invalid file path provided.";

// Filter groups for file dialog
const FILTER_DIGITAL_PUBLICATIONS: (&str, &[&str]) = (
    "Digital Publications (*.epub, *.pdf, *.cbz, *.cbr, *.txt, *.md)",
    &["epub", "pdf", "cbz", "cbr", "txt", "md", "html", "htm"],
);
const FILTER_EPUB: (&str, &[&str]) = ("EPUB Books (*.epub)", &["epub"]);
const FILTER_PDF: (&str, &[&str]) = ("PDF Documents (*.pdf)", &["pdf"]);
const FILTER_ALL: (&str, &[&str]) = ("All Files (*.*)", &["*"]);

// ============================================================================
// Helper Functions
// ============================================================================

fn pathbuf_from_string(s: &str) -> Result<PathBuf, BackendError> {
    if s.trim().is_empty() {
        return Err(BackendError::validation(INVALID_PATH_MSG));
    }
    Ok(PathBuf::from(s))
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Native OS Open File Dialog for picking digital publication files
#[instrument]
#[tauri::command]
pub async fn pick_import_files() -> Result<Vec<String>, BackendError> {
    debug!("Opening file picker dialog");

    let files = rfd::AsyncFileDialog::new()
        .set_title(IMPORT_DIALOG_TITLE)
        .add_filter(
            FILTER_DIGITAL_PUBLICATIONS.0,
            FILTER_DIGITAL_PUBLICATIONS.1,
        )
        .add_filter(FILTER_EPUB.0, FILTER_EPUB.1)
        .add_filter(FILTER_PDF.0, FILTER_PDF.1)
        .add_filter(FILTER_ALL.0, FILTER_ALL.1)
        .pick_files()
        .await;

    match files {
        Some(handles) => {
            let paths: Vec<String> = handles
                .into_iter()
                .map(|h| h.path().to_string_lossy().to_string())
                .collect();
            debug!(count = paths.len(), "Files selected");
            Ok(paths)
        }
        None => {
            debug!("File picker cancelled");
            Ok(Vec::new())
        }
    }
}

/// Native OS Folder Dialog for picking a directory to scan & import
#[instrument]
#[tauri::command]
pub async fn pick_import_directory() -> Result<Option<String>, BackendError> {
    debug!("Opening folder picker dialog");

    let folder = rfd::AsyncFileDialog::new()
        .set_title(FOLDER_DIALOG_TITLE)
        .pick_folder()
        .await;

    match folder {
        Some(h) => {
            let path = h.path().to_string_lossy().to_string();
            debug!(%path, "Folder selected");
            Ok(Some(path))
        }
        None => {
            debug!("Folder picker cancelled");
            Ok(None)
        }
    }
}

/// Primary native desktop import command: takes validated filesystem paths
#[instrument(skip(ctx), fields(path_count = file_paths.len()))]
#[tauri::command]
pub async fn import_files(
    ctx: State<'_, LumaAppContext>,
    file_paths: Vec<String>,
) -> Result<ImportJob, BackendError> {
    debug!("Importing files");

    let device_id = DeviceId::new();
    let mut paths = Vec::with_capacity(file_paths.len());
    for path_str in file_paths {
        match pathbuf_from_string(&path_str) {
            Ok(p) => paths.push(p),
            Err(e) => {
                warn!(path = %path_str, "Skipping invalid path");
                return Err(e);
            }
        }
    }

    let job = ctx
        .import_service
        .import_files(&paths, device_id)
        .await
        .map_err(|e| {
            error!(error = %e, "Import failed");
            BackendError::from(e)
        })?;

    info!(job_id = %job.id, total_files = job.total_files, completed = job.completed_count, IMPORT_SUCCESS_MSG);
    Ok(job)
}

/// Directory scan & recursive import
#[instrument(skip(ctx), fields(dir_path = %dir_path, recursive = recursive))]
#[tauri::command]
pub async fn import_directory(
    ctx: State<'_, LumaAppContext>,
    dir_path: String,
    recursive: bool,
) -> Result<ImportJob, BackendError> {
    let path = pathbuf_from_string(&dir_path)?;
    debug!(?path, "Importing directory");

    let device_id = DeviceId::new();

    let job = ctx
        .import_service
        .scan_directory(path, recursive, device_id)
        .await
        .map_err(|e| {
            error!(error = %e, "Directory import failed");
            BackendError::from(e)
        })?;

    info!(job_id = %job.id, total_files = job.total_files, completed = job.completed_count, DIRECTORY_IMPORT_SUCCESS_MSG);
    Ok(job)
}

/// Browser fallback for HTML5 drag-and-drop where WebViews cannot access physical paths
#[instrument(skip(ctx, data), fields(filename = %filename, data_len = data.len()))]
#[tauri::command]
pub async fn import_file_bytes(
    ctx: State<'_, LumaAppContext>,
    filename: String,
    data: Vec<u8>,
) -> Result<ImportJob, BackendError> {
    debug!(%filename, "Importing file from bytes");

    let device_id = DeviceId::new();
    let staging_dir = ctx.file_service.staging_dir();

    std::fs::create_dir_all(&staging_dir).map_err(|e| {
        error!(error = %e, STAGING_DIR_CREATE_FAILED_MSG);
        BackendError::storage(STAGING_DIR_CREATE_FAILED_MSG.to_string())
    })?;


    let temp_filename = format!("{}_{}", uuid::Uuid::new_v4().simple(), filename);
    let temp_path = staging_dir.join(&temp_filename);

    // Write bytes to temporary file
    let mut temp_file = std::fs::File::create(&temp_path).map_err(|e| {
        error!(error = %e, STAGING_FILE_CREATE_FAILED_MSG);
        BackendError::storage(STAGING_FILE_CREATE_FAILED_MSG.to_string())
    })?;

    temp_file.write_all(&data).map_err(|e| {
        error!(error = %e, STAGING_FILE_WRITE_FAILED_MSG);
        BackendError::storage(STAGING_FILE_WRITE_FAILED_MSG.to_string())
    })?;

    // Import from temporary file
    let result = ctx
        .import_service
        .import_files(std::slice::from_ref(&temp_path), device_id)
        .await;

    // Clean up temporary file
    if let Err(e) = std::fs::remove_file(&temp_path) {
        warn!(error = %e, TEMP_FILE_CLEANUP_FAILED_MSG);
    }

    match result {
        Ok(job) => {
            info!(job_id = %job.id, total_files = job.total_files, completed = job.completed_count, BYTES_IMPORT_SUCCESS_MSG);
            Ok(job)
        }
        Err(e) => {
            error!(error = %e, "Import from bytes failed");
            Err(BackendError::from(e))
        }
    }
}

/// Reconcile library files
#[instrument(skip(ctx))]
#[tauri::command]
pub fn reconcile_library_files(ctx: State<'_, LumaAppContext>) -> Result<usize, BackendError> {
    debug!("Reconciling library files");

    ctx.maintenance_service
        .reconcile_files()
        .map(|res| {
            info!(items_processed = res.items_processed, RECONCILE_SUCCESS_MSG);
            res.items_processed
        })
        .map_err(|e| {
            error!(error = %e, "Reconcile failed");
            BackendError::from(e)
        })
}