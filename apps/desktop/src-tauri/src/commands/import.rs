use std::path::PathBuf;
use tauri::State;

use luma_core::ids::DeviceId;
use luma_core::models::ingest::ImportJob;
use luma_storage::{Database, LibraryService};

#[tauri::command]
pub fn import_files(
    db: State<'_, Database>,
    file_paths: Vec<String>,
) -> Result<ImportJob, String> {
    let service = LibraryService::new(db.inner().clone(), "library");
    let device_id = DeviceId::new();
    let paths: Vec<PathBuf> = file_paths.into_iter().map(PathBuf::from).collect();
    service
        .import_files(&paths, device_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_directory(
    db: State<'_, Database>,
    dir_path: String,
    recursive: bool,
) -> Result<ImportJob, String> {
    let service = LibraryService::new(db.inner().clone(), "library");
    let device_id = DeviceId::new();
    service
        .scan_directory(PathBuf::from(dir_path), recursive, device_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reconcile_library_files(db: State<'_, Database>) -> Result<usize, String> {
    let service = LibraryService::new(db.inner().clone(), "library");
    service.reconcile_files().map_err(|e| e.to_string())
}
