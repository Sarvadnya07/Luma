use tauri::State;
use luma_core::models::book::Book;
use luma_core::models::reading::ReadingProgress;
use luma_storage::Database;
use luma_storage::repos::{BookRepository, ReadingProgressRepository};

#[tauri::command]
pub fn list_books(db: State<'_, Database>) -> Result<Vec<Book>, String> {
    let repo = BookRepository::new(db.inner().clone());
    repo.list_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_book(db: State<'_, Database>, book_id: String) -> Result<Option<Book>, String> {
    let parsed_id = book_id.parse().map_err(|e: luma_core::error::LumaError| e.to_string())?;
    let repo = BookRepository::new(db.inner().clone());
    repo.get_by_id(&parsed_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_reading_progress(db: State<'_, Database>, book_id: String) -> Result<Option<ReadingProgress>, String> {
    let parsed_id = book_id.parse().map_err(|e: luma_core::error::LumaError| e.to_string())?;
    let repo = ReadingProgressRepository::new(db.inner().clone());
    repo.get(&parsed_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_reading_progress(db: State<'_, Database>, progress: ReadingProgress) -> Result<(), String> {
    let repo = ReadingProgressRepository::new(db.inner().clone());
    repo.save(&progress).map_err(|e| e.to_string())
}
