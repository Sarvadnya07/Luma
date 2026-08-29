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

impl Author {
    pub fn new(name: impl Into<String>, device_id: DeviceId) -> Self {
        Self {
            id: AuthorId::new(),
            name: name.into(),
            sort_name: None,
            sync: SyncMetadata::new(device_id),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Series {
    pub id: SeriesId,
    pub title: String,
    pub description: Option<String>,
    pub sync: SyncMetadata,
}

impl Series {
    pub fn new(title: impl Into<String>, device_id: DeviceId) -> Self {
        Self {
            id: SeriesId::new(),
            title: title.into(),
            description: None,
            sync: SyncMetadata::new(device_id),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tag {
    pub id: TagId,
    pub name: String,
    pub color_hex: Option<String>,
    pub sync: SyncMetadata,
}

impl Tag {
    pub fn new(name: impl Into<String>, device_id: DeviceId) -> Self {
        Self {
            id: TagId::new(),
            name: name.into(),
            color_hex: None,
            sync: SyncMetadata::new(device_id),
        }
    }
}

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
        Self {
            id: CollectionId::new(),
            name: name.into(),
            description: None,
            book_ids: Vec::new(),
            sync: SyncMetadata::new(device_id),
        }
    }
}
