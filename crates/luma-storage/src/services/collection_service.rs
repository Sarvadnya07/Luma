use luma_core::error::{LumaError, Result};
use luma_core::ids::{BookId, CollectionId, DeviceId, TagId};
use luma_core::models::metadata::{Author, Collection, Series, Tag};

use crate::db::Database;
use crate::repos::{AuthorRepository, CollectionRepository, SeriesRepository, TagRepository};

/// Application boundary for library taxonomy and collection operations.
///
/// Commands depend on this service rather than constructing repositories from
/// the application context, keeping persistence ownership inside storage.
#[derive(Clone)]
pub struct CollectionService {
    db: Database,
}

impl CollectionService {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn list_collections(&self) -> Result<Vec<Collection>> {
        CollectionRepository::new(self.db.clone())
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn create_collection(
        &self,
        name: &str,
        description: Option<&str>,
        device_id: DeviceId,
    ) -> Result<Collection> {
        CollectionRepository::new(self.db.clone())
            .create(name, description, device_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn add_book_to_collection(
        &self,
        collection_id: &CollectionId,
        book_id: &BookId,
    ) -> Result<()> {
        CollectionRepository::new(self.db.clone())
            .add_book_to_collection(collection_id, book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn list_tags(&self) -> Result<Vec<Tag>> {
        TagRepository::new(self.db.clone())
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn add_tag_to_book(
        &self,
        book_id: &BookId,
        tag_name: &str,
        device_id: DeviceId,
    ) -> Result<Tag> {
        let repo = TagRepository::new(self.db.clone());
        let tag = repo
            .get_or_create_by_name(tag_name, device_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        repo.add_tag_to_book(book_id, &tag.id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        Ok(tag)
    }

    pub fn remove_tag_from_book(&self, book_id: &BookId, tag_id: &TagId) -> Result<()> {
        TagRepository::new(self.db.clone())
            .remove_tag_from_book(book_id, tag_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn list_authors(&self) -> Result<Vec<Author>> {
        AuthorRepository::new(self.db.clone())
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn list_series(&self) -> Result<Vec<Series>> {
        SeriesRepository::new(self.db.clone())
            .list_all()
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }
}
