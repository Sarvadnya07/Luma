use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

use luma_core::error::{LumaError, Result};
use luma_core::ids::{BookId, FileId};
use luma_core::models::annotation::Annotation;
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_core::models::canonical::{
    CanonicalDocumentMetadata, CanonicalSearchMatch, CitationContext, DocumentRange,
    DocumentStructure, ResourceDescriptor, StructureNode,
};
use luma_core::models::reading::{Bookmark, ReadingProgress};
use luma_reader::{
    CanonicalDocument, CbzDocument, ChapterContent, DocumentMetadata, DocumentSearchMatch,
    EpubDocument, FormatCapabilities, HtmlDocument, MarkdownDocument, PdfDocument, PdfPageData,
    ReflowableDocument, TextDocument, TocItem,
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
    reflow_sessions: Arc<RwLock<HashMap<BookId, Arc<ReflowableDocument>>>>,
    pdf_sessions: Arc<RwLock<HashMap<BookId, Arc<PdfDocument>>>>,
    canonical_sessions: Arc<RwLock<HashMap<BookId, Arc<CanonicalDocument>>>>,
}

impl ReaderService {
    pub const MAX_CACHED_SESSIONS: usize = 5;

    pub fn new(db: Database, cache: CacheManager) -> Self {
        Self {
            db,
            cache,
            reflow_sessions: Arc::new(RwLock::new(HashMap::new())),
            pdf_sessions: Arc::new(RwLock::new(HashMap::new())),
            canonical_sessions: Arc::new(RwLock::new(HashMap::new())),
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
                let doc = Arc::new(ReflowableDocument::Epub(EpubDocument::open(&file_path)?));
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

                let mut sessions = self.reflow_sessions.write().await;
                if sessions.len() >= Self::MAX_CACHED_SESSIONS {
                    sessions.clear();
                }
                sessions.insert(*book_id, doc);

                (meta, toc_items, spine_len)
            }
            DocumentFormat::Txt => {
                let doc = Arc::new(ReflowableDocument::Text(TextDocument::open(&file_path)?));
                let spine_len = doc.spine_count() as u32;
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names.clone(),
                    language: book.language.clone(),
                    publisher: book.publisher.clone(),
                    description: book.description.clone(),
                    isbn: book.isbn.clone(),
                    format: DocumentFormat::Txt,
                    total_pages_or_spines: Some(spine_len),
                };
                let toc_items = doc.toc().to_vec();

                let mut sessions = self.reflow_sessions.write().await;
                if sessions.len() >= Self::MAX_CACHED_SESSIONS {
                    sessions.clear();
                }
                sessions.insert(*book_id, doc);

                (meta, toc_items, spine_len)
            }
            DocumentFormat::Md => {
                let doc = Arc::new(ReflowableDocument::Markdown(MarkdownDocument::open(
                    &file_path,
                )?));
                let spine_len = doc.spine_count() as u32;
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names.clone(),
                    language: book.language.clone(),
                    publisher: book.publisher.clone(),
                    description: book.description.clone(),
                    isbn: book.isbn.clone(),
                    format: DocumentFormat::Md,
                    total_pages_or_spines: Some(spine_len),
                };
                let toc_items = doc.toc().to_vec();

                let mut sessions = self.reflow_sessions.write().await;
                if sessions.len() >= Self::MAX_CACHED_SESSIONS {
                    sessions.clear();
                }
                sessions.insert(*book_id, doc);

                (meta, toc_items, spine_len)
            }
            DocumentFormat::Html => {
                let doc = Arc::new(ReflowableDocument::Html(HtmlDocument::open(&file_path)?));
                let spine_len = doc.spine_count() as u32;
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names.clone(),
                    language: book.language.clone(),
                    publisher: book.publisher.clone(),
                    description: book.description.clone(),
                    isbn: book.isbn.clone(),
                    format: DocumentFormat::Html,
                    total_pages_or_spines: Some(spine_len),
                };
                let toc_items = doc.toc().to_vec();

                let mut sessions = self.reflow_sessions.write().await;
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

                let mut sessions = self.pdf_sessions.write().await;
                if sessions.len() >= Self::MAX_CACHED_SESSIONS {
                    sessions.clear();
                }
                sessions.insert(*book_id, doc);

                (meta, toc_items, page_count)
            }
            DocumentFormat::Cbz | DocumentFormat::Cbr => {
                let cbz_doc = CbzDocument::open(&file_path)?;
                let page_count = cbz_doc.page_count() as u32;
                let meta = DocumentMetadata {
                    title: book.title.clone(),
                    authors: author_names,
                    language: book.language.clone(),
                    publisher: book.publisher.clone(),
                    description: book.description.clone(),
                    isbn: book.isbn.clone(),
                    format: file.format,
                    total_pages_or_spines: Some(page_count),
                };
                let toc_items = (1..=page_count)
                    .map(|p| TocItem {
                        title: format!("Page {p}"),
                        locator: format!("page={p}"),
                        play_order: Some(p),
                        children: Vec::new(),
                    })
                    .collect();
                (meta, toc_items, page_count)
            }
        };

        if let Ok(can_doc) = CanonicalDocument::open(&file_path, file.format) {
            let mut can_sessions = self.canonical_sessions.write().await;
            if can_sessions.len() >= Self::MAX_CACHED_SESSIONS {
                can_sessions.clear();
            }
            can_sessions.insert(*book_id, Arc::new(can_doc));
        }

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

    pub async fn get_chapter(
        &self,
        book_id: &BookId,
        spine_index: usize,
    ) -> Result<ChapterContent> {
        // Fast path: Check active session cache
        {
            let sessions = self.reflow_sessions.read().await;
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

        let doc: Arc<ReflowableDocument> = match file.format {
            DocumentFormat::Epub => Arc::new(ReflowableDocument::Epub(EpubDocument::open(
                &file.relative_path,
            )?)),
            DocumentFormat::Txt => Arc::new(ReflowableDocument::Text(TextDocument::open(
                &file.relative_path,
            )?)),
            DocumentFormat::Md => Arc::new(ReflowableDocument::Markdown(MarkdownDocument::open(
                &file.relative_path,
            )?)),
            DocumentFormat::Html => Arc::new(ReflowableDocument::Html(HtmlDocument::open(
                &file.relative_path,
            )?)),
            other => return Err(LumaError::UnsupportedFormat(format!("{:?}", other))),
        };

        let chapter = doc.get_chapter(spine_index)?;

        let mut sessions = self.reflow_sessions.write().await;
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
            let sessions = self.reflow_sessions.read().await;
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
                let doc = Arc::new(ReflowableDocument::Epub(EpubDocument::open(
                    &file.relative_path,
                )?));
                let matches = doc.search(query)?;
                let mut sessions = self.reflow_sessions.write().await;
                sessions.insert(*book_id, doc);
                Ok(matches)
            }
            DocumentFormat::Txt => {
                let doc = Arc::new(ReflowableDocument::Text(TextDocument::open(
                    &file.relative_path,
                )?));
                let matches = doc.search(query)?;
                let mut sessions = self.reflow_sessions.write().await;
                sessions.insert(*book_id, doc);
                Ok(matches)
            }
            DocumentFormat::Md => {
                let doc = Arc::new(ReflowableDocument::Markdown(MarkdownDocument::open(
                    &file.relative_path,
                )?));
                let matches = doc.search(query)?;
                let mut sessions = self.reflow_sessions.write().await;
                sessions.insert(*book_id, doc);
                Ok(matches)
            }
            DocumentFormat::Html => {
                let doc = Arc::new(ReflowableDocument::Html(HtmlDocument::open(
                    &file.relative_path,
                )?));
                let matches = doc.search(query)?;
                let mut sessions = self.reflow_sessions.write().await;
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

    /// Retrieve or lazily load the canonical document instance for a book.
    pub async fn get_or_open_canonical(&self, book_id: &BookId) -> Result<Arc<CanonicalDocument>> {
        // Fast path: Check active session cache
        {
            let sessions = self.canonical_sessions.read().await;
            if let Some(doc) = sessions.get(book_id) {
                return Ok(doc.clone());
            }
        }

        // Slow path: Look up primary file and open canonical document
        let file_repo = BookFileRepository::new(self.db.clone());
        let files = file_repo
            .list_by_book_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        let file = files.first().ok_or_else(|| LumaError::NotFound {
            entity_type: "BookFile".to_string(),
            id: book_id.to_string(),
        })?;

        let doc = Arc::new(CanonicalDocument::open(&file.relative_path, file.format)?);

        let mut sessions = self.canonical_sessions.write().await;
        if sessions.len() >= Self::MAX_CACHED_SESSIONS {
            sessions.clear();
        }
        sessions.insert(*book_id, doc.clone());

        Ok(doc)
    }

    /// Retrieve the hierarchical semantic structure tree of the document.
    pub async fn get_document_structure(&self, book_id: &BookId) -> Result<DocumentStructure> {
        let doc = self.get_or_open_canonical(book_id).await?;
        doc.structure()
    }

    /// Retrieve the text of a specific node by its unique semantic ID.
    pub async fn get_node_text(&self, book_id: &BookId, node_id: &str) -> Result<String> {
        let doc = self.get_or_open_canonical(book_id).await?;
        let structure = doc.structure()?;
        let node = structure.find_node(node_id).ok_or_else(|| LumaError::NotFound {
            entity_type: "StructureNode".to_string(),
            id: node_id.to_string(),
        })?;

        if let Some(ref txt) = node.text {
            return Ok(txt.clone());
        }

        if let Some(ref range) = node.range {
            return doc.get_range_text(range);
        }

        Ok(String::new())
    }

    /// Retrieve the exact source text spanning a contiguous document range.
    pub async fn get_range_text(
        &self,
        book_id: &BookId,
        range: &DocumentRange,
    ) -> Result<String> {
        let doc = self.get_or_open_canonical(book_id).await?;
        doc.get_range_text(range)
    }

    /// Retrieve the text of a specific paragraph within a section or page.
    pub async fn get_paragraph(
        &self,
        book_id: &BookId,
        section_or_page: usize,
        paragraph_index: usize,
    ) -> Result<String> {
        let doc = self.get_or_open_canonical(book_id).await?;
        doc.get_paragraph(section_or_page, paragraph_index)
    }

    /// Retrieve all semantic headings in the document.
    pub async fn get_document_headings(&self, book_id: &BookId) -> Result<Vec<StructureNode>> {
        let doc = self.get_or_open_canonical(book_id).await?;
        doc.get_headings()
    }

    /// Retrieve all declared resources (images, fonts, stylesheets).
    pub async fn get_document_resources(
        &self,
        book_id: &BookId,
    ) -> Result<Vec<ResourceDescriptor>> {
        let doc = self.get_or_open_canonical(book_id).await?;
        Ok(doc.get_resources())
    }

    /// Read raw byte payload of an embedded resource.
    pub async fn read_document_resource(
        &self,
        book_id: &BookId,
        href_or_id: &str,
    ) -> Result<(Vec<u8>, String)> {
        let doc = self.get_or_open_canonical(book_id).await?;
        doc.read_resource(href_or_id)
    }

    /// Generate a structured citation context for a given document range.
    pub async fn get_document_citation(
        &self,
        book_id: &BookId,
        range: &DocumentRange,
    ) -> Result<CitationContext> {
        let doc = self.get_or_open_canonical(book_id).await?;
        let book_repo = BookRepository::new(self.db.clone());
        let author_repo = crate::repos::AuthorRepository::new(self.db.clone());

        let book = book_repo
            .get_by_id(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?
            .ok_or_else(|| LumaError::NotFound {
                entity_type: "Book".to_string(),
                id: book_id.to_string(),
            })?;

        let authors: Vec<String> = author_repo
            .get_authors_for_book(book_id)
            .unwrap_or_default()
            .into_iter()
            .map(|a| a.name)
            .collect();

        let metadata = CanonicalDocumentMetadata {
            title: book.title.clone(),
            subtitle: None,
            authors,
            contributors: Vec::new(),
            language: book.language.clone(),
            publisher: book.publisher.clone(),
            publication_date: None,
            identifier: None,
            isbn: book.isbn.clone(),
            series: None,
            series_index: None,
            tags: Vec::new(),
            description: book.description.clone(),
            format: doc.format(),
            mime_type: String::new(),
            encoding: "utf-8".to_string(),
            source_fingerprint: String::new(),
            total_pages_or_spines: None,
        };

        doc.get_citation_context(range, Some(&metadata))
    }

    /// Execute a search query directly against the canonical model.
    pub async fn search_canonical(
        &self,
        book_id: &BookId,
        query: &str,
    ) -> Result<Vec<CanonicalSearchMatch>> {
        let doc = self.get_or_open_canonical(book_id).await?;
        doc.search_canonical(query)
    }
}
