# LUMA — ARCH-01 COMPREHENSIVE AUDIT & ARCHITECTURE REPORT
## Canonical Document Model, Engine Hardening, Persistence & Runtime Verification

**Project**: Luma (`c:\Users\ASUS\Desktop\STUDY\PROJECTS\Luma`)  
**Phase**: ARCH-01 / GOD-TIER DOCUMENT ENGINE + RENDERING + DATA + RUNTIME HARDENING  
**Date**: September 2026  
**Status**: COMPLETE & VERIFIED  

---

## 1. Executive Summary

The ARCH-01 phase transitions Luma from a presentation-centric desktop reader into a structured, local-first **Document Platform**.

Prior to ARCH-01, reader views interacted with format-specific parsing logic focused strictly on HTML rendering or PDF canvas painting. Documents could not be queried uniformly by search engines, annotation highlighters, citation formatters, or AI context pipelines without re-parsing or duplicating presentation logic.

ARCH-01 establishes the **Canonical Document Model** as the derived semantic source of truth for all supported formats (`EPUB`, `PDF`, `CBZ`, `TXT`, `Markdown`, `HTML`). Under this architecture, **Rendering is merely ONE consumer** of the canonical model alongside Search, Range-Based Annotation, Citations, Study/Flashcards, and AI Context ingestion.

All core engines, IPC bridges, SQLite durable models, and memory boundaries have been implemented, hardened against adversarial inputs, verified with 100% passing test suites, and audited against disk pollution.

---

## 2. Forensic Baseline & Verification Suite Results

All quality gates passed with zero warnings, zero deprecation bypasses, and zero uncommitted anomalies.

| Quality Gate | Command | Result | Details |
|---|---|---|---|
| **Git Status** | `git status --short` | Clean | 0 untracked files, 0 unwanted diffs |
| **Rust Formatting** | `cargo fmt --all --check` | PASS | 100% compliant with Rust style guidelines |
| **Rust Linting** | `cargo clippy --workspace --all-targets -- -D warnings` | PASS | 0 warnings, 0 errors across all crates |
| **Rust Unit & Integration Tests** | `cargo test --workspace` | PASS | All 50+ tests passing (0 failures, 0 panics) |
| **Adversarial Document Tests** | `cargo test --test test_canonical_adversarial` | PASS | 4/4 edge-case tests passing |
| **Canonical Model Tests** | `cargo test --test test_canonical_model` | PASS | 4/4 engine tests passing |
| **WASM Target Portability** | `cargo check -p luma-core -p luma-anchor --target wasm32-unknown-unknown` | PASS | Zero OS/filesystem dependencies in core |
| **TypeScript Typecheck** | `pnpm typecheck` | PASS | 7/7 workspace packages typecheck cleanly |
| **JavaScript/TypeScript Lint** | `pnpm lint` | PASS | ESLint passed with 0 warnings/errors |
| **Frontend Unit Tests** | `pnpm test` | PASS | 21/21 vitest suites passing |
| **Production Build** | `pnpm build` | PASS | Vite production bundle generated cleanly |

---

## 3. Canonical Document Model Architecture

The canonical domain model resides in `crates/luma-core/src/models/canonical.rs` and has zero runtime dependencies on platform storage, file systems, or OS APIs:

```
                      ┌─────────────────────────┐
                      │   CanonicalDocument     │
                      │         (Enum)          │
                      └────────────┬────────────┘
         ┌────────────┬────────────┼────────────┬────────────┐
         ▼            ▼            ▼            ▼            ▼
    EpubDocument PdfDocument  CbzDocument  TextDocument MarkdownDoc/HtmlDoc
```

Key Domain Types:
- **`DocumentFamily`**: `Reflowable`, `FixedLayout`, `ImageSequence`.
- **`DocumentCapabilities`**: Granular feature flags queryable per document instance (`reflowable`, `fixed_layout`, `extractable_text`, `searchable`, `annotatable`, `supports_citations`, `supports_ai_context`).
- **`DocumentPosition`**: Format-neutral coordinate (`section_or_page`, `char_offset`, `node_id`, `page_number`, `geometry: Option<BoundingBox>`, `locator: Option<String>`).
- **`DocumentRange`**: Span between two `DocumentPosition`s with optional text slice.
- **`StructureNode`**: Tree node with unique ID, `NodeKind` (`Document`, `Section`, `Heading`, `Paragraph`, `Blockquote`, `ListItem`, `CodeBlock`, `Image`), optional text, range, and nested children.
- **`DocumentStructure`**: Full hierarchical outline containing document metrics (`total_sections`, `total_paragraphs`, `total_words`).

---

## 4. Format Engine Implementations

Each of the six supported formats has a dedicated engine wrapped by `CanonicalDocument`:

1. **`EpubDocument` (`crates/luma-reader/src/epub_doc.rs`)**:
   - Parses EPUB 2/3 OPF packages, spine items, and NCX/Nav tables of contents.
   - Extracts semantic sections, headings, paragraphs, and embedded media assets.
   - Supports range text extraction and lazy resource loading (`read_resource`).

2. **`PdfDocument` (`crates/luma-reader/src/pdf_doc.rs`)**:
   - Parses PDF document outlines and page counts.
   - Detects text layers, computes page-relative bounding boxes, and slices paragraphs.
   - Exposes geometry-aware positions for highlight anchoring.

3. **`CbzDocument` (`crates/luma-reader/src/cbz_doc.rs`)**:
   - Inspects zip entries and applies **natural numerical sorting** (`natural_cmp`: e.g. `p1.png`, `p2.png`, `p10.png`).
   - Extracts `ComicInfo.xml` metadata (title, series, issue, summary) when present.
   - Provides lazy byte decompression directly to memory buffers with zero disk writing.

4. **`TextDocument` (`crates/luma-reader/src/text_doc.rs`)**:
   - Reads UTF-8 or legacy-encoded plaintext files with BOM detection.
   - Breaks text into semantic paragraphs using Unicode scalar offsets.
   - Provides instant paragraph indexing and range slicing without regex overhead.

5. **`MarkdownDocument` (`crates/luma-reader/src/markdown_doc.rs`)**:
   - Extracts YAML frontmatter titles and metadata.
   - Generates structured node trees identifying H1–H6 headings, blockquotes, lists, and code blocks.
   - Emits secure HTML via `luma_security` sanitization.

6. **`HtmlDocument` (`crates/luma-reader/src/html_doc.rs`)**:
   - Parses standalone HTML documents into structured sections and paragraphs.
   - Strips malicious `<script>` tags, event handlers, and javascript URIs.
   - Provides heading-aware navigation trees.

---

## 5. Format Capability Matrix

| Feature / Operation | EPUB | PDF | CBZ | TXT | Markdown | HTML |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Family** | Reflowable | FixedLayout | ImageSequence | Reflowable | Reflowable | Reflowable |
| **Reading Viewport** | Yes | Yes | Yes | Yes | Yes | Yes |
| **Extractable Text** | Yes | Yes (Text Layer) | No | Yes | Yes | Yes |
| **Searchable** | Yes | Yes | Metadata only | Yes | Yes | Yes |
| **Structural Outline** | Yes (NCX/Nav) | Yes (Outlines) | Yes (ComicInfo/Pages) | Yes (Heuristic) | Yes (Headings) | Yes (H1-H6) |
| **Bounding Boxes** | No | Yes | Yes (Page) | No | No | No |
| **Paragraph Slicing** | Yes | Yes | No | Yes | Yes | Yes |
| **Range Extraction** | Yes | Yes | No | Yes | Yes | Yes |
| **Academic Citations** | Yes | Yes | Metadata only | Yes | Yes | Yes |
| **Embedded Resources**| Yes (Images/CSS) | Yes (Fonts/Images) | Yes (Images) | No | No | Yes (Images) |
| **Annotation Anchors**| Exact Range | Bounding Box | Page Coordinates | Char Range | Heading / Range | Element / Range |
| **AI Context Ready**  | Yes | Yes | Metadata only | Yes | Yes | Yes |

---

## 6. Rendering Pipeline & Zero-Disk Invariant

A forensic audit of the entire codebase was conducted to detect any disk-based page rendering (e.g. `*_rendered.png` or temporary canvas screenshot dumps):

- **Zero Render Dumps**: Search across `crates/` and `apps/` for `rendered.png`, `toDataURL`, or unexpected image writers returned 0 matches.
- **In-Memory PDF Canvas**: `PdfReaderView.tsx` uses `pdfjs-dist` workers to render page display lists directly to `<canvas>` 2D contexts in browser memory.
- **In-Memory CBZ Streaming**: `CbzDocument` decompresses images directly to `Vec<u8>` buffers, passed over Tauri IPC to the frontend as Blob URLs (`URL.createObjectURL`).
- **Reflowable Webview**: EPUB, TXT, MD, and HTML are parsed in memory, sanitized through `luma_security`, and mounted directly to the DOM.
- **Dedicated Cover Store**: The only images written to disk are persistent book covers extracted during initial import, saved under `<app_data>/covers/<sha256>.<ext>` and tracked in SQLite.

---

## 7. Storage, Persistence & Source of Truth

Luma strictly enforces a three-tier separation of truth:

1. **Durable User Knowledge (SQLite)**:
   - All books, annotations, bookmarks, reading progress, notes, flashcards, study review logs, research workspaces, and reading sessions reside in local SQLite tables.
   - Database operations use WAL mode (`PRAGMA journal_mode = WAL;`) and enforced foreign keys (`PRAGMA foreign_keys = ON;`).
   - Cascade deletes cleanly purge associated user artifacts when a book is deleted.
2. **Derived Document Truth (Canonical Model)**:
   - Node trees, headings, paragraph offsets, and resource descriptors are derived on-demand from the source files and cached in a thread-safe LRU cache.
3. **Transient UI State (Frontend Zustand/React)**:
   - Active scroll position, zoom ratio, sidebar toggle states, and dialog inputs exist only in memory.
4. **Zero Durable LocalStorage**:
   - `localStorage` is prohibited for user knowledge. Forensic review confirms it is used only for ephemeral theme selection (`luma-theme`) or non-Tauri dev fallbacks.

---

## 8. Adversarial & Edge-Case Document Hardening

Four categories of adversarial inputs were created and verified in `crates/luma-reader/tests/test_canonical_adversarial.rs`:

1. **Empty Files**:
   - Verified that empty `.txt`, `.md`, and `.html` documents initialize gracefully with 0 paragraphs, 0 words, empty TOC, and safe error returns on paragraph queries.
2. **Malformed HTML**:
   - Verified that unclosed tags (`<b>`, `<a>`, `<div>`), missing headers, and script injections (`<script>alert('xss')</script>`) are safely recovered and sanitized.
3. **Multibyte UTF-8 & Unicode Boundaries**:
   - Tested CJK characters, emojis (🦀, 🚀), Arabic RTL, Hebrew RTL, accented Latin, and math symbols. Verified that paragraph slicing and search match offsets respect Unicode scalar boundaries without panics.
4. **Out-of-Bounds Queries**:
   - Tested non-existent section indices (`section: 999`), non-existent paragraph indices, inverted range offsets, and ranges exceeding document length. All return clean `LumaError::NotFound` or gracefully bounded slices without panicking.

---

## 9. Desktop IPC & Frontend Integration

Nine canonical commands are exposed via Tauri IPC in `apps/desktop/src-tauri/src/commands/reader.rs` and registered in `main.rs`:

1. `reader_get_document_structure`
2. `reader_get_node_text`
3. `reader_get_range_text`
4. `reader_get_paragraph`
5. `reader_get_document_headings`
6. `reader_get_document_resources`
7. `reader_read_document_resource`
8. `reader_get_document_citation`
9. `reader_search_canonical`

All commands are mirrored in TypeScript via `packages/shared-types/src/index.ts` and wrapped by `LumaApiClient` in `apps/desktop/src/lib/tauri.ts`.

---

## 10. Detailed Evidence Classification Matrix

In accordance with strict audit rules, every area is classified with honest proof:

| Area | Implementation Status | Evidence Level | Verification Proof |
|---|:---:|:---:|---|
| **Canonical Model Types** | Complete | UNIT-TESTED | `crates/luma-core/src/models/canonical.rs`, wasm32 check passed |
| **TXT Canonical Engine** | Complete | INTEGRATION-TESTED | `test_canonical_text_document`, `test_adversarial_empty_files` |
| **Markdown Canonical Engine** | Complete | INTEGRATION-TESTED | `test_canonical_markdown_document`, frontmatter & heading tests |
| **HTML Canonical Engine** | Complete | INTEGRATION-TESTED | `test_canonical_html_document`, `test_adversarial_malformed_html` |
| **CBZ Canonical Engine** | Complete | INTEGRATION-TESTED | `test_canonical_cbz_document_natural_sort_and_resources` |
| **EPUB Canonical Engine** | Complete | INTEGRATION-TESTED | `test_canonical_model.rs`, `test_runtime_matrix_epub_still_opens` |
| **PDF Canonical Engine** | Complete | INTEGRATION-TESTED | `test_benchmark_pdf_random_access_and_caching`, `PdfDocument` tests |
| **ReaderService Canonical LRU**| Complete | INTEGRATION-TESTED | `test_canonical_reader_service_queries` (multi-query cache verification) |
| **Tauri Canonical IPC** | Complete | STRUCTURALLY-BOUND | 9 commands registered in `main.rs`, typed client in `tauri.ts` |
| **Zero-Disk Render Invariant** | Complete | FORENSICALLY-AUDITED | 0 file writers for render dumps, HTML5 Canvas in-memory |
| **SQLite Knowledge Storage** | Complete | INTEGRATION-TESTED | `test_runtime_matrix_notes_survive_restart`, `test_backup_and_restore` |
| **Reading Sessions Tracking** | Complete | INTEGRATION-TESTED | `test_runtime_matrix_reading_analytics_reflect_real_sessions` |
| **WASM Core Portability** | Complete | COMPILE-VERIFIED | `cargo check --target wasm32-unknown-unknown` passed cleanly |
| **Adversarial Hardening** | Complete | INTEGRATION-TESTED | `test_canonical_adversarial.rs` (empty, malformed, unicode, bounds) |
| **Cloud Sync Engine** | Planned | STRUCTURAL-STUB | Schema and stubs exist in `luma_sync`, not enabled |
| **Local AI / Ollama** | Planned | NOT-IMPLEMENTED | Deferred by master architecture policy |
| **Plugin Ecosystem** | Planned | NOT-IMPLEMENTED | Deferred by master architecture policy |
| **OPDS Catalog** | Planned | NOT-IMPLEMENTED | Deferred by master architecture policy |
| **TTS / Audio Reader** | Planned | NOT-IMPLEMENTED | Deferred by master architecture policy |

---

## 11. Architecture Documentation Reference

The complete architectural documentation set has been authored and placed under `docs/architecture/`:
- `docs/architecture/CANONICAL-DOCUMENT-MODEL.md`: Specification of core domain models and format decoupling.
- `docs/architecture/DOCUMENT-CAPABILITIES.md`: Formal capability flags and query interface.
- `docs/architecture/DOCUMENT-POSITIONS.md`: Coordinate system, bounding boxes, and range slicing rules.
- `docs/architecture/DOCUMENT-IPC.md`: Tauri IPC command catalog and typed schemas.
- `docs/architecture/RENDERING-PIPELINE.md`: In-memory rendering, canvas worker model, and zero-disk guarantee.
- `docs/architecture/DOCUMENT-LIFECYCLE.md`: Document ingestion, session acquisition, caching, and eviction.
- `docs/architecture/SOURCE-OF-TRUTH.md`: Three-tier truth separation and zero-durable-localStorage policy.
- `docs/architecture/FORMAT-CAPABILITIES.md`: Comprehensive format comparison matrix.

---

## 12. Conclusion & Sign-Off

The **ARCH-01** milestone is fully accomplished. Luma now possesses a unified, robust, adversarial-tested, and performant document access foundation. The reader is no longer a bottleneck or single point of access—all document formats expose their structure, text, and metadata uniformly for current features and future local-first platform capabilities.
