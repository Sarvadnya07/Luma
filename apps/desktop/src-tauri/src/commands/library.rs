use serde::{Deserialize, Serialize};
use tauri::State;

use luma_core::ids::{AuthorId, BookId};
use luma_core::models::book::{Book, BookFile, DocumentFormat, LibraryState, ReadingStatus};
use luma_core::models::metadata::{Author, Collection, Series, Tag};
use luma_core::models::reading::ReadingProgress;
use luma_storage::repos::{
    AuthorRepository, BookFileRepository, BookRepository, CollectionRepository,
    LibraryFilterOptions, LibrarySortBy, LibrarySortOptions, ReadingProgressRepository,
    SeriesRepository, TagRepository,
};
use luma_storage::Database;

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

#[derive(Debug, Clone, Deserialize)]
pub struct LibraryFilterPayload {
    pub search_query: Option<String>,
    pub format: Option<String>,
    pub reading_status: Option<String>,
    pub library_state: Option<String>,
    pub author_id: Option<String>,
    pub series_id: Option<String>,
    pub tag_id: Option<String>,
    pub collection_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LibrarySortPayload {
    pub sort_by: String,
    pub ascending: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateBookMetadataPayload {
    pub title: String,
    pub subtitle: Option<String>,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub published_date: Option<String>,
    pub language: Option<String>,
    pub isbn: Option<String>,
}

#[tauri::command]
pub fn list_books(
    db: State<'_, Database>,
    filter: Option<LibraryFilterPayload>,
    sort: Option<LibrarySortPayload>,
    page: Option<usize>,
    page_size: Option<usize>,
) -> Result<Vec<Book>, String> {
    let repo = BookRepository::new(db.inner().clone());

    let filter_opts = if let Some(f) = filter {
        LibraryFilterOptions {
            search_query: f.search_query,
            format: f.format.and_then(|s| s.parse::<DocumentFormat>().ok()),
            reading_status: f
                .reading_status
                .and_then(|s| s.parse::<ReadingStatus>().ok()),
            library_state: f.library_state.and_then(|s| s.parse::<LibraryState>().ok()),
            author_id: f.author_id.and_then(|s| s.parse::<AuthorId>().ok()),
            series_id: f.series_id.and_then(|s| s.parse().ok()),
            tag_id: f.tag_id,
            collection_id: f.collection_id,
        }
    } else {
        LibraryFilterOptions::default()
    };

    let sort_opts = if let Some(s) = sort {
        let sort_by = match s.sort_by.to_lowercase().as_str() {
            "author" => LibrarySortBy::Author,
            "created_at" => LibrarySortBy::CreatedAt,
            "last_read_at" => LibrarySortBy::LastReadAt,
            "published_date" => LibrarySortBy::PublishedDate,
            "file_size" => LibrarySortBy::FileSize,
            _ => LibrarySortBy::Title,
        };
        LibrarySortOptions {
            sort_by,
            ascending: s.ascending,
        }
    } else {
        LibrarySortOptions::default()
    };

    repo.list(
        &filter_opts,
        &sort_opts,
        page.unwrap_or(0),
        page_size.unwrap_or(100),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_book_details(
    db: State<'_, Database>,
    book_id: String,
) -> Result<Option<BookDetailViewData>, String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let book_repo = BookRepository::new(db.inner().clone());
    let file_repo = BookFileRepository::new(db.inner().clone());
    let author_repo = AuthorRepository::new(db.inner().clone());
    let series_repo = SeriesRepository::new(db.inner().clone());
    let tag_repo = TagRepository::new(db.inner().clone());
    let collection_repo = CollectionRepository::new(db.inner().clone());
    let prog_repo = ReadingProgressRepository::new(db.inner().clone());

    if let Some(book) = book_repo.get_by_id(&parsed_id).map_err(|e| e.to_string())? {
        let files = file_repo.list_by_book_id(&parsed_id).unwrap_or_default();
        let authors = author_repo
            .get_authors_for_book(&parsed_id)
            .unwrap_or_default();
        let series = if let Some(ref sid) = book.series_id {
            series_repo.get_by_id(sid).unwrap_or(None)
        } else {
            None
        };
        let tags = tag_repo.get_tags_for_book(&parsed_id).unwrap_or_default();
        let collections = collection_repo
            .get_collections_for_book(&parsed_id)
            .unwrap_or_default();
        let reading_progress = prog_repo.get(&parsed_id).unwrap_or(None);

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

#[tauri::command]
pub fn update_book_metadata(
    db: State<'_, Database>,
    book_id: String,
    metadata: UpdateBookMetadataPayload,
) -> Result<(), String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = BookRepository::new(db.inner().clone());

    if let Some(mut book) = repo.get_by_id(&parsed_id).map_err(|e| e.to_string())? {
        book.title = metadata.title;
        book.subtitle = metadata.subtitle;
        book.description = metadata.description;
        book.publisher = metadata.publisher;
        book.published_date = metadata.published_date;
        book.language = metadata.language;
        book.isbn = metadata.isbn;
        book.sync.version.0 += 1;
        book.sync.updated_at = chrono::Utc::now();

        repo.update(&book).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Book not found".to_string())
    }
}

#[tauri::command]
pub fn set_reading_status(
    db: State<'_, Database>,
    book_id: String,
    status: String,
) -> Result<(), String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let parsed_status = status.parse::<ReadingStatus>().map_err(|e| e.to_string())?;
    let repo = BookRepository::new(db.inner().clone());
    repo.set_reading_status(&parsed_id, parsed_status)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn trash_book(db: State<'_, Database>, book_id: String) -> Result<(), String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = BookRepository::new(db.inner().clone());
    repo.move_to_trash(&parsed_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_book(db: State<'_, Database>, book_id: String) -> Result<(), String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = BookRepository::new(db.inner().clone());
    repo.restore_from_trash(&parsed_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_book_permanently(
    db: State<'_, Database>,
    book_id: String,
    _delete_files: bool,
) -> Result<(), String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = BookRepository::new(db.inner().clone());
    repo.delete_permanently(&parsed_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_reading_progress(
    db: State<'_, Database>,
    book_id: String,
) -> Result<Option<ReadingProgress>, String> {
    let parsed_id = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = ReadingProgressRepository::new(db.inner().clone());
    repo.get(&parsed_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_reading_progress(
    db: State<'_, Database>,
    progress: ReadingProgress,
) -> Result<(), String> {
    let repo = ReadingProgressRepository::new(db.inner().clone());
    repo.save(&progress).map_err(|e| e.to_string())
}
