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
        let mut successful = 0;
        let mut failed = 0;

        self.db.with_conn(|conn| {
            let tx = conn.transaction().map_err(crate::error::StorageError::from)?;
            for name in tag_names {
                // Ensure tag exists
                let normalized = name.trim().to_lowercase();
                let tag_id = {
                    let mut stmt = tx.prepare("SELECT id FROM tags WHERE LOWER(name) = ?1 AND is_deleted = 0")?;
                    let mut rows = stmt.query(rusqlite::params![normalized])?;
                    if let Some(row) = rows.next()? {
                        let id_str: String = row.get(0)?;
                        id_str.parse::<luma_core::ids::TagId>().unwrap_or_default()
                    } else {
                        drop(rows);
                        drop(stmt);
                        let new_tag = Tag::new(name.trim(), device_id);
                        tx.execute(
                            "INSERT INTO tags (id, name, color_hex, version, created_at, updated_at, device_id, is_deleted) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                            rusqlite::params![
                                new_tag.id.to_string(),
                                new_tag.name,
                                new_tag.color_hex,
                                new_tag.sync.version.0 as i64,
                                new_tag.sync.created_at.to_rfc3339(),
                                new_tag.sync.updated_at.to_rfc3339(),
                                new_tag.sync.device_id.to_string(),
                                0,
                            ],
                        )?;
                        new_tag.id
                    }
                };

                for bid in book_ids {
                    if tx.execute(
                        "INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?1, ?2)",
                        rusqlite::params![bid.to_string(), tag_id.to_string()],
                    ).is_ok() {
                        successful += 1;
                    } else {
                        failed += 1;
                    }
                }
            }
            tx.commit().map_err(crate::error::StorageError::from)?;
            Ok(())
        }).map_err(|e| luma_core::error::LumaError::StorageError(e.to_string()))?;

        for bid in book_ids {
            self.event_bus
                .publish(DomainEvent::BookUpdated { book_id: *bid });
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
        let mut successful = 0;
        let mut failed = 0;

        self.db.with_conn(|conn| {
            let tx = conn.transaction().map_err(crate::error::StorageError::from)?;
            for bid in book_ids {
                let max_pos: i32 = tx.query_row(
                    "SELECT COALESCE(MAX(position), -1) + 1 FROM book_collections WHERE collection_id = ?1",
                    rusqlite::params![collection_id.to_string()],
                    |r| r.get(0),
                )?;
                if tx.execute(
                    "INSERT OR IGNORE INTO book_collections (collection_id, book_id, position) VALUES (?1, ?2, ?3)",
                    rusqlite::params![collection_id.to_string(), bid.to_string(), max_pos],
                ).is_ok() {
                    successful += 1;
                } else {
                    failed += 1;
                }
            }
            tx.commit().map_err(crate::error::StorageError::from)?;
            Ok(())
        }).map_err(|e| luma_core::error::LumaError::StorageError(e.to_string()))?;

        for bid in book_ids {
            self.event_bus
                .publish(DomainEvent::BookUpdated { book_id: *bid });
        }

        Ok(BulkOperationResult {
            total: book_ids.len(),
            successful,
            failed,
        })
    }

    pub fn bulk_trash(&self, book_ids: &[BookId]) -> Result<BulkOperationResult> {
        let mut successful = 0;
        let mut failed = 0;
        let now = chrono::Utc::now().to_rfc3339();

        self.db.with_conn(|conn| {
            let tx = conn.transaction().map_err(crate::error::StorageError::from)?;
            for bid in book_ids {
                if tx.execute(
                    "UPDATE books SET library_state = 'trashed', trashed_at = ?1, updated_at = ?1, version = version + 1 WHERE id = ?2",
                    rusqlite::params![now, bid.to_string()],
                ).is_ok() {
                    successful += 1;
                } else {
                    failed += 1;
                }
            }
            tx.commit().map_err(crate::error::StorageError::from)?;
            Ok(())
        }).map_err(|e| luma_core::error::LumaError::StorageError(e.to_string()))?;

        for bid in book_ids {
            self.event_bus
                .publish(DomainEvent::BookTrashed { book_id: *bid });
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
        let mut successful = 0;
        let mut failed = 0;

        self.db.with_conn(|conn| {
            let tx = conn.transaction().map_err(crate::error::StorageError::from)?;
            for bid in book_ids {
                if tx.execute(
                    "UPDATE books SET reading_status = ?1, updated_at = datetime('now'), version = version + 1 WHERE id = ?2",
                    rusqlite::params![status.to_string(), bid.to_string()],
                ).is_ok() {
                    successful += 1;
                } else {
                    failed += 1;
                }
            }
            tx.commit().map_err(crate::error::StorageError::from)?;
            Ok(())
        }).map_err(|e| luma_core::error::LumaError::StorageError(e.to_string()))?;

        for bid in book_ids {
            self.event_bus
                .publish(DomainEvent::BookUpdated { book_id: *bid });
        }

        Ok(BulkOperationResult {
            total: book_ids.len(),
            successful,
            failed,
        })
    }
}
