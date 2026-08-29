# Luma — Library Data Model Specification

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    BOOK ||--o{ BOOK_FILE : contains
    BOOK ||--o{ BOOK_AUTHOR : has
    AUTHOR ||--o{ BOOK_AUTHOR : writes
    BOOK ||--o| SERIES : "belongs to"
    BOOK ||--o{ BOOK_TAG : has
    TAG ||--o{ BOOK_TAG : tags
    COLLECTION ||--o{ BOOK_COLLECTION : includes
    BOOK ||--o{ BOOK_COLLECTION : member
    BOOK ||--o| COVER_IMAGE : displays
    BOOK ||--o| READING_PROGRESS : tracks
    IMPORT_JOB ||--o{ IMPORT_JOB_ITEM : logs

    BOOK {
        text id PK
        text title
        text subtitle
        text series_id FK
        real series_index
        text description
        text publisher
        text published_date
        text language
        text isbn
        text cover_image_id FK
        text cover_image_path
        text primary_file_id FK
        text reading_status
        text library_state
        text trashed_at
        integer version
        text created_at
        text updated_at
        text device_id
        integer is_deleted
        text deleted_at
    }

    BOOK_FILE {
        text id PK
        text book_id FK
        text original_filename
        text relative_path
        text canonical_path
        text format
        text mime_type
        integer file_size_bytes
        text sha256_hash
        text imported_at
        text modified_at
        text availability
    }
```

---

## 2. Core Entities

### 2.1 Book (Logical Publication)
- Represents the conceptual work (e.g. *The Rust Programming Language*).
- Holds title, subtitle, author IDs, series, series index, description, publisher, publication date, language, ISBN, reading status (`unread`, `reading`, `completed`, `archived`), library state (`active`, `archived`, `trashed`), and sync metadata.

### 2.2 BookFile (Physical Document)
- Represents a concrete file on disk (`.epub`, `.pdf`, `.cbz`, `.txt`, `.md`).
- Holds original filename, relative path, canonical absolute path, detected format, MIME type, file size in bytes, SHA-256 hash, import timestamp, last modified timestamp, and availability state (`available`, `missing`, `changed`, `invalid`).

### 2.3 Author & Series
- `Author`: Normalized author entity supporting multi-author relationships with explicit display ordering (`book_authors.position`).
- `Series`: Named series container supporting fractional and non-numeric positions (e.g. `1.5`, `A`, `Special`).

### 2.4 Tags vs Collections
- **Tags**: Descriptive labels that characterize the content of the book (e.g. `#rust`, `#systems`, `#distributed`).
- **Collections**: User-defined organizational folders for structuring their library (e.g. `To Read 2026`, `Computer Science Core`).
