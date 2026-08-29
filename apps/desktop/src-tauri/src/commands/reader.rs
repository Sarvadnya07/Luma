use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::State;

use luma_core::ids::{AnnotationId, BookId, BookmarkId, DeviceId, FileId};
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_core::models::reading::{Bookmark, ReadingProgress};
use luma_reader::{
    ChapterContent, DocumentMetadata, DocumentSearchMatch, EpubDocument, FormatCapabilities,
    PdfDocument, PdfPageData, TocItem,
};
use luma_storage::repos::{
    AnnotationRepository, BookFileRepository, BookRepository, BookmarkRepository,
    ReadingProgressRepository,
};
use luma_storage::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenDocumentResult {
    pub book: Book,
    pub file: BookFile,
    pub metadata: DocumentMetadata,
    pub toc: Vec<TocItem>,
    pub total_pages_or_spines: u32,
    pub capabilities: FormatCapabilities,
    pub initial_progress: Option<ReadingProgress>,
}

#[tauri::command]
pub fn open_reader_document(
    db: State<'_, Database>,
    book_id: String,
    file_id: Option<String>,
) -> Result<OpenDocumentResult, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let book_repo = BookRepository::new(db.inner().clone());
    let file_repo = BookFileRepository::new(db.inner().clone());
    let prog_repo = ReadingProgressRepository::new(db.inner().clone());

    let book = book_repo
        .get_by_id(&bid)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Book not found".to_string())?;

    let target_file_id = if let Some(fid_str) = file_id {
        fid_str.parse::<FileId>().map_err(|e| e.to_string())?
    } else if let Some(primary_id) = book.primary_file_id {
        primary_id
    } else {
        let files = file_repo.list_by_book_id(&bid).map_err(|e| e.to_string())?;
        files.first().map(|f| f.id).ok_or_else(|| "No files found for book".to_string())?
    };

    let file = file_repo
        .get_by_id(&target_file_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Document file not found".to_string())?;

    let file_path = PathBuf::from(&file.relative_path);
    let initial_progress = prog_repo.get(&bid).unwrap_or(None);

    let (metadata, toc, total_count) = match file.format {
        DocumentFormat::Epub => {
            let doc = EpubDocument::open(&file_path).map_err(|e| e.to_string())?;
            let spine_len = doc.spine_count() as u32;
            let meta = DocumentMetadata {
                title: book.title.clone(),
                authors: Vec::new(),
                language: book.language.clone(),
                publisher: book.publisher.clone(),
                description: book.description.clone(),
                isbn: book.isbn.clone(),
                format: DocumentFormat::Epub,
                total_pages_or_spines: Some(spine_len),
            };
            (meta, doc.toc().to_vec(), spine_len)
        }
        DocumentFormat::Pdf => {
            let doc = PdfDocument::open(&file_path).map_err(|e| e.to_string())?;
            let page_count = doc.page_count();
            let meta = DocumentMetadata {
                title: book.title.clone(),
                authors: Vec::new(),
                language: book.language.clone(),
                publisher: book.publisher.clone(),
                description: book.description.clone(),
                isbn: book.isbn.clone(),
                format: DocumentFormat::Pdf,
                total_pages_or_spines: Some(page_count),
            };
            (meta, doc.toc().to_vec(), page_count)
        }
        _ => {
            let meta = DocumentMetadata {
                title: book.title.clone(),
                authors: Vec::new(),
                language: book.language.clone(),
                publisher: book.publisher.clone(),
                description: book.description.clone(),
                isbn: book.isbn.clone(),
                format: file.format,
                total_pages_or_spines: Some(1),
            };
            (meta, Vec::new(), 1)
        }
    };

    let capabilities = FormatCapabilities::for_format(file.format);

    Ok(OpenDocumentResult {
        book,
        file,
        metadata,
        toc,
        total_pages_or_spines: total_count,
        capabilities,
        initial_progress,
    })
}

#[tauri::command]
pub fn get_reader_chapter(
    db: State<'_, Database>,
    book_id: String,
    spine_index: usize,
) -> Result<ChapterContent, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let file_repo = BookFileRepository::new(db.inner().clone());
    let files = file_repo.list_by_book_id(&bid).map_err(|e| e.to_string())?;
    let file = files.first().ok_or_else(|| "No file found".to_string())?;

    let doc = EpubDocument::open(&file.relative_path).map_err(|e| e.to_string())?;
    doc.get_chapter(spine_index).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_reader_pdf_page(
    db: State<'_, Database>,
    book_id: String,
    page_number: u32,
) -> Result<PdfPageData, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let file_repo = BookFileRepository::new(db.inner().clone());
    let files = file_repo.list_by_book_id(&bid).map_err(|e| e.to_string())?;
    let file = files.first().ok_or_else(|| "No file found".to_string())?;

    let doc = PdfDocument::open(&file.relative_path).map_err(|e| e.to_string())?;
    doc.get_page(page_number).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_document(
    db: State<'_, Database>,
    book_id: String,
    query: String,
) -> Result<Vec<DocumentSearchMatch>, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let file_repo = BookFileRepository::new(db.inner().clone());
    let files = file_repo.list_by_book_id(&bid).map_err(|e| e.to_string())?;
    let file = files.first().ok_or_else(|| "No file found".to_string())?;

    match file.format {
        DocumentFormat::Epub => {
            let doc = EpubDocument::open(&file.relative_path).map_err(|e| e.to_string())?;
            doc.search(&query).map_err(|e| e.to_string())
        }
        DocumentFormat::Pdf => {
            let doc = PdfDocument::open(&file.relative_path).map_err(|e| e.to_string())?;
            doc.search(&query).map_err(|e| e.to_string())
        }
        _ => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn list_bookmarks(db: State<'_, Database>, book_id: String) -> Result<Vec<Bookmark>, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = BookmarkRepository::new(db.inner().clone());
    repo.list_by_book_id(&bid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_bookmark(
    db: State<'_, Database>,
    book_id: String,
    locator: String,
    title: Option<String>,
    chapter_title: Option<String>,
    page_number: Option<u32>,
) -> Result<Bookmark, String> {
    let bid = book_id.parse::<BookId>().map_err(|e| e.to_string())?;
    let repo = BookmarkRepository::new(db.inner().clone());
    let mut bookmark = Bookmark::new(bid, locator, DeviceId::new());
    bookmark.title = title;
    bookmark.chapter_title = chapter_title;
    bookmark.page_number = page_number;

    repo.insert(&bookmark).map_err(|e| e.to_string())?;
    Ok(bookmark)
}

#[tauri::command]
pub fn delete_bookmark(db: State<'_, Database>, bookmark_id: String) -> Result<(), String> {
    let bmid = bookmark_id.parse::<BookmarkId>().map_err(|e| e.to_string())?;
    let repo = BookmarkRepository::new(db.inner().clone());
    repo.delete(&bmid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_annotation(db: State<'_, Database>, annotation_id: String) -> Result<(), String> {
    let aid = annotation_id.parse::<AnnotationId>().map_err(|e| e.to_string())?;
    let repo = AnnotationRepository::new(db.inner().clone());
    repo.delete(&aid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_annotation_note(
    db: State<'_, Database>,
    annotation_id: String,
    note: Option<String>,
) -> Result<(), String> {
    let aid = annotation_id.parse::<AnnotationId>().map_err(|e| e.to_string())?;
    let repo = AnnotationRepository::new(db.inner().clone());
    repo.update_note(&aid, note.as_deref()).map_err(|e| e.to_string())
}
