# Luma — Library Subsystem Architecture

## 1. Overview & Core Philosophy

The Luma Library subsystem transforms raw digital publication files into an organized, persistent, searchable, and local-first personal knowledge repository.

### Guiding Principles:
1. **Local-First & Data Ownership**: Zero reliance on external cloud servers for reading or organization.
2. **Logical vs Physical Separation**: A `Book` is a logical publication entity; a `BookFile` is a physical format instance (`.epub`, `.pdf`, `.cbz`, `.txt`, `.md`).
3. **Non-Destructive Library Operations**: Deletion defaults to soft-trash with full recovery capabilities. Physical files are never deleted without explicit user confirmation.
4. **Resilient Ingestion**: Malformed metadata or partial files never crash the system or corrupt the database.

---

## 2. Component Boundaries & Responsibilities

```mermaid
graph TD
    UI[React 19 Library UX] -->|Tauri IPC| CMD[Tauri Command Handlers]
    CMD --> LS[LibraryService]
    LS --> SEC[luma-security: Path & Bomb Guards]
    LS --> DET[luma-reader: FormatDetector]
    LS --> EXT[luma-reader: Extractors (EPUB, PDF, CBZ, Text)]
    LS --> COV[luma-reader: CoverStore]
    LS --> DUP[luma-storage: DuplicateDetector]
    LS --> REPO[luma-storage: Repositories]
    LS --> FTS[luma-search: SqliteFtsSearchEngine]
    REPO --> DB[(SQLite Embedded Database)]
    FTS --> DB
```

### 2.1 Layer Breakdown
- **`luma-core`**: Core domain entities (`Book`, `BookFile`, `Author`, `Series`, `Tag`, `Collection`, `CoverImage`, `ImportJob`), strongly typed UUID v7 identifiers, and version metadata.
- **`luma-security`**: Path sanitization (`sanitize_relative_path`), archive decompression bomb limits (500MB max, 100:1 ratio limit), and HTML/SVG script tag sanitizers (`sanitize_untrusted_html`).
- **`luma-reader`**: Layered format sniffer (`FormatDetector`), metadata extractors (`EpubExtractor`, `PdfExtractor`, `CbzExtractor`, `TextExtractor`), and cover thumbnail management (`CoverStore`).
- **`luma-storage`**: SQLite persistence in WAL mode with foreign keys enabled, versioned schema migrations (`V1` and `V2`), entity repositories, 4-level duplicate detection, and `LibraryService` orchestration.
- **`luma-search`**: SQLite FTS5 full-text indexing (`books_fts`) providing instant prefix queries, snippet generation, and field filtering.
- **`apps/desktop`**: Tauri 2 IPC commands and React 19 UI with full-featured library grid/list, toolbar filters, details inspection drawer, metadata editor, batch progress modal, and drag-and-drop dropzone.
