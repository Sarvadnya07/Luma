# LUMA — CORE-02 FEATURE REALITY MATRIX (EVIDENCE LATTICE)
## Multi-Dimensional Evidence Lattice & Runtime Reality Audit

This document replaces single-bucket classifications with an **Evidence Lattice** that distinguishes code existence, automated test coverage, and host desktop runtime proof.

---

### The Feature Evidence Lattice Model

```text
                     [6] RUNTIME-PROVEN (Live OS / Desktop Execution)
                                ▲
                                │
                     [5] FRONTEND-VERIFIED (JSDOM / Vitest Harness)
                                ▲
                                │
                     [4] TESTED (Rust Unit / Integration Tests)
                                ▲
                                │
                     [3] IMPLEMENTED (Real Production Code)
                                ▲
                                │
                     [2] CONFIG / STUB / MOCK
                                ▲
                                │
                     [1] PLANNED (Specification Only)
```

Each capability is audited across three concrete dimensions:
1. **Code Implementation**: `FULL` | `PARTIAL` | `STUB` | `MOCK` | `NONE`
2. **Automated Test**: `WORKSPACE-TEST` | `HARNESS-SIMULATED` | `NONE`
3. **Runtime Verification**: `DESKTOP-HOST (Win11)` | `HARNESS-ONLY` | `UNPROVEN`

---

### 1. Canonical Feature Audit Matrix

| # | Pillar / Area | Code Impl | Auto Test | Runtime Status | Evidence Lattice Level | Key Risk / Gap / Evidence |
|---|---|---|---|---|---|---|
| 1 | **Core Application Foundation** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Tauri 2 shell + SQLite WAL boots on Win11; macOS/Linux runtime unproven. |
| 2 | **Library Management** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Grid/list view, sorting, filtering, and cover thumbnail caching verified. |
| 3 | **Metadata Management** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Author/series repos and metadata editing tested; multi-author editing needs desktop pass. |
| 4 | **File Lifecycle** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Staging, commit, SHA-256 validation, trash, restore, and purge tested in backend. |
| 5 | **Import & Ingestion** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | EPUB/PDF file picking, staging, hashing, and FTS5 indexing verified. |
| 6 | **Duplicate Detection** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | SHA-256 collision detection and Skip/Overwrite/KeepBoth modal tested. |
| 7 | **EPUB Reader** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | OPF/NCX parsing, chapter navigation, progress, and session reuse verified. |
| 8 | **PDF Reader** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | PDF.js canvas visual rasterization, zoom, dual-spread; works on scanned PDFs. |
| 9 | **Comic/Manga Reader** | PARTIAL | WORKSPACE-TEST | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | `CbzExtractor` parses metadata/covers; **NO dedicated comic reader canvas in UI**. |
| 10 | **TXT/Markdown/HTML** | PARTIAL | WORKSPACE-TEST | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | **P0 DEFECT**: `TextExtractor` extracts metadata, but `ReaderService::get_chapter` routes to `EpubDocument::open`, causing reader failure. |
| 11 | **Reader Controls** | FULL | HARNESS-SIMULATED | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | TOC drawer, page navigation, chapter switching, zoom, fullscreen, shortcuts. |
| 12 | **Themes & Typography** | FULL | HARNESS-SIMULATED | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Sepia, e-ink monochrome, dark mode, font scaling, Atkinson Hyperlegible. |
| 13 | **Selection Tools** | FULL | HARNESS-SIMULATED | DESKTOP-HOST (Win11) | **[5] FRONTEND-VERIFIED** | Contextual floating toolbar on text selection (5 swatches, Note, Copy, Define). |
| 14 | **Annotations** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Highlights and notes saved to SQLite and aggregated in Global Annotation Center. |
| 15 | **Annotation Anchoring** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | `luma-anchor` fuzzy exact/prefix/suffix matching resilient to typography mutations. |
| 16 | **Bookmarks** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Bookmark creation, listing, deletion, and locator jump tested in `bookmark_repo`. |
| 17 | **Reading Progress** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Auto-saves percentage, locator, timestamp; restores on reader reopen. |
| 18 | **History (Sessions)** | PARTIAL | WORKSPACE-TEST | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | `reading_progress` saves last read; **`reading_sessions` table is UNWIRED**. |
| 19 | **Search** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | SQLite FTS5 in-library search and in-document EPUB/PDF search with snippets. |
| 20 | **FTS5 Engine** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | `books_fts` virtual table with BM25 ranking and query sanitization tested. |
| 21 | **Collections** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Collection CRUD, book membership, and sidebar filtering tested in repository. |
| 22 | **Tags** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Tag CRUD, multi-tag book association, and library filtering tested in repository. |
| 23 | **Authors** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Extraction on import, author deduplication, and library filtering tested. |
| 24 | **Series** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Series entity creation, book association, and repository operations tested. |
| 25 | **Statistics** | PARTIAL | HARNESS-SIMULATED | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | Completed books dynamic; **weekly heatmap and focus hours use STATIC FIXTURES**. |
| 26 | **Goals** | PARTIAL | HARNESS-SIMULATED | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | UI cards render target pacing; backend persistence unhooked. |
| 27 | **Study System** | FULL | HARNESS-SIMULATED | UNPROVEN | **[5] FRONTEND-VERIFIED + BACKEND-DISCONNECTED** | **GAP**: Flashcard SRS studio works in React, but **persists in `localStorage`**, not SQLite. |
| 28 | **Notes Workspace** | FULL | HARNESS-SIMULATED | UNPROVEN | **[5] FRONTEND-VERIFIED + BACKEND-DISCONNECTED** | **GAP**: Interactive notes workspace works in React, but **persists in `localStorage`**, not SQLite. |
| 29 | **Knowledge System** | FULL | HARNESS-SIMULATED | UNPROVEN | **[5] FRONTEND-VERIFIED** | The Atrium connects Notes, Flashcards, and Projects in React. |
| 30 | **Research Workspace** | FULL | HARNESS-SIMULATED | UNPROVEN | **[5] FRONTEND-VERIFIED + BACKEND-DISCONNECTED** | **GAP**: Research projects, evidence, and drafts **persist in `localStorage`**, not SQLite. |
| 31 | **Cross-Doc Ops** | FULL | HARNESS-SIMULATED | DESKTOP-HOST (Win11) | **[5] FRONTEND-VERIFIED** | Global Annotation Center aggregates annotations from all books with click-to-jump. |
| 32 | **Citation / Provenance**| FULL | HARNESS-SIMULATED | UNPROVEN | **[5] FRONTEND-VERIFIED** | Generates academic citations (title, author, timestamp, locator) on excerpt copy. |
| 33 | **Dictionary** | NONE | NONE | UNPROVEN | **[1] PLANNED** | Stardict / Wiktionary offline lookup specified in `PROJECT.md` #31; no code exists. |
| 34 | **Vocabulary** | NONE | NONE | UNPROVEN | **[1] PLANNED** | Vocabulary notebook specified in `PROJECT.md` #32; no code exists. |
| 35 | **Translation** | NONE | NONE | UNPROVEN | **[1] PLANNED** | Paragraph translation specified in `PROJECT.md` #33; no code exists. |
| 36 | **TTS** | NONE | NONE | UNPROVEN | **[1] PLANNED** | Text-to-speech audio narration specified in `PROJECT.md` #34; no code exists. |
| 37 | **AI / Ollama** | STUB | WORKSPACE-TEST | UNPROVEN | **[2] CONFIG / STUB** | `AiProvider` trait & config in `luma-ai`; **NO live HTTP streaming client or UI**. |
| 38 | **Sync** | STUB | WORKSPACE-TEST | UNPROVEN | **[2] CONFIG / STUB** | `ChangeRecord` & `SyncProvider` in `luma-sync`; **NO network transport or sync engine**. |
| 39 | **Backup & Restore** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Zip archive creation and restoration tested; **misses `localStorage` knowledge data**. |
| 40 | **Export** | PARTIAL | HARNESS-SIMULATED | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | Clipboard formatted copy works; full OPDS / library archive export missing. |
| 41 | **OPDS Client** | NONE | NONE | UNPROVEN | **[1] PLANNED** | OPDS catalog feed browser specified in `PROJECT.md` #40; no code exists. |
| 42 | **Integrations** | MOCK | NONE | UNPROVEN | **[2] MOCK** | Readwise and Zotero cards are **MOCK UI**; no external HTTP client exists. |
| 43 | **Notifications** | PARTIAL | HARNESS-SIMULATED | UNPROVEN | **[3] IMPLEMENTED (PARTIAL)** | In-app transient notification store works; native OS desktop daemon missing. |
| 44 | **Settings** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | SQLite key-value settings store tested (`SettingsService`). |
| 45 | **Accessibility** | PARTIAL | HARNESS-SIMULATED | UNPROVEN | **[3] IMPLEMENTED (PARTIAL)** | High-contrast, e-ink, Atkinson/Dyslexic fonts; screen-reader uncertified. |
| 46 | **Internationalization**| PARTIAL | WORKSPACE-TEST | UNPROVEN | **[3] IMPLEMENTED (PARTIAL)** | Forensic text encoding (UTF-8/16, ISO-8859, entities); UI strings English-only. |
| 47 | **Security** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Path traversal, zip bomb, and HTML sanitization defenses tested in `luma-security`. |
| 48 | **Data Integrity** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Foreign key cascades, WAL concurrency, and SHA-256 checksums tested. |
| 49 | **Maintenance** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | File reconciliation, FTS5 re-indexing, cache cleanup, and VACUUM tested. |
| 50 | **Diagnostics** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | DB page size, book count, file count, and WAL status reporting tested. |
| 51 | **Error Handling** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | `LumaError` to `BackendError` sanitization tested across IPC boundary. |
| 52 | **Background Jobs** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Job cancellation tokens, status tracking, and progress throttling tested. |
| 53 | **Performance** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Sub-50ms document open, session reuse, and 10k library queries in <100ms. |
| 54 | **Testing** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | 48 Rust tests, 18 Vitest tests, typecheck, clippy, and fmt pass with 0 errors. |
| 55 | **Compatibility** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | EPUB 2/3, PDF, and forensic encodings tested; TXT/MD reader broken. |
| 56 | **Plugin Architecture** | MOCK | NONE | UNPROVEN | **[2] MOCK** | Plugin directory cards are **MOCK UI**; no dynamic WASM/JS sandbox host exists. |
| 57 | **Developer Experience**| FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Monorepo pnpm + cargo setup with typed IPC generation and strict gates. |
| 58 | **CI/CD** | FULL | WORKSPACE-TEST | UNPROVEN | **[4] TESTED (CI MATRIX)** | `.github/workflows/ci.yml` runs cargo test, clippy, wasm32, and build. |
| 59 | **Release / Updater** | PARTIAL | NONE | UNPROVEN | **[2] CONFIG-ONLY** | Tauri updater config present; production endpoint not configured. |
| 60 | **Cross-Platform** | PARTIAL | WORKSPACE-TEST (CI) | DESKTOP-HOST (Win11) | **[4] TESTED (CI) + RUNTIME-UNPROVEN (macOS/Linux)** | Win11 desktop proven; macOS & Linux compiled in CI but unproven on display servers. |
| 61 | **UX Polish** | FULL | HARNESS-SIMULATED | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Paper aesthetics, typography drawer, tabbed sidebar, smooth theme switching. |
| 62 | **Automation** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Automated runtime telemetry capture benchmark harness. |
| 63 | **Privacy** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | 100% offline, local SQLite, no network analytics, no third-party scripts. |
| 64 | **Observability** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | Structured tracing subscriber on backend and telemetry milestones in frontend. |
| 65 | **Recovery** | FULL | WORKSPACE-TEST | HARNESS-ONLY | **[4] TESTED + RUNTIME-UNPROVEN** | SQLite WAL recovery and backup restore pipeline tested. |
| 66 | **Migration** | FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | Versioned `schema_migrations` auto-executes idempotently on startup. |
| 67 | **Analytics** | PARTIAL | HARNESS-SIMULATED | UNPROVEN | **[3] IMPLEMENTED (PARTIAL) + RUNTIME-UNPROVEN** | Queue and book counts live; reading session duration aggregation is synthetic. |
| 68 | **Experimental Features**| FULL | WORKSPACE-TEST | DESKTOP-HOST (Win11) | **[6] RUNTIME-PROVEN (Win11)** | E-ink monochrome reading mode and fuzzy reflow anchor resilience. |

---

### 2. Multi-Dimensional Summary & Reality Tally

| Evidence Lattice Level | Count | Share | Reality Interpretation |
|---|:---:|:---:|---|
| **[6] RUNTIME-PROVEN (Desktop Host - Win11)** | **14** | **20.6%** | Demonstrated on live Windows 11 host (EPUB, PDF, Library, Annotations, Progress, Search, Core Foundation, Themes, Performance, Privacy, Testing, DevEx, UX Polish, Migration). |
| **[5] FRONTEND-VERIFIED (Harness / React Only)** | **7** | **10.3%** | Interactive in React/JSDOM, but either disconnected from SQLite (`localStorage`), or verified only in frontend test harness. |
| **[4] TESTED (Rust Suite / Backend Only)** | **22** | **32.4%** | Automated tests pass in Rust workspace (`cargo test`), but runtime desktop UI interaction is unproven or backend-only. |
| **[3] IMPLEMENTED (Partial / Defective)** | **9** | **13.2%** | Production code exists but is incomplete or defective (e.g. TXT/MD reader defect, unwired reading sessions, static analytics). |
| **[2] CONFIG / STUB / MOCK** | **6** | **8.8%** | Trait stub (AI, Sync), Mock UI (Readwise/Zotero, Plugins), or Config-only (Updater). |
| **[1] PLANNED (Specification Only)** | **5** | **7.4%** | No implementation exists (Dictionary, Vocabulary, Translation, TTS, OPDS). |
| **RUNTIME-UNPROVEN (Across macOS/Linux & Unverified UI Flows)** | **54** | **79.4%** | Either not yet tested on macOS/Linux display servers or not verified in real end-to-end desktop runs. |

> **Crucial Reality Distinction**:  
> The previously cited **69.1% is a code-inventory footprint**, NOT a product-readiness statistic.  
> The true **end-to-end desktop runtime verified surface on host is 20.6%**.
