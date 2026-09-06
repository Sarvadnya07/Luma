# LUMA — CORE-02 PRODUCT REALITY AUDIT & RUNTIME ACCEPTANCE REPORT
## Multi-Dimensional Evidence Lattice & Product Truth Audit

**Date**: 2026-09-06  
**Auditor**: Antigravity Core Systems & Product Verification  
**Scope**: 68-Category Canonical Inventory (`docs/PROJECT.md`)

---

## 1. Executive Summary & Inventory Tally

The Luma product was re-audited against the canonical 68-category inventory using a **Feature Evidence Lattice** that separates:
1. **Source Code Implementation** (Full vs Partial vs Stub vs Mock vs None)
2. **Automated Test Coverage** (Rust Unit/Integration Suite vs Vitest/JSDOM Harness vs None)
3. **Runtime Desktop Verification** (Host OS Execution vs Harness Simulation vs Unproven)

```text
                     [6] RUNTIME-PROVEN (Host Desktop Run)
                                ▲
                                │
                     [5] FRONTEND-VERIFIED (JSDOM / React Harness)
                                ▲
                                │
                     [4] TESTED (Rust Workspace Test Suite)
                                ▲
                                │
                     [3] IMPLEMENTED (Real Code, Defective / Partial)
                                ▲
                                │
                     [2] CONFIG / STUB / MOCK
                                ▲
                                │
                     [1] PLANNED (Specification Only)
```

### Reality Tally

```
Total Features Audited:                           68
============================================================
[6] RUNTIME-PROVEN (Live Windows 11 Desktop Run): 14 (20.6%)
[5] FRONTEND-VERIFIED (JSDOM / React Only):        7 (10.3%)
[4] TESTED (Rust Automated Suite Only):           22 (32.4%)
[3] IMPLEMENTED (Partial / Defective):             9 (13.2%)
[2] CONFIG / STUB / MOCK:                          6  (8.8%)
[1] PLANNED (Specification Only):                  5  (7.4%)
============================================================
Total Features with Runtime Unproven on macOS/Linux
or Unverified Desktop End-to-End Execution:       54 (79.4%)
```

> [!WARNING]
> **Inventory Footprint vs. Product Readiness**:
> The previously cited **69.1%** represented code inventory existence across backend crates and React components. It was **not** a product-readiness statistic.
> The genuine **end-to-end desktop runtime verified surface on host is 20.6%**.

---

## 2. High-Risk Architectural & Product Gaps

### 2.1 P0 Format Routing Defect (TXT / Markdown / HTML)
- **Problem**: `TextExtractor` successfully parses frontmatter and metadata for `.txt`, `.md`, and `.html` during ingestion, and the library view displays these books. However, `ReaderService::get_chapter` in `crates/luma-storage/src/services/reader_service.rs` routes all non-PDF documents to `EpubDocument::open(&file.relative_path)`.
- **Impact**: Attempting to read a standalone TXT, Markdown, or HTML file in the reader crashes with an archive extraction error because raw plaintext files are not EPUB zip containers.
- **Remediation**: Implement a polymorphically dispatched document reader abstraction:
  - `EpubDocument` for `.epub`
  - `PdfDocument` for `.pdf`
  - `TextDocument` for `.txt`, `.md`, and `.html`
  - `ComicDocument` for `.cbz` / `.cbr`

### 2.2 P1 Knowledge Persistence Disconnect (LocalStorage vs. SQLite)
- **Problem**: Notes (`NotesWorkspace.tsx`), Study Flashcards (`StudyFlashcards.tsx`), and Research Projects (`ResearchProjectWorkspace.tsx`) are interactive in React, but save their entire state directly into browser `localStorage` (`luma_notes_workspace_data`, `luma_flashcards_workspace_data`, `luma_research_workspace_data`).
- **Impact**:
  - Knowledge data is completely disconnected from the Rust storage layer and SQLite ACID guarantees.
  - `BackupService` does **not** back up `localStorage`; a user backing up their library loses all notes, flashcards, and research drafts upon restore!
  - Sync architecture cannot synchronize or resolve conflicts for notes or flashcards.
- **Remediation**: Migrate Notes, Flashcards, and Research workspaces to first-class SQLite tables (`notes`, `flashcards`, `study_reviews`, `research_projects`, `research_evidence`) with typed Tauri IPC commands.

### 2.3 P1 Reading Session Analytics Gap (Dead Schema & Synthetic Data)
- **Problem**: Migration `001_initial_schema.sql` creates the `reading_sessions` table, but no repository, service, or Tauri command exists to populate it. `ReadingIntelligenceDashboard.tsx` relies on static mock fixtures (`[45, 60, 30, 80, 70, 90]` and `[[1, 2, 3, ...], ...]`) for weekly reading heatmaps and focus velocity.
- **Impact**: The reading intelligence dashboard is visually impressive but operationally synthetic.
- **Remediation**: Implement `ReadingSessionRepository` to log start/stop reading timestamps, duration, and progress deltas, deriving analytics from real user reading behavior.

### 2.4 Stubs, Mocks, and Planned Capabilities
- **Local AI / Ollama (STUB)**: `AiProvider` trait and configuration structs exist in `luma-ai`, but no live Ollama HTTP client (`/api/generate`) or reader streaming UI exists.
- **Multi-Device Sync (STUB)**: `ChangeRecord` and `SyncProvider` models exist in `luma-sync`, but no network transport or peer-to-peer sync engine exists.
- **Integrations & Plugins (MOCK)**: `IntegrationsPluginsView.tsx` renders static cards for Readwise, Zotero, and plugins; no live external sync or dynamic plugin execution host exists.
- **Dictionary, Vocabulary, Translation, TTS, OPDS (PLANNED)**: Detailed in `docs/PROJECT.md` #31, #32, #33, #34, #40, but zero code exists.

---

## 3. P0 Core Acceptance Matrix

| Core Capability | Expected State | Current Reality | Status |
|:---|:---|:---|:---:|
| **EPUB import → library → reader** | End-to-end working | Fully functional, manifest parsed, HTML sanitized, progress saved | **RUNTIME-PROVEN** |
| **PDF import → library → reader** | End-to-end working | Fully functional, canvas rasterized, zoom/spread, works on scanned PDFs | **RUNTIME-PROVEN** |
| **TXT import → reader** | End-to-end working | Extracted on import, fails in reader (`EpubDocument::open` crash) | **MUST FIX (P0)** |
| **MD import → reader** | End-to-end working | Extracted on import, fails in reader (`EpubDocument::open` crash) | **MUST FIX (P0)** |
| **HTML import → reader** | End-to-end working | Extracted on import, fails in reader (`EpubDocument::open` crash) | **MUST FIX (P0)** |
| **CBZ import → reader** | Dedicated reader | Extractor exists; falls back to EPUB reader; no comic canvas | **PARTIAL** |
| **Reading progress persistence** | Saved to SQLite | Auto-saves locator, percentage, and timestamp to `reading_progress` | **RUNTIME-PROVEN** |
| **Bookmark persistence** | Saved to SQLite | CRUD operations and locator jump tested in `bookmark_repo` | **TESTED** |
| **Highlight persistence** | Saved to SQLite | Text selection popup saves to SQLite; aggregated library-wide | **RUNTIME-PROVEN** |
| **Annotation recovery** | Resilient to reflow | `luma-anchor` fuzzy resolution over typography mutations tested | **TESTED** |
| **Notes persistence** | Unified storage | Currently in browser `localStorage`; disconnected from SQLite | **MUST MOVE (P1)** |
| **Flashcard persistence** | Unified storage | Currently in browser `localStorage`; disconnected from SQLite | **MUST MOVE (P1)** |
| **Research persistence** | Unified storage | Currently in browser `localStorage`; disconnected from SQLite | **MUST MOVE (P1)** |
| **Reading-session analytics** | Real data pipeline | `reading_sessions` unwired; dashboard displays static fixtures | **MUST WIRE (P1)** |
| **Comprehensive backup/restore** | Complete archive | Backs up SQLite + files; misses `localStorage` notes/flashcards | **RE-VERIFY (P1)** |

---

## 4. Execution Roadmap: CORE-03 Blueprint

The strategic priority is to establish a rock-solid, cohesive core before attempting AI, sync, or plugin integrations.

```text
CORE-03: Core Correctness & Persistence Completion
├── P0: Fix Formats (Polymorphic Document Engine for TXT/MD/HTML/CBZ)
├── P1: SQLite Knowledge Persistence (Migrate Notes, Flashcards, Research from localStorage)
├── P1: Reading Session Engine & Real Analytics (Wire reading_sessions schema to dashboard)
├── P1: Comprehensive Backup Coverage (Ensure all knowledge data is archived and restored)
└── P1: Core Runtime Regression Suite (End-to-end verification of all core capabilities)
          ↓
CORE-04: Comic/Manga Reader + Format Completeness
          ↓
PHASE 4A: Deep Study / Knowledge System
          ↓
PHASE 4B: Local AI / Ollama
          ↓
PHASE 4C: Multi-Device Sync
          ↓
PHASE 4D: Integrations / Export
          ↓
PHASE 5:  Plugins Architecture
```

---

## 5. Quality Gate Verification

All baseline checks remain verified with zero errors and zero warnings:
- `cargo fmt --all --check` -> **Pass (0 diffs)**
- `cargo check --workspace` -> **Pass (0 errors)**
- `cargo test --workspace` -> **Pass (48 tests passed, 0 failed)**
- `cargo clippy --workspace --all-targets -- -D warnings` -> **Pass (0 warnings, 0 errors)**
- `cargo check -p luma-core -p luma-anchor --target wasm32-unknown-unknown` -> **Pass (0 errors)**
- `pnpm typecheck` -> **Pass (7 workspace projects clean)**
- `pnpm lint` -> **Pass (0 errors)**
- `pnpm test` -> **Pass (3 test files, 18 tests passed)**
- `pnpm build` -> **Pass (Production bundle built in 4.32s)**
