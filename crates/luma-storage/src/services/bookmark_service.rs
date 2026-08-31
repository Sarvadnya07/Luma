use luma_core::error::{LumaError, Result};
use luma_core::ids::{BookId, BookmarkId, DeviceId};
use luma_core::models::reading::Bookmark;

use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::repos::BookmarkRepository;

#[derive(Clone)]
pub struct BookmarkService {
    db: Database,
    event_bus: EventBus,
}

impl BookmarkService {
    pub fn new(db: Database, event_bus: EventBus) -> Self {
        Self { db, event_bus }
    }

    pub fn list_by_book(&self, book_id: &BookId) -> Result<Vec<Bookmark>> {
        let repo = BookmarkRepository::new(self.db.clone());
        repo.list_by_book_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn create_bookmark(
        &self,
        book_id: BookId,
        locator: String,
        title: Option<String>,
        chapter_title: Option<String>,
        page_number: Option<u32>,
        device_id: DeviceId,
    ) -> Result<Bookmark> {
        let repo = BookmarkRepository::new(self.db.clone());
        let mut bookmark = Bookmark::new(book_id, locator, device_id);
        bookmark.title = title;
        bookmark.chapter_title = chapter_title;
        bookmark.page_number = page_number;

        repo.insert(&bookmark)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.event_bus.publish(DomainEvent::BookmarkCreated {
            book_id,
            bookmark_id: bookmark.id,
        });

        Ok(bookmark)
    }

    pub fn delete_bookmark(&self, bookmark_id: &BookmarkId, book_id: Option<BookId>) -> Result<()> {
        let repo = BookmarkRepository::new(self.db.clone());
        repo.delete(bookmark_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        if let Some(bid) = book_id {
            self.event_bus.publish(DomainEvent::BookmarkDeleted {
                book_id: bid,
                bookmark_id: *bookmark_id,
            });
        }

        Ok(())
    }
}
