use serde::{Deserialize, Serialize};

use crate::ids::{AuthorId, BookId, CollectionId, DeviceId, SeriesId, TagId};
use crate::version::SyncMetadata;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Author {
    pub id: AuthorId,
    pub name: String,
    pub sort_name: Option<String>,
    pub sync: SyncMetadata,
}

// ============================================================================
// Constants – validation messages and defaults
// ============================================================================

pub const ERR_EMPTY_NAME: &str = "Name cannot be empty";
pub const DEFAULT_TAG_COLOR: &str = "#3B82F6"; // Blue

// ============================================================================
// Author
// ============================================================================

impl Author {
    pub fn new(name: impl Into<String>, device_id: DeviceId) -> Self {
        let name = name.into();
        Self {
            id: AuthorId::new(),
            name,
            sort_name: None,
            sync: SyncMetadata::new(device_id),
        }
    }

    pub fn with_sort_name(mut self, sort_name: impl Into<String>) -> Self {
        self.sort_name = Some(sort_name.into());
        self
    }

    pub fn with_id(mut self, id: AuthorId) -> Self {
        self.id = id;
        self
    }

    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }
}

#[derive(Debug, Clone, Default)]
pub struct AuthorBuilder {
    name: Option<String>,
    sort_name: Option<String>,
    device_id: Option<DeviceId>,
    id: Option<AuthorId>,
    sync: Option<SyncMetadata>,
}

impl AuthorBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    pub fn sort_name(mut self, sort_name: impl Into<String>) -> Self {
        self.sort_name = Some(sort_name.into());
        self
    }

    pub fn device_id(mut self, device_id: DeviceId) -> Self {
        self.device_id = Some(device_id);
        self
    }

    pub fn id(mut self, id: AuthorId) -> Self {
        self.id = Some(id);
        self
    }

    pub fn sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = Some(sync);
        self
    }

    pub fn build(self) -> Result<Author, String> {
        let name = self.name.ok_or_else(|| ERR_EMPTY_NAME.to_string())?;
        if name.trim().is_empty() {
            return Err(ERR_EMPTY_NAME.to_string());
        }
        let device_id = self.device_id.unwrap_or_default();
        let mut author = Author::new(name, device_id);
        if let Some(sort_name) = self.sort_name {
            author.sort_name = Some(sort_name);
        }
        if let Some(id) = self.id {
            author.id = id;
        }
        if let Some(sync) = self.sync {
            author.sync = sync;
        }
        Ok(author)
    }
}

// ============================================================================
// Series
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Series {
    pub id: SeriesId,
    pub title: String,
    pub description: Option<String>,
    pub sync: SyncMetadata,
}

impl Series {
    pub fn new(title: impl Into<String>, device_id: DeviceId) -> Self {
        let title = title.into();
        Self {
            id: SeriesId::new(),
            title,
            description: None,
            sync: SyncMetadata::new(device_id),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_id(mut self, id: SeriesId) -> Self {
        self.id = id;
        self
    }

    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }
}

#[derive(Debug, Clone, Default)]
pub struct SeriesBuilder {
    title: Option<String>,
    description: Option<String>,
    device_id: Option<DeviceId>,
    id: Option<SeriesId>,
    sync: Option<SyncMetadata>,
}

impl SeriesBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn device_id(mut self, device_id: DeviceId) -> Self {
        self.device_id = Some(device_id);
        self
    }

    pub fn id(mut self, id: SeriesId) -> Self {
        self.id = Some(id);
        self
    }

    pub fn sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = Some(sync);
        self
    }

    pub fn build(self) -> Result<Series, String> {
        let title = self.title.ok_or_else(|| ERR_EMPTY_NAME.to_string())?;
        if title.trim().is_empty() {
            return Err(ERR_EMPTY_NAME.to_string());
        }
        let device_id = self.device_id.unwrap_or_default();
        let mut series = Series::new(title, device_id);
        if let Some(desc) = self.description {
            series.description = Some(desc);
        }
        if let Some(id) = self.id {
            series.id = id;
        }
        if let Some(sync) = self.sync {
            series.sync = sync;
        }
        Ok(series)
    }
}

// ============================================================================
// Tag
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tag {
    pub id: TagId,
    pub name: String,
    pub color_hex: Option<String>,
    pub sync: SyncMetadata,
}

impl Tag {
    pub fn new(name: impl Into<String>, device_id: DeviceId) -> Self {
        let name = name.into();
        Self {
            id: TagId::new(),
            name,
            color_hex: None,
            sync: SyncMetadata::new(device_id),
        }
    }

    pub fn with_color(mut self, color: impl Into<String>) -> Self {
        self.color_hex = Some(color.into());
        self
    }

    pub fn with_id(mut self, id: TagId) -> Self {
        self.id = id;
        self
    }

    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }
}

#[derive(Debug, Clone, Default)]
pub struct TagBuilder {
    name: Option<String>,
    color_hex: Option<String>,
    device_id: Option<DeviceId>,
    id: Option<TagId>,
    sync: Option<SyncMetadata>,
}

impl TagBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    pub fn color(mut self, color: impl Into<String>) -> Self {
        self.color_hex = Some(color.into());
        self
    }

    pub fn device_id(mut self, device_id: DeviceId) -> Self {
        self.device_id = Some(device_id);
        self
    }

    pub fn id(mut self, id: TagId) -> Self {
        self.id = Some(id);
        self
    }

    pub fn sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = Some(sync);
        self
    }

    pub fn build(self) -> Result<Tag, String> {
        let name = self.name.ok_or_else(|| ERR_EMPTY_NAME.to_string())?;
        if name.trim().is_empty() {
            return Err(ERR_EMPTY_NAME.to_string());
        }
        let device_id = self.device_id.unwrap_or_default();
        let mut tag = Tag::new(name, device_id);
        if let Some(color) = self.color_hex {
            tag.color_hex = Some(color);
        }
        if let Some(id) = self.id {
            tag.id = id;
        }
        if let Some(sync) = self.sync {
            tag.sync = sync;
        }
        Ok(tag)
    }
}

// ============================================================================
// Collection
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Collection {
    pub id: CollectionId,
    pub name: String,
    pub description: Option<String>,
    pub book_ids: Vec<BookId>,
    pub sync: SyncMetadata,
}

impl Collection {
    pub fn new(name: impl Into<String>, device_id: DeviceId) -> Self {
        let name = name.into();
        Self {
            id: CollectionId::new(),
            name,
            description: None,
            book_ids: Vec::new(),
            sync: SyncMetadata::new(device_id),
        }
    }

    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn with_books(mut self, book_ids: Vec<BookId>) -> Self {
        self.book_ids = book_ids;
        self
    }

    pub fn add_book(mut self, book_id: BookId) -> Self {
        self.book_ids.push(book_id);
        self
    }

    pub fn with_id(mut self, id: CollectionId) -> Self {
        self.id = id;
        self
    }

    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }
}

#[derive(Debug, Clone, Default)]
pub struct CollectionBuilder {
    name: Option<String>,
    description: Option<String>,
    book_ids: Option<Vec<BookId>>,
    device_id: Option<DeviceId>,
    id: Option<CollectionId>,
    sync: Option<SyncMetadata>,
}

impl CollectionBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    pub fn books(mut self, book_ids: Vec<BookId>) -> Self {
        self.book_ids = Some(book_ids);
        self
    }

    pub fn add_book(mut self, book_id: BookId) -> Self {
        self.book_ids.get_or_insert_with(Vec::new).push(book_id);
        self
    }

    pub fn device_id(mut self, device_id: DeviceId) -> Self {
        self.device_id = Some(device_id);
        self
    }

    pub fn id(mut self, id: CollectionId) -> Self {
        self.id = Some(id);
        self
    }

    pub fn sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = Some(sync);
        self
    }

    pub fn build(self) -> Result<Collection, String> {
        let name = self.name.ok_or_else(|| ERR_EMPTY_NAME.to_string())?;
        if name.trim().is_empty() {
            return Err(ERR_EMPTY_NAME.to_string());
        }
        let device_id = self.device_id.unwrap_or_default();
        let mut collection = Collection::new(name, device_id);
        if let Some(desc) = self.description {
            collection.description = Some(desc);
        }
        if let Some(books) = self.book_ids {
            collection.book_ids = books;
        }
        if let Some(id) = self.id {
            collection.id = id;
        }
        if let Some(sync) = self.sync {
            collection.sync = sync;
        }
        Ok(collection)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::{BookId, DeviceId};

    #[test]
    fn test_author_builder() {
        let dev = DeviceId::new();
        let author = AuthorBuilder::new()
            .name("Jane Austen")
            .sort_name("Austen, Jane")
            .device_id(dev)
            .build()
            .unwrap();

        assert_eq!(author.name, "Jane Austen");
        assert_eq!(author.sort_name.as_deref(), Some("Austen, Jane"));
    }

    #[test]
    fn test_series_builder() {
        let dev = DeviceId::new();
        let series = SeriesBuilder::new()
            .title("Foundation Series")
            .description("Sci-fi masterpiece")
            .device_id(dev)
            .build()
            .unwrap();

        assert_eq!(series.title, "Foundation Series");
        assert_eq!(series.description.as_deref(), Some("Sci-fi masterpiece"));
    }

    #[test]
    fn test_tag_builder() {
        let dev = DeviceId::new();
        let tag = TagBuilder::new()
            .name("Favorite")
            .color("#FF0000")
            .device_id(dev)
            .build()
            .unwrap();

        assert_eq!(tag.name, "Favorite");
        assert_eq!(tag.color_hex.as_deref(), Some("#FF0000"));
    }

    #[test]
    fn test_collection_builder() {
        let dev = DeviceId::new();
        let b1 = BookId::new();
        let b2 = BookId::new();
        let col = CollectionBuilder::new()
            .name("Summer Reading")
            .add_book(b1)
            .add_book(b2)
            .device_id(dev)
            .build()
            .unwrap();

        assert_eq!(col.name, "Summer Reading");
        assert_eq!(col.book_ids.len(), 2);
    }
}

