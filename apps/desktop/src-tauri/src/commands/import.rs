use std::io::Write;
use std::path::PathBuf;
use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::DeviceId;
use luma_core::models::ingest::ImportJob;

use crate::context::LumaAppContext;

/// Native OS Open File Dialog for picking digital publication files
#[tauri::command]
pub async fn pick_import_files() -> Result<Vec<String>, BackendError> {
    let files = rfd::AsyncFileDialog::new()
        .set_title("Import Books into Luma")
        .add_filter(
            "Digital Publications (*.epub, *.pdf, *.cbz, *.cbr, *.txt, *.md)",
            &["epub", "pdf", "cbz", "cbr", "txt", "md", "html", "htm"],
        )
        .add_filter("EPUB Books (*.epub)", &["epub"])
        .add_filter("PDF Documents (*.pdf)", &["pdf"])
        .add_filter("All Files (*.*)", &["*"])
        .pick_files()
        .await;

    match files {
        Some(handles) => {
            let paths: Vec<String> = handles
                .into_iter()
                .map(|h| h.path().to_string_lossy().to_string())
                .collect();
            Ok(paths)
        }
        None => Ok(Vec::new()),
    }
}

/// Native OS Folder Dialog for picking a directory to scan & import
#[tauri::command]
pub async fn pick_import_directory() -> Result<Option<String>, BackendError> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Select Folder to Import into Luma")
        .pick_folder()
        .await;

    Ok(folder.map(|h| h.path().to_string_lossy().to_string()))
}

/// Primary native desktop import command: takes validated filesystem paths
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

/// Directory scan & recursive import
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

/// Browser fallback for HTML5 drag-and-drop where WebViews cannot access physical paths
#[tauri::command]
pub async fn import_file_bytes(
    ctx: State<'_, LumaAppContext>,
    filename: String,
    data: Vec<u8>,
) -> Result<ImportJob, BackendError> {
    let device_id = DeviceId::new();
    let staging_dir = ctx.file_service.staging_dir();
    let _ = std::fs::create_dir_all(staging_dir);
    let temp_path = ctx.file_service.staging_dir().join(format!(
        "{}_{}",
        uuid::Uuid::new_v4().simple(),
        filename
    ));

    let mut temp_file = std::fs::File::create(&temp_path).map_err(|e| {
        BackendError::storage(format!("Failed to create temporary staging file: {}", e))
    })?;
    temp_file.write_all(&data).map_err(|e| {
        BackendError::storage(format!("Failed to write data to staging file: {}", e))
    })?;

    let res = ctx
        .import_service
        .import_files(std::slice::from_ref(&temp_path), device_id)
        .await;

    // Clean up temporary staged file
    let _ = std::fs::remove_file(&temp_path);

    res.map_err(BackendError::from)
}

#[tauri::command]
pub fn reconcile_library_files(ctx: State<'_, LumaAppContext>) -> Result<usize, BackendError> {
    ctx.maintenance_service
        .reconcile_files()
        .map(|res| res.items_processed)
        .map_err(BackendError::from)
}
