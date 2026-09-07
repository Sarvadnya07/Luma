# LUMA — ARCH-01 Implementation & Verification Report
## Canonical Document Model & Full Document Access Architecture

---

## 1. Executive Summary

**ARCH-01** has completed the architectural redesign of the document-access boundary across the Luma codebase. The reading pipeline has been transformed from a presentation-only rendering pipeline into a structured **Canonical Document Model**.

The new architecture guarantees that the reader view is only one consumer of documents, alongside search, text selection, annotation anchoring, AI context extraction, study/flashcards, citation generation, and export.

---

## 2. Implemented Components

### 2.1 Pure Domain Model (`crates/luma-core/src/models/canonical.rs`)
- **`DocumentFamily`**: `Reflowable`, `FixedLayout`, `ImageSequence`.
- **`DocumentCapabilities`**: Explicit capability declaration per format (`searchable`, `selectable`, `annotatable`, `reflowable`, `fixed_layout`, `image_sequence`, `extractable_text`, `has_geometry`, `has_resources`, `has_toc`).
- **`DocumentPosition` & `DocumentRange`**: Format-neutral location primitives with section index, character offsets, node ID, page number, and bounding box geometry.
- **`StructureNode` & `DocumentStructure`**: Semantic hierarchy tree supporting headings, paragraphs, blockquotes, lists, code blocks, images, footnotes, and page breaks.
- **`CitationContext` & `CanonicalSearchMatch`**: Structured citation generation and search matches.
- **WASM Compatibility**: Verified compilation to `wasm32-unknown-unknown` without OS or filesystem dependencies.

### 2.2 Document Engines (`crates/luma-reader`)
- **`CbzDocument` (`crates/luma-reader/src/cbz_doc.rs`)**: Comic/manga archive engine with natural numeric sorting (`page_1.jpg`, `page_2.jpg`, `page_10.jpg`), `ComicInfo.xml` metadata extraction, lazy byte extraction, and image sequence structure.
- **`TextDocument` (`crates/luma-reader/src/text_doc.rs`)**: Unicode scalar paragraph extraction, structure generation, character offset ranges, and instant paragraph querying.
- **`MarkdownDocument` (`crates/luma-reader/src/markdown_doc.rs`)**: Semantic parsing for headings, paragraphs, blockquotes, list items, and code blocks into `StructureNode`s.
- **`HtmlDocument` (`crates/luma-reader/src/html_doc.rs`)**: Block tag extraction into structured nodes with sanitized HTML presentation.
- **`EpubDocument` (`crates/luma-reader/src/epub_doc.rs`)**: Section, heading, paragraph, and image extraction; range extraction; and lazy asset resource reading.
- **`PdfDocument` (`crates/luma-reader/src/pdf_doc.rs`)**: Page-level structure extraction with bounding box geometry, paragraph extraction, and text layer detection.
- **`CanonicalDocument` (`crates/luma-reader/src/canonical.rs`)**: Unified polymorphic enum delegating across all engines with uniform query methods.

### 2.3 Storage & Session Service (`crates/luma-storage/src/services/reader_service.rs`)
- Added `canonical_sessions` in-memory session cache (`Arc<CanonicalDocument>`).
- Implemented `get_or_open_canonical`, `get_document_structure`, `get_node_text`, `get_range_text`, `get_paragraph`, `get_document_headings`, `get_document_resources`, `read_document_resource`, `get_document_citation`, and `search_canonical`.
- Retained 100% backward compatibility for `get_chapter` and `get_pdf_page`.

### 2.4 Desktop IPC & Frontend Client (`apps/desktop`)
- **Tauri Commands (`apps/desktop/src-tauri/src/commands/reader.rs` & `main.rs`)**: Registered 9 canonical commands.
- **TypeScript Definitions (`packages/shared-types/src/index.ts`)**: Exported complete typed definitions for the canonical document model.
- **Frontend Client (`apps/desktop/src/lib/tauri.ts`)**: Added typed methods to `LumaApiClient`.

---

## 3. Verification & Test Coverage

1. **Rust Unit & Integration Tests**:
   - `crates/luma-reader/tests/test_canonical_model.rs`: Tested canonical queries across TXT, Markdown, HTML, and CBZ (natural sort, resources, structure, paragraphs).
   - `crates/luma-storage/tests/test_canonical_reader_service.rs`: Tested end-to-end import, canonical document structure, headings, paragraph queries, range text, citation context, and canonical search through `ReaderService`.
2. **WASM Target Check**:
   - `cargo check -p luma-core -p luma-anchor --target wasm32-unknown-unknown` passed cleanly.
3. **Desktop & Storage Check**:
   - `cargo check -p luma-storage` passed with 0 warnings.
   - `cargo check -p luma-desktop` passed with 0 warnings.
4. **Frontend Quality Gate**:
   - `pnpm typecheck` passed cleanly across all 7 workspace projects.
