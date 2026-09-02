use std::str::FromStr;
use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_core::ids::{BookId, CollectionId, DeviceId, TagId};
use luma_core::models::metadata::{Author, Collection, Series, Tag};
use luma_storage::repos::{
    AuthorRepository, CollectionRepository, SeriesRepository, TagRepository,
};

use crate::context::LumaAppContext;

// ============================================================================
// Constants – centralised error messages
// ============================================================================

const INVALID_COLLECTION_ID_MSG: &str = "Invalid collection_id format. Expected a valid CollectionId.";
const INVALID_BOOK_ID_MSG: &str = "Invalid book_id format. Expected a valid BookId.";
const INVALID_TAG_ID_MSG: &str = "Invalid tag_id format. Expected a valid TagId.";
const COLLECTION_CREATED_MSG: &str = "Collection created successfully.";
const TAG_ADDED_MSG: &str = "Tag added to book successfully.";
const TAG_REMOVED_MSG: &str = "Tag removed from book successfully.";
const BOOKS_ADDED_TO_COLLECTION_MSG: &str = "Books added to collection successfully.";

// ============================================================================
// Helpers
// ============================================================================

fn parse_collection_id(id: &str) -> Result<CollectionId, BackendError> {
    CollectionId::from_str(id).map_err(|_| BackendError::validation(INVALID_COLLECTION_ID_MSG))
}

fn parse_book_id(id: &str) -> Result<BookId, BackendError> {
    BookId::from_str(id).map_err(|_| BackendError::validation(INVALID_BOOK_ID_MSG))
}

fn parse_tag_id(id: &str) -> Result<TagId, BackendError> {
    TagId::from_str(id).map_err(|_| BackendError::validation(INVALID_TAG_ID_MSG))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_collections(ctx: State<'_, LumaAppContext>) -> Result<Vec<Collection>, BackendError> {
    debug!("Listing collections");
    let repo = CollectionRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| {
            error!(error = %e, "Failed to list collections");
            BackendError::storage(e.to_string())
        })
}

#[instrument(skip(ctx), fields(name = %name, description = ?description))]
#[tauri::command]
pub fn create_collection(
    ctx: State<'_, LumaAppContext>,
    name: String,
    description: Option<String>,
) -> Result<Collection, BackendError> {
    debug!(?name, "Creating collection");
    let repo = CollectionRepository::new(ctx.db.clone());
    let collection = repo
        .create(&name, description.as_deref(), DeviceId::new())
        .map_err(|e| {
            error!(error = %e, "Failed to create collection");
            BackendError::storage(e.to_string())
        })?;
    info!(collection_id = %collection.id, COLLECTION_CREATED_MSG);
    Ok(collection)
}

#[instrument(skip(ctx), fields(collection_id = %collection_id, book_ids = ?book_ids))]
#[tauri::command]
pub fn add_books_to_collection(
    ctx: State<'_, LumaAppContext>,
    collection_id: String,
    book_ids: Vec<String>,
) -> Result<(), BackendError> {
    let col_id = parse_collection_id(&collection_id)?;
    debug!(?col_id, "Adding books to collection");

    let repo = CollectionRepository::new(ctx.db.clone());

    // Process each book ID, skipping invalid ones (but logging warnings)
    let mut added_count = 0;
    let mut errors: Vec<String> = Vec::new();
    for b in book_ids {
        match parse_book_id(&b) {
            Ok(bid) => {
                if let Err(e) = repo.add_book_to_collection(&col_id, &bid) {
                    error!(book_id = %bid, error = %e, "Failed to add book to collection");
                    errors.push(e.to_string());
                } else {
                    added_count += 1;
                }
            }
            Err(e) => {
                error!(book_id = %b, error = %e, "Invalid book_id skipped");
                errors.push(e.to_string());
            }
        }
    }


    if !errors.is_empty() {
        // If any errors occurred, log them and return a storage error with details
        // Optionally, you could return a partial success, but we'll treat as error for simplicity.
        return Err(BackendError::storage(format!(
            "Failed to add {} out of {} books to collection. First error: {}",
            errors.len(),
            added_count + errors.len(),
            errors[0]
        )));
    }

    info!(BOOKS_ADDED_TO_COLLECTION_MSG);
    Ok(())
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_tags(ctx: State<'_, LumaAppContext>) -> Result<Vec<Tag>, BackendError> {
    debug!("Listing tags");
    let repo = TagRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| {
            error!(error = %e, "Failed to list tags");
            BackendError::storage(e.to_string())
        })
}

#[instrument(skip(ctx), fields(book_id = %book_id, tag_name = %tag_name))]
#[tauri::command]
pub fn add_tag_to_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    tag_name: String,
) -> Result<Tag, BackendError> {
    let bid = parse_book_id(&book_id)?;
    debug!(?bid, ?tag_name, "Adding tag to book");

    let repo = TagRepository::new(ctx.db.clone());
    let tag = repo
        .get_or_create_by_name(&tag_name, DeviceId::new())
        .map_err(|e| {
            error!(error = %e, "Failed to get or create tag");
            BackendError::storage(e.to_string())
        })?;

    repo.add_tag_to_book(&bid, &tag.id)
        .map_err(|e| {
            error!(error = %e, "Failed to add tag to book");
            BackendError::storage(e.to_string())
        })?;

    info!(tag_id = %tag.id, TAG_ADDED_MSG);
    Ok(tag)
}

#[instrument(skip(ctx), fields(book_id = %book_id, tag_id = %tag_id))]
#[tauri::command]
pub fn remove_tag_from_book(
    ctx: State<'_, LumaAppContext>,
    book_id: String,
    tag_id: String,
) -> Result<(), BackendError> {
    let bid = parse_book_id(&book_id)?;
    let tid = parse_tag_id(&tag_id)?;
    debug!(?bid, ?tid, "Removing tag from book");

    let repo = TagRepository::new(ctx.db.clone());
    repo.remove_tag_from_book(&bid, &tid)
        .map_err(|e| {
            error!(error = %e, "Failed to remove tag from book");
            BackendError::storage(e.to_string())
        })?;

    info!(TAG_REMOVED_MSG);
    Ok(())
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_authors(ctx: State<'_, LumaAppContext>) -> Result<Vec<Author>, BackendError> {
    debug!("Listing authors");
    let repo = AuthorRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| {
            error!(error = %e, "Failed to list authors");
            BackendError::storage(e.to_string())
        })
}

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_series(ctx: State<'_, LumaAppContext>) -> Result<Vec<Series>, BackendError> {
    debug!("Listing series");
    let repo = SeriesRepository::new(ctx.db.clone());
    repo.list_all()
        .map_err(|e| {
            error!(error = %e, "Failed to list series");
            BackendError::storage(e.to_string())
        })
}