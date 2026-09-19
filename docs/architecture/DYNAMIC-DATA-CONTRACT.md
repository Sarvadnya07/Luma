# LUMA — Dynamic Data Contract (frontend)

**Status**: active. Applies to `apps/desktop/src` and every workspace package it renders.

This document states who owns each kind of frontend data, how it reaches the UI,
and which rules are enforced by automated checks rather than convention.

---

## 1. The rule

> The frontend renders data it does not own. It never manufactures application
> content, and it never substitutes example content when real data is absent,
> empty or unreachable.

Three consequences:

1. **One source of truth per entity.** Books, documents, annotations, notes,
   flashcards, research records, settings and analytics live in the local
   database (SQLite via the Rust core). Nothing is mirrored into a frontend store.
2. **No silent fallbacks.** An unreachable data layer raises
   `DataServicesUnavailableError`; the UI shows an error state with a retry.
   An empty result renders an empty state. Neither case produces records.
3. **Derived beats stored.** Percentages, counts, heatmaps, deck sizes and "recent"
   orderings are computed from stored records at render time, never held as
   parallel state.

## 2. Architecture

```
React feature view
   │  (props / store selectors only)
   ▼
LumaApi (lib/tauri.ts)          ← live proxy over the current client instance
   │  one method per command, arguments marshalled, no logic
   ▼
LumaTransport
   ├── desktop runtime: @tauri-apps/api/core invoke  → Rust commands
   ├── harness:        BrowserIntegrationTransport   → local bridge → same Rust services
   └── tests:          createInMemoryLibraryBackend() (src/testing, never shipped)
   ▼
SQLite + file store (owned by luma-storage / luma-core)
```

`lib/tauri.ts` contains no defaults, no fixtures and no per-entity branching. If a
command has no transport, the call throws.

## 3. Entity contract

| Entity | Owner (source of truth) | Fetch path | State holder | Renderer |
| --- | --- | --- | --- | --- |
| Book | `luma-storage` books table | `list_books`, `get_book_details` | `LibraryView` props/state | `BookCard`, `BookTable`, `LumaHomeView`, `BookDetailsDrawer` |
| Book file | file store + `book_files` | `get_book_details`, `get_book_file_bytes`, `read_document_resource` | component-local | `BookDetailsDrawer`, reader views |
| Cover | stored cover or generated | `get_book_cover_data_url` | `BookCoverThumbnail` | `BookCoverThumbnail` |
| Document (EPUB/PDF/TXT/CBZ) | format engine via `ReaderService` | `open_reader_document`, `get_reader_chapter`, `get_reader_pdf_page`, `get_document_*` | `readerState` store (document-scoped) | `EpubReaderView`, `PdfReaderView`, `CbzReaderView`, `EInkReaderView` |
| Reading progress | `reading_progress` table | `get_reading_progress`, `save_reading_progress` | `readerState` (debounced writer) | reader progress chrome |
| Reading session | `reading_sessions` table | `start_reading_session`, `complete_reading_session` | reader lifecycle | analytics |
| Analytics | derived in Rust from sessions/progress | `get_reading_analytics` | `LibraryView.analytics` | `ReadingIntelligenceDashboard` |
| Bookmark | `bookmarks` table | `list_bookmarks`, `create_bookmark`, `delete_bookmark` | `readerState` | `ReaderSidebar` |
| Annotation | `annotations` table | `list_annotations`, `list_all_annotations`, `save_annotation`, `delete_annotation` | `readerState` / `GlobalAnnotationCenter` | reader overlay, `GlobalAnnotationCenter` |
| Collection / Tag / Author / Series | metadata tables | `list_collections`, `list_tags`, `list_authors`, `list_series` | `LibraryView` | sidebar, details drawer |
| Note | `notes` table | `list_notes`, `create_note`, `update_note`, `delete_note` | feature-local | `NotesWorkspace`, `KnowledgeHome` |
| Flashcard / review | `flashcards`, `study_reviews` | `list_flashcards`, `create_flashcard`, `record_study_review` | feature-local | `StudyFlashcards`, `KnowledgeHome` |
| Research project / question / evidence / draft | research tables | `list_*`, `create_*`, `save_research_draft`, `get_research_draft` | `ResearchProjectWorkspace` | `ResearchProjectWorkspace`, `KnowledgeHome` |
| Setting | `settings` table | `get_setting`, `set_setting`, `get_all_settings` | owner per setting (see below) | settings surfaces |
| Chrome theme | frontend-owned, `localStorage` | `lib/theme.ts` | `App` state | document class |
| Reader typography | user setting | `set_setting`/`get_setting` | `readerState.settings` | reader chrome, `TypographySettingsDrawer` |
| Device identity | this installation, `localStorage` | `lib/deviceIdentity.ts` | module-level memo | sync payloads |
| Perf telemetry | measured in-process | `lib/perfTelemetry.ts` | in-memory ring buffer | dev diagnostics |

## 4. State ownership rules

- **Server/DB state** is fetched where it is displayed and never copied into a global
  store. There is no frontend cache of library data.
- **URL/navigation state** (section, filters, sort, search) belongs to the view that
  is mounted; it is currently component state in `LibraryView`, which is a known
  limitation for returning from the reader (tracked in the audit report).
- **Reader state** is document-scoped and lives in `readerState`; features reach it
  only through `state/readerContext` (DI), enforced by lint.
- **Chrome theme** has exactly one writer (`App` + `lib/theme.ts`), with a test that
  fails if a second writer appears.
- **Defaults** (`DEFAULT_READER_SETTINGS`, label maps) are configuration, not data:
  they may be static, and they must be overridable through props.

## 5. Loading / empty / error contract

Every async surface implements four distinct states:

| State | Rendering |
| --- | --- |
| loading | explicit spinner/status text with `aria-live="polite"` |
| success (non-empty) | real records |
| success (empty) | empty state naming what is missing and the action that fills it |
| failure | error message + retry, never substituted content |

Zero-value analytics (no sessions) render as zeros/empty, not as example activity.

## 6. Enforcement

| Rule | Mechanism |
| --- | --- |
| Production never imports fixtures or `src/testing` | `no-restricted-imports` in `eslint.config.mjs` (verified to fire) |
| No fabricated content, no removed sample records, no shared device UUID, no implicit in-memory store | `apps/desktop/src/__tests__/dynamicDataFitness.test.ts` |
| Every command routed through a transport | same fitness test (`DataServicesUnavailableError` present, no synthesis pattern in the client) |
| Features use the injected reader store | `no-restricted-imports` rule for `state/readerState` |
| Shipped bundle contains no sample content | manual check: `grep -ril "unsplash\|Meditations\|mockhash" apps/desktop/dist` |

## 7. Adding a new surface — checklist

1. Name the entity and its owning table/service; if no owner exists, the surface
   states that it is unavailable rather than showing invented content.
2. Add (or reuse) one `LumaApi` method that marshals the command arguments — no logic.
3. Read it in the component or the store that displays it; derive the rest.
4. Implement loading, empty and error states explicitly.
5. If a test needs data, seed `createInMemoryLibraryBackend({ ... })` in the test —
   never in application code.
