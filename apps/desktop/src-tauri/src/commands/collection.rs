use luma_core::ids::{BookId, CollectionId, DeviceId, TagId};
use luma_core::models::metadata::{Author, Collection, Series, Tag};
use luma_storage::repos::{
    AuthorRepository, CollectionRepository, SeriesRepository, TagRepository,
};
use luma_storage::Database;
use tauri::State;

#[tauri::command]
pub fn list_collections(db: State<'_, Database>) -> Result<Vec<Collection>, String> {
    let repo = CollectionRepository::new(db.inner().clone());
    repo.list_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_collection(
    db: State<'_, Database>,
    name: String,
    description: Option<String>,
) -> Result<Collection, String> {
    let repo = CollectionRepository::new(db.inner().clone());
    repo.create(&name, description.as_deref(), DeviceId::new())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_books_to_collection(
    db: State<'_, Database>,
    collection_id: String,
    book_ids: Vec<String>,
) -> Result<(), String> {
    let col_id = collection_id
        .parse::<CollectionId>()
        .map_err(|e| e.to_string())?;
    let repo = CollectionRepository::new(db.inner().clone());
    for b in book_ids {
        if let Ok(bid) = b.parse::<BookId>() {
            repo.add_book_to_collection(&col_id, &bid)
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_tags(db: State<'_, Database>) -> Result<Vec<Tag>, String> {
    let repo = TagRepository::new(db.inner().clone());
    repo.list_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_tag_to_book(
    db: State<'_, Database>,
    book_id: String,
    tag_name: String,
) -> Result<Tag, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = TagRepository::new(db.inner().clone());
    let tag = repo
        .get_or_create_by_name(&tag_name, DeviceId::new())
        .map_err(|e| e.to_string())?;
    repo.add_tag_to_book(&bid, &tag.id)
        .map_err(|e| e.to_string())?;
    Ok(tag)
}

#[tauri::command]
pub fn remove_tag_from_book(
    db: State<'_, Database>,
    book_id: String,
    tag_id: String,
) -> Result<(), String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let tid = tag_id.parse::<TagId>().map_err(|e| e.to_string())?;
    let repo = TagRepository::new(db.inner().clone());
    repo.remove_tag_from_book(&bid, &tid)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_authors(db: State<'_, Database>) -> Result<Vec<Author>, String> {
    let repo = AuthorRepository::new(db.inner().clone());
    repo.list_all().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_series(db: State<'_, Database>) -> Result<Vec<Series>, String> {
    let repo = SeriesRepository::new(db.inner().clone());
    repo.list_all().map_err(|e| e.to_string())
}
