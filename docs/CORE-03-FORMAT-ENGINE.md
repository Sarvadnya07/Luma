# LUMA — CORE-03 FORMAT ENGINE
## Polymorphic Document Reader Architecture & Format Resolution

**Status**: P0 RESOLVED & TESTED  
**Date**: 2026-09-06  

---

### 1. Defect Analysis & Root Cause

Prior to CORE-03, `TextExtractor` extracted metadata from standalone `.txt`, `.md`, and `.html` files during ingestion, but `ReaderService::get_chapter` in `crates/luma-storage/src/services/reader_service.rs` unconditionally executed:
```rust
let doc = Arc::new(EpubDocument::open(&file.relative_path)?);
let chapter = doc.get_chapter(spine_index)?;
```
Because non-EPUB files are not valid zip archives containing `META-INF/container.xml`, any attempt to open a plaintext, markdown, or HTML document in the reader threw `CorruptedDocument: Invalid EPUB zip container`, crashing reader navigation.

---

### 2. Polymorphic Document Architecture

`crates/luma-reader` has been extended with dedicated document reader engines, unified under `ReflowableDocument`:

```text
DocumentFormat
    ↓
ReaderService Format Dispatch
    ├── DocumentFormat::Epub => ReflowableDocument::Epub(EpubDocument)
    ├── DocumentFormat::Pdf  => PdfDocument
    ├── DocumentFormat::Txt  => ReflowableDocument::Text(TextDocument)
    ├── DocumentFormat::Md   => ReflowableDocument::Markdown(MarkdownDocument)
    └── DocumentFormat::Html => ReflowableDocument::Html(HtmlDocument)
```

#### Document Implementations:
1. **`TextDocument` (`crates/luma-reader/src/text_doc.rs`)**:
   - Reads raw file bytes and decodes via `decode_text_bytes` with full support for UTF-8, UTF-8 BOM, UTF-16, ISO-8859-1, and Windows-1252.
   - Formats plain text into semantic, safe paragraph blocks (`<p class="reader-paragraph" id="p{idx}">`) with HTML character entity escaping (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`).
   - Supports in-document substring searching with unicode-safe boundary offsets and surrounding context snippets.
2. **`MarkdownDocument` (`crates/luma-reader/src/markdown_doc.rs`)**:
   - Parses YAML frontmatter or `# H1` headings to establish document title.
   - Renders Markdown syntax (headings `h1`-`h4`, paragraphs, lists, blockquotes, code blocks, bold, italics, inline code, and sanitized links).
   - Generates hierarchical `TocItem` list from heading elements with anchor IDs (`heading-0`, `heading-1`, etc.).
   - Runs `luma_security::sanitize_untrusted_html` over the entire document to completely neutralize `<script>`, `<iframe>`, `object`, `embed`, inline event handlers, and `javascript:` URIs.
3. **`HtmlDocument` (`crates/luma-reader/src/html_doc.rs`)**:
   - Decodes local HTML files and enforces strict sanitization via `sanitize_untrusted_html`.
   - Extracts title from `<title>` or first `<h1>`, and constructs TOC from `<h1>` and `<h2>` headings.
   - Extracts searchable raw text by safely stripping tags.
4. **`ReflowableDocument` (`crates/luma-reader/src/lib.rs`)**:
   - Polymorphic enum delegating `spine_count()`, `toc()`, `get_chapter(spine_index)`, `search(query)`, and `title()` across EPUB, Text, Markdown, and HTML engines.
5. **`ReaderService` (`crates/luma-storage/src/services/reader_service.rs`)**:
   - Replaced single `epub_sessions` cache with `reflow_sessions: Arc<RwLock<HashMap<BookId, Arc<ReflowableDocument>>>>`.
   - Format-aware dispatch in `open_document`, `get_chapter`, and `search_document`.

---

### 3. Automated Verification & Test Coverage

1. **`crates/luma-reader/tests/test_text_formats.rs`**:
   - `test_txt_ascii_unicode_cjk_arabic_devanagari`: Verified rendering and searching of English, CJK, Arabic, Devanagari, mathematical symbols, and emoji.
   - `test_txt_utf8_bom_and_long_text`: Verified UTF-8 BOM stripping and navigation across 500 paragraphs.
   - `test_markdown_full_parsing_and_security_sanitization`: Verified Markdown structure, TOC generation, code blocks, blockquotes, and security elimination of `<script>`, `<iframe>`, and `javascript:` attack vectors.
   - `test_html_document_sanitization_and_toc`: Verified HTML sanitization and TOC generation.
   - `test_reflowable_document_polymorphic_dispatch`: Verified polymorphic dispatch.
2. **`crates/luma-storage/tests/test_reader_formats_integration.rs`**:
   - End-to-end user path: `ImportService::import_single_file` -> SQLite database persistence -> `ReaderService::open_document` -> `get_chapter(0)` -> `search_document` across TXT, Markdown, and HTML. All assertions pass with 0 failures.
