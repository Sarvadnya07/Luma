use luma_core::error::{LumaError, Result};
use luma_core::ids::BookId;
use luma_core::models::book::{Book, ReadingStatus};
use serde::{Deserialize, Serialize};

use crate::cache::CacheManager;
use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::repos::BookRepository;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UpdateBookMetadataRequest {
    pub title: String,
    pub subtitle: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub published_date: Option<String>,
    pub language: Option<String>,
    pub isbn: Option<String>,
}

#[derive(Clone)]
pub struct BookService {
    db: Database,
    event_bus: EventBus,
    cache: CacheManager,
}

impl BookService {
    pub fn new(db: Database, event_bus: EventBus, cache: CacheManager) -> Self {
        Self {
            db,
            event_bus,
            cache,
        }
    }

    pub fn get_by_id(&self, book_id: &BookId) -> Result<Option<Book>> {
        let repo = BookRepository::new(self.db.clone());
        repo.get_by_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub async fn update_metadata(
        &self,
        book_id: &BookId,
        metadata: UpdateBookMetadataRequest,
    ) -> Result<Book> {
        let repo = BookRepository::new(self.db.clone());

        let mut book = repo
            .get_by_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?
            .ok_or_else(|| LumaError::NotFound {
                entity_type: "Book".to_string(),
                id: book_id.to_string(),
            })?;

        book.title = metadata.title;
        book.subtitle = metadata.subtitle;
        book.description = metadata.description;
        book.publisher = metadata.publisher;
        book.published_date = metadata.published_date;
        book.language = metadata.language;
        book.isbn = metadata.isbn;
        book.sync.version.0 += 1;
        book.sync.updated_at = chrono::Utc::now();

        repo.update(&book)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // Invalidate caches
        self.cache.invalidate_book(&book_id.to_string()).await;

        // Publish event
        self.event_bus
            .publish(DomainEvent::BookUpdated { book_id: *book_id });

        Ok(book)
    }

    pub async fn set_reading_status(&self, book_id: &BookId, status: ReadingStatus) -> Result<()> {
        let repo = BookRepository::new(self.db.clone());
        repo.set_reading_status(book_id, status)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.cache.invalidate_book(&book_id.to_string()).await;
        self.event_bus
            .publish(DomainEvent::BookUpdated { book_id: *book_id });

        Ok(())
    }

    pub async fn trash_book(&self, book_id: &BookId) -> Result<()> {
        let repo = BookRepository::new(self.db.clone());
        repo.move_to_trash(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.cache.invalidate_book(&book_id.to_string()).await;
        self.event_bus
            .publish(DomainEvent::BookTrashed { book_id: *book_id });

        Ok(())
    }

    pub async fn restore_book(&self, book_id: &BookId) -> Result<()> {
        let repo = BookRepository::new(self.db.clone());
        repo.restore_from_trash(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.cache.invalidate_book(&book_id.to_string()).await;
        self.event_bus
            .publish(DomainEvent::BookRestored { book_id: *book_id });

        Ok(())
    }

    pub async fn delete_book_permanently(&self, book_id: &BookId) -> Result<()> {
        let repo = BookRepository::new(self.db.clone());
        repo.delete_permanently(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.cache.invalidate_book(&book_id.to_string()).await;
        self.event_bus
            .publish(DomainEvent::BookDeleted { book_id: *book_id });

        Ok(())
    }
}
