use serde::{Deserialize, Serialize};

use luma_core::error::Result;
use luma_core::ids::{BookId, CollectionId, DeviceId};

use luma_core::models::book::{Book, BookFile, ReadingStatus};
use luma_core::models::metadata::{Author, Collection, Series, Tag};
use luma_core::models::reading::ReadingProgress;

use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::repos::{
    AuthorRepository, BookFileRepository, BookRepository, CollectionRepository,
    LibraryFilterOptions, LibrarySortOptions, ReadingProgressRepository, SeriesRepository,
    TagRepository,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookDetailViewData {
    pub book: Book,
    pub files: Vec<BookFile>,
    pub authors: Vec<Author>,
    pub series: Option<Series>,
    pub tags: Vec<Tag>,
    pub collections: Vec<Collection>,
    pub reading_progress: Option<ReadingProgress>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BulkOperationResult {
    pub total: usize,
    pub successful: usize,
    pub failed: usize,
}

#[derive(Clone)]
pub struct LibraryService {
    db: Database,
    event_bus: EventBus,
}

impl LibraryService {
    pub fn new(db: Database, event_bus: EventBus) -> Self {
        Self { db, event_bus }
    }

    pub fn list_books(
        &self,
        filter: &LibraryFilterOptions,
        sort: &LibrarySortOptions,
        page: usize,
        page_size: usize,
    ) -> Result<Vec<Book>> {
        let repo = BookRepository::new(self.db.clone());
        repo.list(filter, sort, page, page_size)
            .map_err(|e| luma_core::error::LumaError::StorageError(e.to_string()))
    }

    pub fn get_book_details(&self, book_id: &BookId) -> Result<Option<BookDetailViewData>> {
        let book_repo = BookRepository::new(self.db.clone());
        let file_repo = BookFileRepository::new(self.db.clone());
        let author_repo = AuthorRepository::new(self.db.clone());
        let series_repo = SeriesRepository::new(self.db.clone());
        let tag_repo = TagRepository::new(self.db.clone());
        let collection_repo = CollectionRepository::new(self.db.clone());
        let prog_repo = ReadingProgressRepository::new(self.db.clone());

        if let Some(book) = book_repo
            .get_by_id(book_id)
            .map_err(|e| luma_core::error::LumaError::StorageError(e.to_string()))?
        {
            let files = file_repo.list_by_book_id(book_id).unwrap_or_default();
            let authors = author_repo
                .get_authors_for_book(book_id)
                .unwrap_or_default();
            let series = if let Some(ref sid) = book.series_id {
                series_repo.get_by_id(sid).unwrap_or(None)
            } else {
                None
            };
            let tags = tag_repo.get_tags_for_book(book_id).unwrap_or_default();
            let collections = collection_repo
                .get_collections_for_book(book_id)
                .unwrap_or_default();
            let reading_progress = prog_repo.get(book_id).unwrap_or(None);

            Ok(Some(BookDetailViewData {
                book,
                files,
                authors,
                series,
                tags,
                collections,
                reading_progress,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn bulk_add_tags(
        &self,
        book_ids: &[BookId],
        tag_names: &[String],
        device_id: DeviceId,
    ) -> Result<BulkOperationResult> {
        let tag_repo = TagRepository::new(self.db.clone());
        let mut successful = 0;
        let mut failed = 0;

        for name in tag_names {
            if let Ok(tag) = tag_repo.get_or_create_by_name(name, device_id) {
                for bid in book_ids {
                    if tag_repo.add_tag_to_book(bid, &tag.id).is_ok() {
                        successful += 1;
                        self.event_bus
                            .publish(DomainEvent::BookUpdated { book_id: *bid });
                    } else {
                        failed += 1;
                    }
                }
            } else {
                failed += book_ids.len();
            }
        }

        Ok(BulkOperationResult {
            total: book_ids.len() * tag_names.len(),
            successful,
            failed,
        })
    }

    pub fn bulk_add_to_collection(
        &self,
        collection_id: &CollectionId,
        book_ids: &[BookId],
    ) -> Result<BulkOperationResult> {
        let repo = CollectionRepository::new(self.db.clone());
        let mut successful = 0;
        let mut failed = 0;

        for bid in book_ids {
            if repo.add_book_to_collection(collection_id, bid).is_ok() {
                successful += 1;
                self.event_bus
                    .publish(DomainEvent::BookUpdated { book_id: *bid });
            } else {
                failed += 1;
            }
        }

        Ok(BulkOperationResult {
            total: book_ids.len(),
            successful,
            failed,
        })
    }

    pub fn bulk_trash(&self, book_ids: &[BookId]) -> Result<BulkOperationResult> {
        let repo = BookRepository::new(self.db.clone());
        let mut successful = 0;
        let mut failed = 0;

        for bid in book_ids {
            if repo.move_to_trash(bid).is_ok() {
                successful += 1;
                self.event_bus
                    .publish(DomainEvent::BookTrashed { book_id: *bid });
            } else {
                failed += 1;
            }
        }

        Ok(BulkOperationResult {
            total: book_ids.len(),
            successful,
            failed,
        })
    }

    pub fn bulk_set_status(
        &self,
        book_ids: &[BookId],
        status: ReadingStatus,
    ) -> Result<BulkOperationResult> {
        let repo = BookRepository::new(self.db.clone());
        let mut successful = 0;
        let mut failed = 0;

        for bid in book_ids {
            if repo.set_reading_status(bid, status).is_ok() {
                successful += 1;
                self.event_bus
                    .publish(DomainEvent::BookUpdated { book_id: *bid });
            } else {
                failed += 1;
            }
        }

        Ok(BulkOperationResult {
            total: book_ids.len(),
            successful,
            failed,
        })
    }
}
