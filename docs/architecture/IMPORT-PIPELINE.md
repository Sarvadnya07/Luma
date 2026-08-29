# Luma — File Ingestion Pipeline

## 1. Ingestion Lifecycle

Every document imported into Luma traverses a deterministic 10-stage ingestion pipeline:

```text
[Input File/Folder/Drop]
       ↓
1. Security & Path Verification (luma-security)
       ↓
2. Magic Header & Format Sniffing (FormatDetector)
       ↓
3. SHA-256 Checksum Computation (compute_sha256)
       ↓
4. Format-Specific Metadata Extraction (Epub/Pdf/Cbz/Text Extractors)
       ↓
5. Embedded Cover Extraction (CoverStore)
       ↓
6. 4-Level Duplicate Assessment (DuplicateDetector)
       ↓
7. Logical Book Resolution (New Book vs New File vs Duplicate)
       ↓
8. Transactional Persistence (SQLite V2 Repositories)
       ↓
9. Full-Text Search Indexing (books_fts)
       ↓
10. UI State Notification & Job Summary
```

---

## 2. Pipeline Stages

### Stage 1: Security Validation
- Path traversal verification prevents `../` or escape outside permitted root.
- Archive bomb checks prevent expansion ratios exceeding 100:1 or files larger than 500MB.
- Untrusted metadata HTML/SVG stripped of `<script>` and malicious attributes.

### Stage 2: Layered Format Detection
1. **Magic Signature**: Check binary header bytes (`%PDF-`, `PK\x03\x04`, `Rar!\x1A\x07`).
2. **Container Inspection**: Check for `mimetype` with `application/epub+zip` or `META-INF/container.xml` vs comic images.
3. **MIME / Extension Fallback**: Check file extension (`.epub`, `.pdf`, `.cbz`, `.cbr`, `.txt`, `.md`, `.html`).

### Stage 3: Hashing
- Computes cryptographic SHA-256 hash over document contents for exact duplicate identity and data integrity.

### Stage 4: Metadata Extraction
- **EPUB**: Parses Dublin Core OPF XML (`title`, `creator`, `publisher`, `language`, `identifier`/ISBN, `description`, `subject`, `belongs-to-collection`, `calibre:series`).
- **PDF**: Parses document Info dictionary and XMP metadata (`/Title`, `/Author`, `/Subject`, `/CreationDate`).
- **CBZ**: Parses `ComicInfo.xml` and page counts.
- **Markdown / Text / HTML**: Parses YAML frontmatter, first Markdown heading `# Title`, or `<title>` tag with clean filename fallback.

### Stage 5: Cover Processing
- Extracts embedded cover image (`properties="cover-image"` or `<meta name="cover">` in EPUB; first page JPEG/PNG in CBZ).
- Saves image file to sandboxed `library/covers/` directory under deterministic SHA-256 hash name.

### Stage 6: 4-Level Duplicate Assessment
1. **Level 1 (Exact Duplicate)**: Matching SHA-256 checksum $\rightarrow$ Returns existing `Book` and `BookFile` without creating duplicate records.
2. **Level 2 (Likely Duplicate)**: Matching ISBN or publication identifier $\rightarrow$ Identifies existing publication, attaching as secondary format file if requested.
3. **Level 3 (Possible Duplicate)**: Matching normalized title + primary author $\rightarrow$ Flags possible duplicate with similarity confidence score.
4. **Level 4 (Unrelated)**: New publication.

### Stage 7–9: Resolution, Persistence & Indexing
- Database transaction executes atomically: inserts `books`, `book_files`, `book_authors`, `book_tags`, and updates `books_fts` virtual table.
