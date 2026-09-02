use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use luma_core::error::{LumaError, Result};
use luma_core::ids::{BookId, FileId};
use luma_core::models::annotation::Annotation;
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_core::models::reading::{Bookmark, ReadingProgress};
use luma_reader::{
    ChapterContent, DocumentMetadata, DocumentSearchMatch, EpubDocument, FormatCapabilities,
    PdfDocument, PdfPageData, TocItem,
};

use crate::cache::CacheManager;
use crate::db::Database;
use crate::repos::{
    AnnotationRepository, BookFileRepository, BookRepository, BookmarkRepository,
    ReadingProgressRepository,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenDocumentResult {
    pub book: Book,
    pub file: BookFile,
    pub metadata: DocumentMetadata,
    pub toc: Vec<TocItem>,
    pub total_pages_or_spines: u32,
    pub capabilities: FormatCapabilities,
    pub initial_progress: Option<ReadingProgress>,
    pub annotations: Vec<Annotation>,
    pub bookmarks: Vec<Bookmark>,
}

#[derive(Clone)]
pub struct ReaderService {
    db: Database,
    #[allow(dead_code)]
    cache: CacheManager,
    epub_sessions: Arc<RwLock<HashMap<BookId, Arc<EpubDocument>>>>,
    pdf_sessions: Arc<RwLock<HashMap<BookId, Arc<PdfDocument>>>>,
}

impl ReaderService {
    pub const MAX_CACHED_SESSIONS: usize = 5;

    pub fn new(db: Database, cache: CacheManager) -> Self {
        Self {
            db,
            cache,
            epub_sessions: Arc::new(RwLock::new(HashMap::new())),
            pdf_sessions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn open_document(
        &self,
        book_id: &BookId,
        file_id: Option<&FileId>,
    ) -> Result<OpenDocumentResult> {
        let book_repo = BookRepository::new(self.db.clone());
        let file_repo = BookFileRepository::new(self.db.clone());
        let prog_repo = ReadingProgressRepository::new(self.db.clone());
        let ann_repo = AnnotationRepository::new(self.db.clone());
        let bm_repo = BookmarkRepository::new(self.db.clone());

        let book = book_repo
            .get_by_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?
            .ok_or_else(|| LumaError::NotFound {
                entity_type: "Book".to_string(),
                id: book_id.to_string(),
            })?;

        let target_file_id = if let Some(fid) = file_id {
            *fid
        } else if let Some(primary_id) = book.primary_file_id {
            primary_id
        } else {
            let files = file_repo
                .list_by_book_id(book_id)
                .map_err(|e| LumaError::StorageError(e.to_string()))?;
            files
                .first()
                .map(|f| f.id)
                .ok_or_else(|| LumaError::NotFound {
                    entity_type: "BookFile".to_string(),
                    id: book_id.to_string(),
                })?
        };

        let file = file_repo
            .get_by_id(&target_file_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?
            .ok_or_else(|| LumaError::NotFound {
                entity_type: "BookFile".to_string(),
                id: target_file_id.to_string(),
            })?;

        let file_path = PathBuf::from(&file.relative_path);
        let initial_progress = prog_repo.get(book_id).unwrap_or(None);
        let annotations = ann_repo.list_by_book(book_id).unwrap_or_default();
        let bookmarks = bm_repo.list_by_book_id(book_id).unwrap_or_default();


        let author_repo = crate::repos::AuthorRepository::new(self.db.clone());
        let author_names: Vec<String> = author_repo
            .get_authors_for_book(book_id)
            .unwrap_or_default()
            .into_iter()
            .map(|a| a.name)
            .collect();

        let (metadata, toc, total_count) = match file.format {
            DocumentFormat::Epub => {
                let doc = Arc::new(EpubDocument::open(&file_path)?);
                let spine_len = doc.spine_count() as u32;
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names.clone(),
                    language: book.language.clone(),
                    publisher: book.publisher.clone(),
                    description: book.description.clone(),
                    isbn: book.isbn.clone(),
                    format: DocumentFormat::Epub,
                    total_pages_or_spines: Some(spine_len),
                };
                let toc_items = doc.toc().to_vec();

                // Cache active session
                let mut sessions = self.epub_sessions.write().await;
                if sessions.len() >= Self::MAX_CACHED_SESSIONS {
                    sessions.clear();
                }
                sessions.insert(*book_id, doc);

                (meta, toc_items, spine_len)
            }
            DocumentFormat::Pdf => {
                let doc = Arc::new(PdfDocument::open(&file_path)?);
                let page_count = doc.page_count();
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names.clone(),
                    language: book.language.clone(),
                    publisher: book.publisher.clone(),
                    description: book.description.clone(),
                    isbn: book.isbn.clone(),
                    format: DocumentFormat::Pdf,
                    total_pages_or_spines: Some(page_count),
                };
                let toc_items = doc.toc().to_vec();

                // Cache active session
                let mut sessions = self.pdf_sessions.write().await;
                if sessions.len() >= Self::MAX_CACHED_SESSIONS {
                    sessions.clear();
                }
                sessions.insert(*book_id, doc);

                (meta, toc_items, page_count)
            }
            _ => {
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names,
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
            annotations,
            bookmarks,
        })
    }

    pub async fn get_chapter(&self, book_id: &BookId, spine_index: usize) -> Result<ChapterContent> {
        // Fast path: Check active session cache
        {
            let sessions = self.epub_sessions.read().await;
            if let Some(doc) = sessions.get(book_id) {
                return doc.get_chapter(spine_index);
            }
        }

        // Slow path: Session cache miss, open and cache
        let file_repo = BookFileRepository::new(self.db.clone());
        let files = file_repo
            .list_by_book_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let file = files.first().ok_or_else(|| LumaError::NotFound {
            entity_type: "BookFile".to_string(),
            id: book_id.to_string(),
        })?;

        let doc = Arc::new(EpubDocument::open(&file.relative_path)?);
        let chapter = doc.get_chapter(spine_index)?;

        let mut sessions = self.epub_sessions.write().await;
        if sessions.len() >= Self::MAX_CACHED_SESSIONS {
            sessions.clear();
        }
        sessions.insert(*book_id, doc);

        Ok(chapter)
    }

    pub async fn get_pdf_page(&self, book_id: &BookId, page_number: u32) -> Result<PdfPageData> {
        // Fast path: Check active session cache
        {
            let sessions = self.pdf_sessions.read().await;
            if let Some(doc) = sessions.get(book_id) {
                return doc.get_page(page_number);
            }
        }

        // Slow path: Session cache miss, open and cache
        let file_repo = BookFileRepository::new(self.db.clone());
        let files = file_repo
            .list_by_book_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let file = files.first().ok_or_else(|| LumaError::NotFound {
            entity_type: "BookFile".to_string(),
            id: book_id.to_string(),
        })?;

        let doc = Arc::new(PdfDocument::open(&file.relative_path)?);
        let page = doc.get_page(page_number)?;

        let mut sessions = self.pdf_sessions.write().await;
        if sessions.len() >= Self::MAX_CACHED_SESSIONS {
            sessions.clear();
        }
        sessions.insert(*book_id, doc);

        Ok(page)
    }

    pub async fn search_document(
        &self,
        book_id: &BookId,
        query: &str,
    ) -> Result<Vec<DocumentSearchMatch>> {
        // Fast path: Check active session cache
        {
            let sessions = self.epub_sessions.read().await;
            if let Some(doc) = sessions.get(book_id) {
                return doc.search(query);
            }
        }
        {
            let sessions = self.pdf_sessions.read().await;
            if let Some(doc) = sessions.get(book_id) {
                return doc.search(query);
            }
        }

        let file_repo = BookFileRepository::new(self.db.clone());
        let files = file_repo
            .list_by_book_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let file = files.first().ok_or_else(|| LumaError::NotFound {
            entity_type: "BookFile".to_string(),
            id: book_id.to_string(),
        })?;

        match file.format {
            DocumentFormat::Epub => {
                let doc = Arc::new(EpubDocument::open(&file.relative_path)?);
                let matches = doc.search(query)?;
                let mut sessions = self.epub_sessions.write().await;
                sessions.insert(*book_id, doc);
                Ok(matches)
            }
            DocumentFormat::Pdf => {
                let doc = Arc::new(PdfDocument::open(&file.relative_path)?);
                let matches = doc.search(query)?;
                let mut sessions = self.pdf_sessions.write().await;
                sessions.insert(*book_id, doc);
                Ok(matches)
            }
            _ => Ok(Vec::new()),
        }
    }

    pub fn get_file_bytes(&self, book_id: &BookId, file_id: Option<&FileId>) -> Result<Vec<u8>> {
        let file_repo = BookFileRepository::new(self.db.clone());
        let file = if let Some(fid) = file_id {
            file_repo
                .get_by_id(fid)
                .map_err(|e| LumaError::StorageError(e.to_string()))?
                .ok_or_else(|| LumaError::NotFound {
                    entity_type: "BookFile".to_string(),
                    id: fid.to_string(),
                })?
        } else {
            let files = file_repo
                .list_by_book_id(book_id)
                .map_err(|e| LumaError::StorageError(e.to_string()))?;
            files
                .into_iter()
                .next()
                .ok_or_else(|| LumaError::NotFound {
                    entity_type: "BookFile".to_string(),
                    id: book_id.to_string(),
                })?
        };

        std::fs::read(&file.relative_path)
            .map_err(|e| LumaError::StorageError(format!("Failed to read file bytes: {}", e)))
    }
}

