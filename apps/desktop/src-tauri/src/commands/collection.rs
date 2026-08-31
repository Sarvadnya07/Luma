use tauri::State;

use luma_core::error::BackendError;
use luma_core::ids::{BookId, CollectionId, DeviceId, TagId};
use luma_core::models::metadata::{Author, Collection, Series, Tag};
use luma_storage::repos::{
    AuthorRepository, CollectionRepository, SeriesRepository, TagRepository,
};

use crate::context::LumaAppContext;

#[tauri::command]
pub fn list_collections(ctx: State<'_, LumaAppContext>) -> Result<Vec<Collection>, BackendError> {
    let repo = CollectionRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| BackendError::storage(e.to_string()))
}

#[tauri::command]
pub fn create_collection(
    ctx: State<'_, LumaAppContext>,
    name: String,
    description: Option<String>,
) -> Result<Collection, BackendError> {
    let repo = CollectionRepository::new(ctx.db.clone());
    repo.create(&name, description.as_deref(), DeviceId::new())
        .map_err(|e| BackendError::storage(e.to_string()))
}

#[tauri::command]
pub fn add_books_to_collection(
    ctx: State<'_, LumaAppContext>,
    collection_id: String,
    book_ids: Vec<String>,
) -> Result<(), BackendError> {
    let col_id = collection_id
        .parse::<CollectionId>()
        .map_err(|_| BackendError::validation("Invalid collection_id"))?;
    let repo = CollectionRepository::new(ctx.db.clone());
    for b in book_ids {
        if let Ok(bid) = b.parse::<BookId>() {
            repo.add_book_to_collection(&col_id, &bid)
                .map_err(|e| BackendError::storage(e.to_string()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_tags(ctx: State<'_, LumaAppContext>) -> Result<Vec<Tag>, BackendError> {
    let repo = TagRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| BackendError::storage(e.to_string()))
}

#[tauri::command]
pub fn add_tag_to_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    tag_name: String,
) -> Result<Tag, BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;
    let repo = TagRepository::new(ctx.db.clone());
    let tag = repo
        .get_or_create_by_name(&tag_name, DeviceId::new())
        .map_err(|e| BackendError::storage(e.to_string()))?;
    repo.add_tag_to_book(&bid, &tag.id)
        .map_err(|e| BackendError::storage(e.to_string()))?;
    Ok(tag)
}

#[tauri::command]
pub fn remove_tag_from_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    tag_id: String,
) -> Result<(), BackendError> {
    let bid = book_id
        .parse::<BookId>()
        .map_err(|_| BackendError::validation("Invalid book_id format"))?;
    let tid = tag_id
        .parse::<TagId>()
        .map_err(|_| BackendError::validation("Invalid tag_id format"))?;
    let repo = TagRepository::new(ctx.db.clone());
    repo.remove_tag_from_book(&bid, &tid)
        .map_err(|e| BackendError::storage(e.to_string()))
}

#[tauri::command]
pub fn list_authors(ctx: State<'_, LumaAppContext>) -> Result<Vec<Author>, BackendError> {
    let repo = AuthorRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| BackendError::storage(e.to_string()))
}

#[tauri::command]
pub fn list_series(ctx: State<'_, LumaAppContext>) -> Result<Vec<Series>, BackendError> {
    let repo = SeriesRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| BackendError::storage(e.to_string()))
}
