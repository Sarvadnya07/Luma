use rusqlite::params;
use std::fs;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_core::ids::DeviceId;
use luma_core::models::book::{Book, BookFile, DocumentFormat};
use luma_core::models::ingest::{
    DuplicateAssessment, DuplicateMatchLevel, ImportJob, ImportJobItem,
};
use luma_reader::cover::CoverStore;
use luma_reader::detector::FormatDetector;
use luma_reader::extractors::{CbzExtractor, EpubExtractor, PdfExtractor, TextExtractor};

use crate::cache::CacheManager;
use crate::db::Database;
use crate::duplicate::DuplicateDetector;
use crate::events::{DomainEvent, EventBus};
use crate::files::FileService;
use crate::jobs::{JobManager, JobType};
use crate::repos::{
    AuthorRepository, BookFileRepository, BookRepository, CoverRepository, SeriesRepository,
    TagRepository,
};

#[derive(Clone)]
pub struct ImportService {
    db: Database,
    file_service: FileService,
    cover_store: CoverStore,
    event_bus: EventBus,
    job_manager: JobManager,
    cache: CacheManager,
}

impl ImportService {
    pub fn new(
        db: Database,
        file_service: FileService,
        event_bus: EventBus,
        job_manager: JobManager,
        cache: CacheManager,
    ) -> Self {
        let covers_path = file_service.covers_dir().to_path_buf();
        let cover_store = CoverStore::new(covers_path);
        Self {
            db,
            file_service,
            cover_store,
            event_bus,
            job_manager,
            cache,
        }
    }

    /// Import a single file with staged processing, duplicate assessment, transactions, and events
    pub fn import_single_file<P: AsRef<Path>>(
        &self,
        file_path: P,
        device_id: DeviceId,
    ) -> Result<(Book, BookFile, DuplicateAssessment)> {
        let mut resolved_path = file_path.as_ref().to_path_buf();
        if !resolved_path.exists() {
            if let Some(filename) = resolved_path.file_name() {
                let home = std::env::var("USERPROFILE")
                    .or_else(|_| std::env::var("HOME"))
                    .ok()
                    .map(PathBuf::from);

                let candidates = [
                    self.file_service.library_dir().join(filename),
                    std::env::current_dir().unwrap_or_default().join(filename),
                    home.as_ref()
                        .map(|h| h.join("Downloads").join(filename))
                        .unwrap_or_default(),
                    home.as_ref()
                        .map(|h| h.join("Desktop").join(filename))
                        .unwrap_or_default(),
                    home.as_ref()
                        .map(|h| h.join("Documents").join(filename))
                        .unwrap_or_default(),
                ];

                for candidate in candidates {
                    if !candidate.as_os_str().is_empty() && candidate.exists() {
                        resolved_path = candidate;
                        break;
                    }
                }
            }
        }

        let path = &resolved_path;
        if !path.exists() {
            return Err(LumaError::DocumentError(format!(
                "File does not exist: {}",
                file_path.as_ref().display()
            )));
        }

        // 1. Detect format
        let format = FormatDetector::detect_from_file(path)?;

        // 2. Stage file for atomic operations and compute hash
        let staged = self.file_service.stage_file(path)?;
        let (sha256_hash, file_size_bytes) = self.file_service.hash_file(&staged.staging_path)?;

        let original_filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("document")
            .to_string();

        // 3. Extract Metadata & Cover
        let mut title = original_filename.clone();
        let subtitle = None;
        let mut authors = Vec::new();
        let mut publisher = None;
        let published_date = None;
        let mut language = None;
        let mut description = None;
        let mut isbn = None;
        let mut series_name = None;
        let mut series_index = None;
        let mut subjects = Vec::new();
        let mut cover_data = None;

        match format {
            DocumentFormat::Epub => {
                if let Ok(pkg) = EpubExtractor::extract(&staged.staging_path) {
                    title = pkg.metadata.title;
                    authors = pkg.metadata.authors;
                    publisher = pkg.metadata.publisher;
                    language = pkg.metadata.language;
                    description = pkg.metadata.description;
                    isbn = pkg.metadata.isbn;
                    series_name = pkg.series;
                    series_index = pkg.series_index;
                    subjects = pkg.subjects;
                    cover_data = pkg.cover;
                }
            }
            DocumentFormat::Pdf => {
                if let Ok(pkg) = PdfExtractor::extract(&staged.staging_path) {
                    title = pkg.metadata.title;
                    authors = pkg.metadata.authors;
                    description = pkg.metadata.description;
                    cover_data = pkg.cover;
                }
            }
            DocumentFormat::Cbz => {
                if let Ok(pkg) = CbzExtractor::extract(&staged.staging_path) {
                    title = pkg.metadata.title;
                    authors = pkg.metadata.authors;
                    series_name = pkg.series;
                    series_index = pkg.series_index;
                    description = pkg.metadata.description;
                    cover_data = pkg.cover;
                }
            }
            DocumentFormat::Txt | DocumentFormat::Md | DocumentFormat::Html => {
                if let Ok(meta) = TextExtractor::extract(&staged.staging_path, format) {
                    title = meta.title;
                    authors = meta.authors;
                    description = meta.description;
                }
            }
            _ => {}
        }

        // 4. Duplicate Assessment
        let duplicate_detector = DuplicateDetector::new(self.db.clone());
        let assessment = duplicate_detector
            .assess(
                &sha256_hash,
                isbn.as_deref(),
                &title,
                authors.first().map(|s| s.as_str()),
            )
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        // If EXACT DUPLICATE, return existing
        if assessment.level == DuplicateMatchLevel::ExactDuplicate {
            if let Some(ref existing_book_id) = assessment.existing_book_id {
                let book_repo = BookRepository::new(self.db.clone());
                let file_repo = BookFileRepository::new(self.db.clone());
                if let Ok(Some(book)) = book_repo.get_by_id(existing_book_id) {
                    if let Some(ref existing_file_id) = assessment.existing_file_id {
                        if let Ok(Some(file)) = file_repo.get_by_id(existing_file_id) {
                            return Ok((book, file, assessment));
                        }
                    }
                }
            }
        }

        // 5. Logical Book Resolution
        let book_repo = BookRepository::new(self.db.clone());
        let file_repo = BookFileRepository::new(self.db.clone());
        let author_repo = AuthorRepository::new(self.db.clone());
        let series_repo = SeriesRepository::new(self.db.clone());
        let tag_repo = TagRepository::new(self.db.clone());
        let cover_repo = CoverRepository::new(self.db.clone());

        let mut book = Book::new(title, device_id);
        book.subtitle = subtitle;
        book.description = description;
        book.publisher = publisher;
        book.published_date = published_date;
        book.language = language;
        book.isbn = isbn;
        book.series_index = series_index;

        if let Some(ref sname) = series_name {
            if let Ok(series) = series_repo.get_or_create_by_title(sname, device_id) {
                book.series_id = Some(series.id);
            }
        }

        for author_name in authors {
            if let Ok(author) = author_repo.get_or_create_by_name(&author_name, device_id) {
                if !book.author_ids.contains(&author.id) {
                    book.author_ids.push(author.id);
                }
            }
        }

        // 6. Cover extraction & persistence
        if let Some(cover) = cover_data {
            if let Ok(saved_cover) =
                self.cover_store
                    .save_cover(Some(book.id), &cover.data, &cover.mime_type)
            {
                let _ = cover_repo.insert(&saved_cover);
                book.cover_image_id = Some(saved_cover.id);
                book.cover_image_path = Some(saved_cover.relative_path);
            }
        }

        // 7. Commit staged file to library
        let target_filename = format!("{}_{}", book.id, original_filename);
        let permanent_file_path = self.file_service.library_dir().join(&target_filename);
        staged.commit(&permanent_file_path)?;

        let canonical_str = permanent_file_path.to_string_lossy().to_string();
        let mut book_file = BookFile::new(
            book.id,
            original_filename,
            canonical_str.clone(),
            format,
            file_size_bytes,
            sha256_hash,
        );
        book_file.canonical_path = Some(canonical_str);
        book.primary_file_id = Some(book_file.id);

        // 8. Database transaction persistence
        book_repo
            .insert(&book)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;
        file_repo
            .insert(&book_file)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        for sub in subjects {
            if let Ok(tag) = tag_repo.get_or_create_by_name(&sub, device_id) {
                let _ = tag_repo.add_tag_to_book(&book.id, &tag.id);
            }
        }

        // 9. Update FTS5 Search Index
        let _ = self.update_fts_index(&book);

        // 10. Invalidate search cache & Publish Domain Event
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            let cache = self.cache.clone();
            let book_id_str = book.id.to_string();
            handle.spawn(async move {
                cache.invalidate_book(&book_id_str).await;
            });
        }

        self.event_bus.publish(DomainEvent::BookImported {
            book_id: book.id,
            title: book.title.clone(),
            format,
        });

        Ok((book, book_file, assessment))
    }

    pub const MAX_IMPORT_BATCH_SIZE: usize = 5_000;
    pub const IMPORT_CHUNK_SIZE: usize = 25;

    /// Import multiple files with JobManager orchestration, cooperative yielding, and cancellation support
    pub async fn import_files<P: AsRef<Path>>(
        &self,
        paths: &[P],
        device_id: DeviceId,
    ) -> Result<ImportJob> {
        if paths.len() > Self::MAX_IMPORT_BATCH_SIZE {
            return Err(LumaError::ValidationError(format!(
                "Import batch size exceeds maximum allowed limit ({} > {})",
                paths.len(),
                Self::MAX_IMPORT_BATCH_SIZE
            )));
        }

        let (job_id, cancellation) = self
            .job_manager
            .create_job(
                JobType::Import,
                paths.len() as u32,
                Some("Importing documents"),
            )
            .await;

        let mut job = ImportJob::new(paths.len() as u32);
        let mut completed = 0;
        let mut failed = 0;
        let mut skipped = 0;

        for (idx, p) in paths.iter().enumerate() {
            if cancellation.is_cancelled() {
                self.job_manager.cancel_job(&job_id).await;
                job.status = luma_core::models::ingest::ImportJobStatus::Cancelled;
                return Ok(job);
            }

            let path_ref = p.as_ref();
            let orig_name = path_ref
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("document")
                .to_string();

            self.job_manager
                .update_progress(
                    &job_id,
                    &format!("Importing ({}/{})", idx + 1, paths.len()),
                    completed,
                    failed,
                    Some(&orig_name),
                )
                .await;

            match self.import_single_file(path_ref, device_id) {
                Ok((book, file, assessment)) => {
                    completed += 1;
                    if assessment.level == DuplicateMatchLevel::ExactDuplicate {
                        skipped += 1;
                    }
                    job.items.push(ImportJobItem {
                        source_path: path_ref.to_string_lossy().to_string(),
                        original_filename: orig_name,
                        status: "success".to_string(),
                        book_id: Some(book.id),
                        file_id: Some(file.id),
                        duplicate_level: Some(assessment.level),
                        error_message: None,
                    });
                }
                Err(err) => {
                    failed += 1;
                    job.items.push(ImportJobItem {
                        source_path: path_ref.to_string_lossy().to_string(),
                        original_filename: orig_name,
                        status: "failed".to_string(),
                        book_id: None,
                        file_id: None,
                        duplicate_level: None,
                        error_message: Some(err.to_string()),
                    });
                }
            }

            // Yield cooperatively to Tokio runtime after each chunk to allow UI readers/writes to proceed
            if (idx + 1) % Self::IMPORT_CHUNK_SIZE == 0 {
                tokio::task::yield_now().await;
            }
        }

        job.completed_count = completed;
        job.failed_count = failed;
        job.skipped_count = skipped;
        job.mark_completed();

        self.job_manager
            .complete_job(
                &job_id,
                Some(&format!(
                    "Import complete: {} succeeded, {} failed, {} skipped",
                    completed, failed, skipped
                )),
            )
            .await;

        Ok(job)
    }

    /// Scan directory recursively and import discovered documents
    pub async fn scan_directory<P: AsRef<Path>>(
        &self,
        dir_path: P,
        recursive: bool,
        device_id: DeviceId,
    ) -> Result<ImportJob> {
        let mut discovered_files = Vec::new();
        self.collect_files(dir_path.as_ref(), recursive, &mut discovered_files)?;
        self.import_files(&discovered_files, device_id).await
    }

    fn collect_files(&self, dir: &Path, recursive: bool, out: &mut Vec<PathBuf>) -> Result<()> {
        if !dir.is_dir() {
            return Ok(());
        }

        let entries = fs::read_dir(dir).map_err(|e| {
            LumaError::StorageError(format!("Failed to read directory {}: {}", dir.display(), e))
        })?;

        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() && recursive {
                self.collect_files(&p, recursive, out)?;
            } else if p.is_file() {
                if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if matches!(
                        ext_lower.as_str(),
                        "epub" | "pdf" | "cbz" | "cbr" | "txt" | "md" | "html" | "htm"
                    ) {
                        out.push(p);
                    }
                }
            }
        }
        Ok(())
    }

    fn update_fts_index(&self, book: &Book) -> Result<()> {
        self.db
            .with_conn(|conn| {
                let mut authors_stmt = conn.prepare(
                    r#"
                SELECT a.name FROM authors a
                JOIN book_authors ba ON ba.author_id = a.id
                WHERE ba.book_id = ?1
                "#,
                )?;
                let author_rows =
                    authors_stmt.query_map([book.id.to_string()], |r| r.get::<_, String>(0))?;
                let mut authors_vec = Vec::new();
                for name in author_rows.flatten() {
                    authors_vec.push(name);
                }
                let authors_str = authors_vec.join(", ");

                let series_str: String = if let Some(ref sid) = book.series_id {
                    conn.query_row(
                        "SELECT title FROM series WHERE id = ?1",
                        [sid.to_string()],
                        |r| r.get(0),
                    )
                    .unwrap_or_default()
                } else {
                    String::new()
                };

                let mut tags_stmt = conn.prepare(
                    r#"
                SELECT t.name FROM tags t
                JOIN book_tags bt ON bt.tag_id = t.id
                WHERE bt.book_id = ?1
                "#,
                )?;
                let tag_rows =
                    tags_stmt.query_map([book.id.to_string()], |r| r.get::<_, String>(0))?;
                let mut tags_vec = Vec::new();
                for tag_name in tag_rows.flatten() {
                    tags_vec.push(tag_name);
                }
                let tags_str = tags_vec.join(", ");

                conn.execute(
                    r#"
                INSERT OR REPLACE INTO books_fts (book_id, title, subtitle, authors, series, tags, description, isbn)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
                    params![
                        book.id.to_string(),
                        book.title,
                        book.subtitle.clone().unwrap_or_default(),
                        authors_str,
                        series_str,
                        tags_str,
                        book.description.clone().unwrap_or_default(),
                        book.isbn.clone().unwrap_or_default(),
                    ],
                )?;
                Ok(())
            })
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.event_bus.publish(DomainEvent::SearchIndexUpdated {
            book_id: Some(book.id),
        });

        Ok(())
    }
}
