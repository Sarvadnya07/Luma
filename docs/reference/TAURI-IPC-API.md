# 📡 Tauri IPC Command Reference

> **Diátaxis Mode**: Reference  
> **Source of Truth**: `apps/desktop/src-tauri/src/commands/`  
> **Audience**: Frontend engineers, plugin authors, and core contributors interacting across the Tauri 2 IPC bridge.

Luma exposes 33 typed Tauri IPC commands organized across 6 functional domains. All commands execute within Tauri's capability-secured runtime, deserializing JSON parameters into strongly-typed Rust domain entities before calling persistence repositories in `luma-storage`.

---

## 1. Library Management Commands (`library.rs`)

### `list_books`
Returns a paginated or filtered list of active books in the library.
- **Parameters**: `include_trashed: Option<bool>`, `filter: Option<LibraryFilter>`
- **Returns**: `Result<Vec<BookDto>, String>`

### `get_book_details`
Fetches complete metadata, available files, reading status, and collection mappings for a specific book.
- **Parameters**: `book_id: String`
- **Returns**: `Result<BookDetailsDto, String>`

### `update_book_metadata`
Updates editable metadata fields (title, author, series, rating, description).
- **Parameters**: `book_id: String`, `payload: UpdateBookMetadataPayload`
- **Returns**: `Result<BookDto, String>`

### `set_reading_status`
Transitions reading state (`Unread`, `Reading`, `Completed`, `Abandoned`).
- **Parameters**: `book_id: String`, `status: String`
- **Returns**: `Result<(), String>`

### `trash_book`
Soft-deletes a book by moving it to the trash view.
- **Parameters**: `book_id: String`
- **Returns**: `Result<(), String>`

### `restore_book`
Restores a previously trashed book to the active library.
- **Parameters**: `book_id: String`
- **Returns**: `Result<(), String>`

### `delete_book_permanently`
Hard-deletes book metadata, associated annotations, and physical files from disk.
- **Parameters**: `book_id: String`
- **Returns**: `Result<(), String>`

### `get_reading_progress`
Retrieves the last recorded reading position, CFI/page, and percentage read.
- **Parameters**: `book_id: String`
- **Returns**: `Result<Option<ReadingProgressDto>, String>`

### `save_reading_progress`
Persists the current reading position.
- **Parameters**: `book_id: String`, `payload: SaveProgressPayload`
- **Returns**: `Result<(), String>`

### `list_authors`
Returns a list of distinct authors across all library books with counts.
- **Returns**: `Result<Vec<AuthorDto>, String>`

### `list_series`
Returns a list of all distinct book series with member counts.
- **Returns**: `Result<Vec<SeriesDto>, String>`

---

## 2. Ingestion & Import Commands (`import.rs`)

### `import_files`
Ingests one or more document files from specified absolute disk paths.
- **Parameters**: `paths: Vec<String>`
- **Returns**: `Result<ImportResultDto, String>`

### `import_directory`
Recursively scans and imports all supported `.epub` and `.pdf` documents within a folder.
- **Parameters**: `directory_path: String`, `recursive: bool`
- **Returns**: `Result<ImportResultDto, String>`

### `reconcile_library_files`
Scans registered library files on disk, verifying hashes and flagging missing or unlinked files.
- **Returns**: `Result<ReconciliationReportDto, String>`

---

## 3. Collections & Tags (`collection.rs`)

### `list_collections`
Returns all user-defined book collections and shelves.
- **Returns**: `Result<Vec<CollectionDto>, String>`

### `create_collection`
Creates a new named collection.
- **Parameters**: `name: String`, `description: Option<String>`
- **Returns**: `Result<CollectionDto, String>`

### `add_books_to_collection`
Associates a list of books with a collection.
- **Parameters**: `collection_id: String`, `book_ids: Vec<String>`
- **Returns**: `Result<(), String>`

### `list_tags`
Returns all distinct user tags.
- **Returns**: `Result<Vec<TagDto>, String>`

### `add_tag_to_book`
Attaches a tag to a book record.
- **Parameters**: `book_id: String`, `tag_name: String`
- **Returns**: `Result<(), String>`

### `remove_tag_from_book`
Removes a tag from a book record.
- **Parameters**: `book_id: String`, `tag_name: String`
- **Returns**: `Result<(), String>`

---

## 4. Reader Engine & Spine (`reader.rs`)

### `open_reader_document`
Initializes a reading session for a given book file, returning spine manifest and document metadata.
- **Parameters**: `book_id: String`
- **Returns**: `Result<ReaderSessionDto, String>`

### `get_reader_chapter`
Extracts and returns the sanitized HTML/XHTML content and resources for a specific EPUB spine item.
- **Parameters**: `book_id: String`, `spine_index: usize`
- **Returns**: `Result<ChapterContentDto, String>`

### `get_reader_pdf_page`
Returns rendered page dimensions, text content stream, and extracted text layer coordinates for a PDF page.
- **Parameters**: `book_id: String`, `page_number: usize`
- **Returns**: `Result<PdfPageDto, String>`

### `search_document`
Executes in-document text search across all chapters or pages.
- **Parameters**: `book_id: String`, `query: String`
- **Returns**: `Result<Vec<SearchResultDto>, String>`

### `list_bookmarks`
Retrieves all user bookmarks for a book.
- **Parameters**: `book_id: String`
- **Returns**: `Result<Vec<BookmarkDto>, String>`

### `create_bookmark`
Saves a new bookmark at a specific reading locator.
- **Parameters**: `book_id: String`, `locator: ReadingLocatorPayload`
- **Returns**: `Result<BookmarkDto, String>`

### `delete_bookmark`
Removes a bookmark by ID.
- **Parameters**: `bookmark_id: String`
- **Returns**: `Result<(), String>`

---

## 5. Annotations & Anchoring (`annotation.rs`)

### `list_annotations`
Returns all highlights, notes, and annotations for a book or chapter.
- **Parameters**: `book_id: String`, `chapter_id: Option<String>`
- **Returns**: `Result<Vec<AnnotationDto>, String>`

### `save_annotation`
Persists a new multi-signal annotation (text quote, prefix context, suffix context, color, note, locator).
- **Parameters**: `payload: SaveAnnotationPayload`
- **Returns**: `Result<AnnotationDto, String>`

### `delete_annotation`
Deletes an annotation by ID.
- **Parameters**: `annotation_id: String`
- **Returns**: `Result<(), String>`

### `update_annotation_note`
Updates the markdown note or color associated with an existing annotation.
- **Parameters**: `annotation_id: String`, `note: Option<String>`, `color: Option<String>`
- **Returns**: `Result<AnnotationDto, String>`

### `resolve_anchor`
Invokes the `luma-anchor` engine to locate an annotation when layout, font size, or document revision changes.
- **Parameters**: `target: AnchorTargetPayload`
- **Returns**: `Result<AnchorResolutionResultDto, String>`

---

## 6. Global Search (`search.rs`)

### `search_library`
Executes full-text search (FTS5) across book titles, authors, descriptions, and annotation text content.
- **Parameters**: `query: String`, `limit: Option<usize>`
- **Returns**: `Result<LibrarySearchResultDto, String>`
