# Luma — Library Test Matrix

## 1. Test Scenarios & Ingestion Matrix

| Category | Test Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **EPUB** | Standard EPUB 2 | Parses title, authors, publisher, cover | Passed |
| **EPUB** | EPUB 3 with collections | Parses series, position, cover image | Passed |
| **EPUB** | Malformed OPF XML | Recovers title from filename, doesn't panic | Passed |
| **PDF** | Standard PDF with Info dict | Extracts Title, Author, Subject | Passed |
| **PDF** | PDF with empty metadata | Falls back to sanitized filename | Passed |
| **CBZ** | Comic with `ComicInfo.xml` | Extracts series, issue #, cover page | Passed |
| **Markdown** | Markdown with YAML frontmatter | Extracts title, author, description | Passed |
| **Plain Text** | UTF-8 text file | Ingests cleanly with fallback title | Passed |
| **Duplicate** | Exact File (Level 1) | Matches SHA-256, returns existing BookFile | Passed |
| **Duplicate** | Same ISBN (Level 2) | Flags `LikelyDuplicate`, suggests attachment | Passed |
| **Duplicate** | Same Title/Author (Level 3) | Flags `PossibleDuplicate` with confidence score | Passed |
| **Persistence** | V2 Migration on Fresh DB | Creates all tables, indexes, FTS5 | Passed |
| **Persistence** | V2 Upgrade from V1 DB | Alters `books`/`book_files`, preserves data | Passed |
| **Repository** | Filter by reading status | Returns matching subset | Passed |
| **Repository** | Multi-field sorting | Returns deterministic ordered list | Passed |
| **Trash** | Soft delete & restore | Switches `active` $\leftrightarrow$ `trashed` non-destructively | Passed |
| **Search** | SQLite FTS5 prefix search | Fast snippet and book ranking | Passed |
| **Reconcile** | Missing / changed file | Marks `FileAvailability::Missing` or `Changed` | Passed |
| **Security** | Path traversal attempt | Blocked by `sanitize_relative_path` | Passed |
| **Security** | Zip bomb expansion | Blocked by `verify_archive_safety` | Passed |
