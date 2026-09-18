# LUMA — Dynamic Data Matrix

Every user-facing entity, its current owner, and whether anything about it was
fabricated. `Source` names the real owner *after* this work; see
`docs/audits/DYNAMIC-DATA-AUDIT.md` for the pre-change state.

| Surface | Entity | Owner / command | Hard-coded? | Persistence | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Library home | Books | `list_books` → SQLite | No | SQLite | FIXED | runtime: exactly 1 book after 1 import |
| Library home | Hero progress | `get_reading_analytics.recent_sessions` | No | SQLite | FIXED | bar absent until a session exists |
| Library home | Author name | `list_authors` + `book.author_ids` | No | SQLite | FIXED | shows "Unknown Author" only when authors are absent |
| Library home | Recently added | `book.sync.created_at` | No | SQLite | FIXED | sorted from real timestamps |
| Library grid/list | Book cards/rows | `list_books` | No | SQLite | FIXED | format from stored `BookFile` |
| Library grid | Cover image | `get_book_cover_data_url` → generated cover fallback | No | SQLite / deterministic | FIXED | no remote fetch; no stock photos |
| Library grid | Pagination + count | `lib/pagination.ts` over the real result set | No | n/a (derived) | FIXED | unit-tested arithmetic |
| Toolbar | Search / filters / sort | `list_books` filter+sort arguments | No | URL/component state (uncommitted) | PARTIAL | see Remaining FE-MED in the report |
| Details drawer | Metadata, files, tags, progress | `get_book_details` | No | SQLite | FIXED | absent fields render as unknown |
| Reader (EPUB) | Chapter HTML/text, TOC | `open_reader_document`, `get_reader_chapter` | No | BookFile | RUNTIME-PROVEN | :1432 renders real `ch1.xhtml` content |
| Reader (PDF) | Page text/marks | `get_reader_pdf_page`, `get_book_file_bytes` | No | BookFile | FIXED (not runtime-proven here) | no fabricated page text remains |
| Reader | Annotations, bookmarks | `list_annotations`, `list_bookmarks`, `save_annotation` | No | SQLite | PROVEN (tests + code) | store tests pass against the backend seam |
| Reader | Reading progress | `save_reading_progress`, `get_reading_progress` | No | SQLite | FIXED | debounced write on close (tested) |
| Reader | Device identity in sync payload | `lib/deviceIdentity.ts` (per-install UUID) | No | localStorage | FIXED | fitness test rejects the old constant |
| Sidebar | Section labels, brand | static | Yes — intentional | n/a | LEGITIMATE | product chrome |
| History / Reading Intelligence | Heatmap, weekly focus, sessions, queue | `get_reading_analytics` | No | SQLite (derived) | FIXED | zero-state when no sessions exist |
| The Atrium | Notes, flashcards, projects, questions | `list_notes`, `list_flashcards`, `list_research_projects`, `list_research_questions` | No | SQLite | FIXED | per-column empty states |
| Notes workspace | Notes | `list_notes`/`create_note`/`update_note`/`delete_note` | No | SQLite | PROVEN | store tests + legacy migration test |
| Flashcards | Cards, decks, due counts | `list_flashcards`, `record_study_review` | No | SQLite | FIXED | decks derived from real `deck_id`s |
| Research | Projects, questions, evidence, drafts | research commands | No | SQLite | FIXED | project-backed lists |
| Annotations centre | Annotations | `list_all_annotations` | No | SQLite | FIXED | counts derived from the list |
| Annotation repair | Target annotation | the clicked annotation's own quote/note | No | n/a | FIXED | no placeholder passage remains |
| Devices | Device list, conflicts, last sync | no backend exists | No data shown | n/a | HONEST EMPTY | "Device sync is not available in this build" |
| Plugins | Integrations, catalogue | `get_all_settings` (`integration.*`) | No | SQLite settings | FIXED | states that no plugin runtime exists |
| Settings | Reader prefs, maintenance, backups, diagnostics | `get_setting`/`set_setting`, `maintenance_*`, `create_backup`, `run_diagnostics` | No | SQLite | FIXED | real command results only |
| Command palette | Book list, commands | `list_books` | No | SQLite | FIXED | no fallback rows |
| App chrome | Chrome theme | `lib/theme.ts` (single owner) | default only | localStorage | LEGITIMATE | default is config; value is user state |
| Analytics surfaces | Performance marks | `lib/perfTelemetry.ts` (measured at runtime) | No | session | LEGITIMATE | values are measured, not asserted |
| Test/dev | Fixtures + in-memory backend | `apps/desktop/src/testing/**` | Yes — test-only | in-memory | RELOCATED | never imported by production (lint + fitness test) |

## Data flow after this work

```
Import (file picker / drag-drop / bytes)
  → import_files / import_file_bytes
  → ImportService → BookFile + Book row in SQLite
  → list_books / get_book_details
  → LibraryView → BookCard | BookTable → LumaHomeView hero
  → open_reader_document → get_reader_chapter → EpubReaderView (real document)
```

```
No row in SQLite → empty array → honest empty state (never a substitute record)
Command unreachable → DataServicesUnavailableError → error state with Retry
```

## Scenario coverage

| Scenario | Expected | State |
| --- | --- | --- |
| A. Empty install | empty library, no covers, zeroed analytics | HONEST (code path + zero-state UI) |
| B. One imported book | exactly that book, its own metadata | RUNTIME-PROVEN (1 book at :1432) |
| C. Several books | exactly those books | code path identical to B; not exercised here |
| D. Delete book | disappears from every view | in-memory backend test covers delete; desktop run not exercised |
| E. Reopen app | same persisted state | SQLite-backed by construction; not exercised here |
| F. No annotations | empty annotation surfaces | RUNTIME-PROVEN (empty lists from the bridge) |
| G. No history | zeroed dashboard, no sessions | RUNTIME-PROVEN (`get_reading_analytics` returned zeros) |
| H. No collections | empty collection list | RUNTIME-PROVEN (`list_collections` → `[]`) |
