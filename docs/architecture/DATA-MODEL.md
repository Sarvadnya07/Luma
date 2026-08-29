# Luma — Data Model

## 1. Domain Entities & Synchronization Model

Every mutable domain entity in Luma encapsulates a `SyncMetadata` envelope designed for local-first synchronization and causality tracking:

```rust
pub struct SyncMetadata {
    pub version: EntityVersion,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub device_id: DeviceId,
    pub is_deleted: bool,
    pub deleted_at: Option<DateTime<Utc>>,
}
```

---

## 2. Core Entities

### 2.1 Book & BookFile
- `Book`: Title, subtitle, description, authors, series, publication metadata, cover path, primary file pointer, sync envelope.
- `BookFile`: File path relative to library root, format (`epub` | `pdf`), file size in bytes, SHA-256 integrity hash.

### 2.2 Annotation (Highlights, Notes, Underlines)
- `id`: `AnnotationId` (UUID v7)
- `book_id`: Associated `BookId`
- `annotation_type`: `Highlight` | `Underline` | `Note` | `Bookmark`
- `color_hex`: Hexadecimal color code
- `quote`: Original highlighted text quote
- `note`: Optional markdown user comment
- `anchor_payload_json`: Serialized composite anchor (exact quote, prefix/suffix context, CFI/PDF geometry coordinates)
- `sync`: `SyncMetadata`

### 2.3 ReadingProgress & ReadingSession
- `ReadingProgress`: Per-book reading percentage, current locator string (CFI / PDF page), active chapter title, page numbers, last read timestamp.
- `ReadingSession`: Time-bounded reading segment recording duration, start progress %, end progress %, and active device.

---

## 3. SQLite Relational Schema

```sql
books (id PK, title, subtitle, series_id, series_index, description, publisher, published_date, language, isbn, cover_image_path, primary_file_id, version, created_at, updated_at, device_id, is_deleted, deleted_at)
book_files (id PK, book_id FK, format, relative_path, file_size_bytes, sha256_hash, created_at)
authors (id PK, name, sort_name, version, created_at, updated_at, device_id, is_deleted, deleted_at)
book_authors (book_id FK, author_id FK, position, PRIMARY KEY(book_id, author_id))
annotations (id PK, book_id FK, annotation_type, color_hex, quote, note, anchor_payload_json, version, created_at, updated_at, device_id, is_deleted, deleted_at)
reading_progress (book_id PK FK, progress_percentage, current_locator, current_chapter_title, current_page_number, total_pages, last_read_at, version, created_at, updated_at, device_id, is_deleted, deleted_at)
reading_sessions (id PK, book_id FK, device_id, started_at, ended_at, duration_seconds, start_progress_pct, end_progress_pct)
bookmarks (id PK, book_id FK, locator, title, chapter_title, page_number, version, created_at, updated_at, device_id, is_deleted, deleted_at)
change_records (id PK, entity_type, entity_id, version, device_id, operation, payload_json, occurred_at)
schema_migrations (version PK, applied_at)
```
