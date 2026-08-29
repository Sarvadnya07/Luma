use rusqlite::params;
use luma_core::ids::{AuthorId, BookId, CoverImageId, DeviceId, FileId, SeriesId};
use luma_core::models::book::{Book, DocumentFormat, LibraryState, ReadingStatus};
use luma_core::version::{EntityVersion, SyncMetadata};

use crate::db::Database;
use crate::error::{StorageError, StorageResult};

#[derive(Debug, Clone, Default)]
pub struct LibraryFilterOptions {
    pub search_query: Option<String>,
    pub format: Option<DocumentFormat>,
    pub reading_status: Option<ReadingStatus>,
    pub library_state: Option<LibraryState>,
    pub author_id: Option<AuthorId>,
    pub series_id: Option<SeriesId>,
    pub tag_id: Option<String>,
    pub collection_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum LibrarySortBy {
    #[default]
    Title,
    Author,
    CreatedAt,
    LastReadAt,
    PublishedDate,
    FileSize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LibrarySortOptions {
    pub sort_by: LibrarySortBy,
    pub ascending: bool,
}

impl Default for LibrarySortOptions {
    fn default() -> Self {
        Self {
            sort_by: LibrarySortBy::Title,
            ascending: true,
        }
    }
}

pub struct BookRepository {
    db: Database,
}

impl BookRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, book: &Book) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO books (
                    id, title, subtitle, series_id, series_index, description,
                    publisher, published_date, language, isbn, cover_image_id, cover_image_path,
                    primary_file_id, reading_status, library_state, trashed_at,
                    version, created_at, updated_at, device_id, is_deleted, deleted_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)
                "#,
                params![
                    book.id.to_string(),
                    book.title,
                    book.subtitle,
                    book.series_id.map(|s| s.to_string()),
                    book.series_index,
                    book.description,
                    book.publisher,
                    book.published_date,
                    book.language,
                    book.isbn,
                    book.cover_image_id.map(|c| c.to_string()),
                    book.cover_image_path,
                    book.primary_file_id.map(|f| f.to_string()),
                    book.reading_status.to_string(),
                    book.library_state.to_string(),
                    book.trashed_at.map(|d| d.to_rfc3339()),
                    book.sync.version.0 as i64,
                    book.sync.created_at.to_rfc3339(),
                    book.sync.updated_at.to_rfc3339(),
                    book.sync.device_id.to_string(),
                    if book.sync.is_deleted { 1 } else { 0 },
                    book.sync.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )?;

            // Insert book authors relationship
            for (idx, auth_id) in book.author_ids.iter().enumerate() {
                conn.execute(
                    "INSERT OR IGNORE INTO book_authors (book_id, author_id, position) VALUES (?1, ?2, ?3)",
                    params![book.id.to_string(), auth_id.to_string(), idx as i32],
                )?;
            }

            Ok(())
        })
    }

    pub fn update(&self, book: &Book) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                UPDATE books SET
                    title = ?2,
                    subtitle = ?3,
                    series_id = ?4,
                    series_index = ?5,
                    description = ?6,
                    publisher = ?7,
                    published_date = ?8,
                    language = ?9,
                    isbn = ?10,
                    cover_image_id = ?11,
                    cover_image_path = ?12,
                    primary_file_id = ?13,
                    reading_status = ?14,
                    library_state = ?15,
                    trashed_at = ?16,
                    version = ?17,
                    updated_at = ?18,
                    device_id = ?19,
                    is_deleted = ?20,
                    deleted_at = ?21
                WHERE id = ?1
                "#,
                params![
                    book.id.to_string(),
                    book.title,
                    book.subtitle,
                    book.series_id.map(|s| s.to_string()),
                    book.series_index,
                    book.description,
                    book.publisher,
                    book.published_date,
                    book.language,
                    book.isbn,
                    book.cover_image_id.map(|c| c.to_string()),
                    book.cover_image_path,
                    book.primary_file_id.map(|f| f.to_string()),
                    book.reading_status.to_string(),
                    book.library_state.to_string(),
                    book.trashed_at.map(|d| d.to_rfc3339()),
                    book.sync.version.0 as i64,
                    book.sync.updated_at.to_rfc3339(),
                    book.sync.device_id.to_string(),
                    if book.sync.is_deleted { 1 } else { 0 },
                    book.sync.deleted_at.map(|d| d.to_rfc3339()),
                ],
            )?;

            // Re-sync book authors
            conn.execute("DELETE FROM book_authors WHERE book_id = ?1", params![book.id.to_string()])?;
            for (idx, auth_id) in book.author_ids.iter().enumerate() {
                conn.execute(
                    "INSERT INTO book_authors (book_id, author_id, position) VALUES (?1, ?2, ?3)",
                    params![book.id.to_string(), auth_id.to_string(), idx as i32],
                )?;
            }

            Ok(())
        })
    }

    pub fn get_by_id(&self, id: &BookId) -> StorageResult<Option<Book>> {
        self.db.with_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, title, subtitle, series_id, series_index, description,
                       publisher, published_date, language, isbn, cover_image_id, cover_image_path,
                       primary_file_id, reading_status, library_state, trashed_at,
                       version, created_at, updated_at, device_id, is_deleted, deleted_at
                FROM books
                WHERE id = ?1 AND is_deleted = 0
                "#,
            )?;

            let mut rows = stmt.query(params![id.to_string()])?;
            if let Some(row) = rows.next()? {
                let mut book = Self::row_to_book(row)?;
                drop(rows);
                drop(stmt);

                // Fetch authors
                let mut auth_stmt = conn.prepare("SELECT author_id FROM book_authors WHERE book_id = ?1 ORDER BY position ASC")?;
                let auth_rows = auth_stmt.query_map(params![id.to_string()], |r| {
                    let aid_str: String = r.get(0)?;
                    Ok(aid_str.parse::<AuthorId>().unwrap_or_default())
                })?;

                for a in auth_rows {
                    book.author_ids.push(a?);
                }

                Ok(Some(book))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list(&self, filter: &LibraryFilterOptions, sort: &LibrarySortOptions, page: usize, page_size: usize) -> StorageResult<Vec<Book>> {
        self.db.with_conn(|conn| {
            let mut query = String::from(
                r#"
                SELECT DISTINCT b.id, b.title, b.subtitle, b.series_id, b.series_index, b.description,
                       b.publisher, b.published_date, b.language, b.isbn, b.cover_image_id, b.cover_image_path,
                       b.primary_file_id, b.reading_status, b.library_state, b.trashed_at,
                       b.version, b.created_at, b.updated_at, b.device_id, b.is_deleted, b.deleted_at
                FROM books b
                LEFT JOIN book_files f ON b.id = f.book_id
                LEFT JOIN book_authors ba ON b.id = ba.book_id
                LEFT JOIN book_tags bt ON b.id = bt.book_id
                LEFT JOIN book_collections bc ON b.id = bc.book_id
                WHERE b.is_deleted = 0
                "#,
            );

            let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

            // Library State Filter (defaults to 'active' if None)
            let state = filter.library_state.unwrap_or(LibraryState::Active);
            query.push_str(" AND b.library_state = ?");
            params_vec.push(Box::new(state.to_string()));

            if let Some(ref status) = filter.reading_status {
                query.push_str(" AND b.reading_status = ?");
                params_vec.push(Box::new(status.to_string()));
            }

            if let Some(ref fmt) = filter.format {
                query.push_str(" AND f.format = ?");
                params_vec.push(Box::new(fmt.to_string()));
            }

            if let Some(ref aid) = filter.author_id {
                query.push_str(" AND ba.author_id = ?");
                params_vec.push(Box::new(aid.to_string()));
            }

            if let Some(ref sid) = filter.series_id {
                query.push_str(" AND b.series_id = ?");
                params_vec.push(Box::new(sid.to_string()));
            }

            if let Some(ref tid) = filter.tag_id {
                query.push_str(" AND bt.tag_id = ?");
                params_vec.push(Box::new(tid.clone()));
            }

            if let Some(ref cid) = filter.collection_id {
                query.push_str(" AND bc.collection_id = ?");
                params_vec.push(Box::new(cid.clone()));
            }

            if let Some(ref search) = filter.search_query {
                if !search.trim().is_empty() {
                    query.push_str(" AND (b.title LIKE ? OR b.subtitle LIKE ? OR b.description LIKE ?)");
                    let pattern = format!("%{}%", search.trim());
                    params_vec.push(Box::new(pattern.clone()));
                    params_vec.push(Box::new(pattern.clone()));
                    params_vec.push(Box::new(pattern));
                }
            }

            // Sorting
            let sort_col = match sort.sort_by {
                LibrarySortBy::Title => "b.title",
                LibrarySortBy::Author => "b.title",
                LibrarySortBy::CreatedAt => "b.created_at",
                LibrarySortBy::LastReadAt => "b.updated_at",
                LibrarySortBy::PublishedDate => "b.published_date",
                LibrarySortBy::FileSize => "b.created_at",
            };
            let dir = if sort.ascending { "ASC" } else { "DESC" };
            query.push_str(&format!(" ORDER BY {} {} LIMIT ? OFFSET ?", sort_col, dir));

            params_vec.push(Box::new(page_size as i64));
            params_vec.push(Box::new((page * page_size) as i64));

            let rusqlite_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

            let mut stmt = conn.prepare(&query)?;
            let rows = stmt.query_map(rusqlite_params.as_slice(), Self::row_to_book)?;

            let mut books = Vec::new();
            for r in rows {
                books.push(r?);
            }
            Ok(books)
        })
    }

    pub fn set_reading_status(&self, book_id: &BookId, status: ReadingStatus) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE books SET reading_status = ?1, updated_at = datetime('now'), version = version + 1 WHERE id = ?2",
                params![status.to_string(), book_id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn move_to_trash(&self, book_id: &BookId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE books SET library_state = 'trashed', trashed_at = ?1, updated_at = ?1, version = version + 1 WHERE id = ?2",
                params![now, book_id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn restore_from_trash(&self, book_id: &BookId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE books SET library_state = 'active', trashed_at = NULL, updated_at = ?1, version = version + 1 WHERE id = ?2",
                params![now, book_id.to_string()],
            )?;
            Ok(())
        })
    }

    pub fn delete_permanently(&self, book_id: &BookId) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM books WHERE id = ?1", params![book_id.to_string()])?;
            Ok(())
        })
    }

    pub fn count(&self, filter: &LibraryFilterOptions) -> StorageResult<usize> {
        self.db.with_conn(|conn| {
            let state = filter.library_state.unwrap_or(LibraryState::Active);
            let count: i64 = conn.query_row(
                "SELECT COUNT(DISTINCT id) FROM books WHERE is_deleted = 0 AND library_state = ?1",
                params![state.to_string()],
                |r| r.get(0),
            )?;
            Ok(count as usize)
        })
    }

    fn row_to_book(row: &rusqlite::Row) -> rusqlite::Result<Book> {
        let id_str: String = row.get(0)?;
        let title: String = row.get(1)?;
        let subtitle: Option<String> = row.get(2)?;
        let series_id_str: Option<String> = row.get(3)?;
        let series_index: Option<f32> = row.get(4)?;
        let description: Option<String> = row.get(5)?;
        let publisher: Option<String> = row.get(6)?;
        let published_date: Option<String> = row.get(7)?;
        let language: Option<String> = row.get(8)?;
        let isbn: Option<String> = row.get(9)?;
        let cover_image_id_str: Option<String> = row.get(10)?;
        let cover_image_path: Option<String> = row.get(11)?;
        let primary_file_id_str: Option<String> = row.get(12)?;
        let reading_status_str: String = row.get(13)?;
        let library_state_str: String = row.get(14)?;
        let trashed_at_str: Option<String> = row.get(15)?;
        let version_num: i64 = row.get(16)?;
        let created_at_str: String = row.get(17)?;
        let updated_at_str: String = row.get(18)?;
        let device_id_str: String = row.get(19)?;
        let is_deleted_int: i32 = row.get(20)?;
        let deleted_at_str: Option<String> = row.get(21)?;

        let book_id: BookId = id_str.parse().unwrap_or_default();
        let device_id: DeviceId = device_id_str.parse().unwrap_or_default();
        let primary_file_id = primary_file_id_str.and_then(|s| s.parse::<FileId>().ok());
        let series_id = series_id_str.and_then(|s| s.parse().ok());
        let cover_image_id = cover_image_id_str.and_then(|s| s.parse::<CoverImageId>().ok());
        let reading_status = reading_status_str.parse().unwrap_or_default();
        let library_state = library_state_str.parse().unwrap_or_default();

        let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at_str)
            .map(|d| d.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let deleted_at = deleted_at_str.and_then(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|d| d.with_timezone(&chrono::Utc))
                .ok()
        });
        let trashed_at = trashed_at_str.and_then(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|d| d.with_timezone(&chrono::Utc))
                .ok()
        });

        Ok(Book {
            id: book_id,
            title,
            subtitle,
            author_ids: Vec::new(),
            series_id,
            series_index,
            description,
            publisher,
            published_date,
            language,
            isbn,
            cover_image_id,
            cover_image_path,
            primary_file_id,
            reading_status,
            library_state,
            trashed_at,
            sync: SyncMetadata {
                version: EntityVersion(version_num as u64),
                created_at,
                updated_at,
                device_id,
                is_deleted: is_deleted_int != 0,
                deleted_at,
            },
        })
    }
}
