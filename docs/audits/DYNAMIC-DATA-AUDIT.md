# LUMA — Dynamic Data Audit (hard-coded / mock / demo data registry)

**Date**: 2026-09-17
**Scope**: `apps/desktop/src`, `packages/*/src`, `public/`, frontend build output
**Method**: whole-repository scan for fabricated application data, then line-level
tracing of each hit to its owner. Findings are registered as `DD-nnn` and marked
with the evidence that closed them.

Severity scale

- **P0** — fabricated data visible to users
- **P1** — fabricated data that changes functional behaviour
- **P2** — static state that should come from the backend
- **P3** — unnecessary duplication / configuration smell

Legend for `Status`: `FIXED` (code changed), `REMOVED` (deleted), `RELOCATED`
(moved to test support), `LEGITIMATE` (product copy/config, kept deliberately).

---

## Registry

### DD-001 — Silent in-memory library fallback (P0)
- **Files**: `apps/desktop/src/lib/tauri.ts` (`useMock: config.useMock ?? !isTauri()`,
  `isMock()`, `MockDataStore`), `apps/desktop/src/lib/mockData.ts`
- **Data**: an entire fake library — 9 books, annotations, bookmarks, collections,
  tags, settings, author map and two chapters of real-looking book HTML
- **Evidence**: browser run fetched Unsplash cover URLs and rendered "The Architecture
  of Stillness" before this change; the constant `useMock: false` in
  `applicationBootstrap.ts` proved the intent never was "mock by default"
- **Problem**: any build without Tauri runtime detection silently served invented
  user data as if it were the user's library. Production and dev behaviour diverged.
- **Status**: `FIXED` — the fallback is gone. `LumaApiClient._call` resolves an
  explicit transport → desktop IPC → throws `DataServicesUnavailableError`. No
  in-memory store is referenced by production code.
- **Validation**: `pnpm typecheck`, 89 unit tests, runtime check at :1432 shows the
  real imported book and an error state when the data layer is unreachable.

### DD-002 — Fixture module imported by production (P0)
- **File**: `apps/desktop/src/lib/mockData.ts` (435 lines) imported from `lib/tauri.ts`
- **Data**: `mockBooks`, `mockAnnotations`, `mockBookmarks`, `mockCollections`,
  `mockTags`, `mockSettings`, `BOOK_AUTHORS_MAP`, `GATSBY_CHAPTER_3_HTML`,
  `MEDITATIONS_BOOK_2_HTML`; covers pointed at `images.unsplash.com`
- **Status**: `REMOVED` (file deleted) + `RELOCATED` — a minimal, obviously synthetic
  fixture set now lives in `apps/desktop/src/testing/fixtures/libraryFixtures.ts`.
- **Guard**: fitness test `src/__tests__/dynamicDataFitness.test.ts` plus the
  `no-restricted-imports` boundary in `eslint.config.mjs` (probe-verified to fire).

### DD-003 — Per-book fabricated reader content (P0)
- **Files**: `lib/tauri.ts` `getBookDetails` / `openReaderDocument` / `getReaderChapter` /
  `getReaderPdfPage`
- **Data**: branch-by-book-id fiction — hard-coded TOC chapters, Gatsby and Meditations
  chapter prose, `"PDF Page N content for local reading. Annotation integrity remains
  preserved."`, fabricated file paths (`/Users/luma/Documents/...`), fake sizes and
  hashes (`"mockhash"`, `"mocksha256"`), fabricated progress (`0.75 / 0.66 / 0.15 / 1.0`)
- **Problem**: chapter text, TOC and progress for non-existent books were presented as
  document content.
- **Status**: `REMOVED` — every method is now a transport call. Runtime proof: the
  reader at :1432 renders the real chapter of the imported EPUB
  (`Chapter 1: The Principle of Architecture`, from `EPUB/ch1.xhtml` in the file).

### DD-004 — Fabricated import results (P1)
- **File**: `lib/tauri.ts` `importDirectory`, `importFileBytes`
- **Data**: `importDirectory` returned "imported" records for
  `${dir}/sample_epub.epub` and `${dir}/sample_pdf.pdf` regardless of what the user
  picked; `importFileBytes` returned a completed job with `sha256_hash: "mockhash"` and
  invented book ids (`book_01918… → "The Rust Programming Language"`)
- **Status**: `REMOVED`. The dev/test backend now derives records only from the bytes
  and filename it is actually given.

### DD-005 — Fabricated search results (P1)
- **File**: `lib/tauri.ts` `searchDocument`
- **Data**: returned a match with snippet
  `"...Annotation integrity is the cornerstone of any serious reading system..."`
  whenever the query contained `annotation`, `architecture` or `systems`
- **Status**: `REMOVED`. Search is a transport call; the dev backend searches only
  chapter text that exists in its store.

### DD-006 — Fabricated diagnostics / backup / maintenance payloads (P2)
- **File**: `lib/tauri.ts` (`runDiagnostics` → "Mock in-memory database",
  `SUBSYSTEMS` all `healthy`, `metrics.total_books`; `createBackup` → invented
  `backup_name`/`sha256`; `maintenance_*` → `duration_ms: 0`, invented item counts)
- **Status**: `REMOVED` from production. `SettingsModal` already had honest empty/error
  handling for these commands.

### DD-007 — Library history dashboard fabricated progress (P0)
- **File**: `apps/desktop/src/features/library/LibraryView.tsx` (history section)
- **Data**: `focusTime: "Active Session"`, `progressPercent: 50` for every
  "reading" book; fallbacks that relabelled ordinary books as recent sessions
  (`books.slice(0, 3)`) and as the queue (`books.slice(0, 4)`); a fabricated
  `change: "+N Hours"`
- **Status**: `FIXED` — sessions come only from recorded reading sessions, the queue is
  the real unread set, and no week-over-week delta is claimed.

### DD-008 — Home hero fabricated reading progress (P0)
- **File**: `apps/desktop/src/features/library/LumaHomeView.tsx`
- **Data**: `reading_status === "reading" ? "50%" : "100%"`, with matching
  `aria-valuenow` — a progress bar for progress nobody recorded
- **Status**: `FIXED` — `progressByBook` comes from real session data
  (`ReadingAnalytics.recent_sessions`); without a recorded session the bar and
  percentage are omitted and the status label is shown instead.

### DD-009 — The Atrium was entirely invented content (P0)
- **File**: `apps/desktop/src/features/workspace/KnowledgeHome.tsx`
- **Data**: hard-coded syntheses ("BOOK: The Architecture of Memory", "1d ago"),
  enquiries ("Epistemology of the Archive", "Last active: Yesterday"), a study queue
  ("Luma Numerology / Part the second • 18 cards", "Historiography • Complete") and a
  reflection paragraph — none of it connected to storage
- **Status**: `FIXED` — the view now reads real notes, flashcards and research
  projects (+ questions of the most recent project) and renders per-column empty states.
- **Runtime**: with a data layer that cannot serve those commands, the screen shows the
  real error message; it never falls back to prose.

### DD-010 — Integrations & Plugins was a fake catalogue (P0)
- **File**: `apps/desktop/src/features/plugins/IntegrationsPluginsView.tsx`
- **Data**: three invented plugins with versions (`v1.2`, `v2.0`, `v0.9`),
  `installed: true/false`, plus `useState(true)` for "Readwise enabled" and
  `useState(false)` for "Zotero enabled" — toggles that persisted nowhere
- **Backend check**: no plugin/integration command exists in
  `apps/desktop/src-tauri/src/commands/` (grep for `plugin`/`integration` → none)
- **Status**: `FIXED` — the screen reads `integration.*` settings from the database and
  otherwise states plainly that no integrations are connected and no plugin runtime
  exists in this build.

### DD-011 — Hard-coded sample book title in production UI (P0)
- **Files**: `features/annotations/GlobalAnnotationCenter.tsx:471`
  (`bookTitle: "Meditations"` with a `// should come from the item` comment),
  `features/reader/ReaderSidebar.tsx:140` (`currentBook?.title || "Meditations"`)
- **Status**: `FIXED` — the repair workflow now receives the real annotation's
  book title, quote and note; the sidebar falls back to "No book open".

### DD-012 — Shared constant device identity (P1)
- **Files**: `state/readerState.ts` (`DEFAULT_LABELS.deviceId = "00000000-…-0001"`,
  `createSyncMeta` fallback), `features/reader/CbzReaderView.tsx:152`
- **Problem**: every installation stamped its records with the same device id, so sync
  metadata could not distinguish devices
- **Status**: `FIXED` — `lib/deviceIdentity.ts` generates and persists a real per-install
  UUID v4; the constant is now rejected by the fitness test.
- **Related, deferred**: the Rust core passes `DeviceId::new()` (a fresh UUID v7) per
  operation (`commands/import.rs`, `commands/bookmark.rs`), which is not a stable device
  identity either. Documented under "Remaining" in the final report; it is a backend
  data-model decision, not a frontend one.

### DD-013 — Fake "synced just now" device status (P2)
- **File**: `features/devices/SyncDeviceCenter.tsx`
- **Data**: `synced: { label: "Synced just now" }` rendered even when `lastSynced` was
  days old; empty state promised "Connect a device to start syncing your library" for a
  build with no sync backend
- **Status**: `FIXED` — label is "Synced" with the real timestamp beside it; the empty
  state states that device sync is unavailable in this build.

### DD-014 — Decorative pagination over real data (P1 — regression of a fake-data class)
- **File**: `features/library/LibraryView.tsx`, `packages/library-ui`
- **Data**: `currentPage` never sliced the result set; the pager was hard-coded to
  `1..12` and the count label always read "Showing 1-N of N"
- **Status**: `FIXED` earlier in this workstream (`lib/pagination.ts` + tests); recorded
  here because it is the same failure mode — UI asserting something the data does not say.

### DD-015 — Remote stock imagery as book covers (P0, removed with DD-002)
- **Data**: `cover_image_path: "https://images.unsplash.com/photo-…"` for 9 books
- **Status**: `REMOVED`. Covers now come from `get_book_cover_data_url` (stored cover) or
  the deterministic generated cover in `BookCoverThumbnail`; no remote fetch is made.
  (`BookCoverThumbnail` palettes are presentation, not data — `LEGITIMATE`.)

### DD-016 — Book identity, format and stats sniffed from ids (P1, removed with DD-003)
- **Data**: `book.id === "book_design_everyday" ? "pdf" : "epub"`,
  `bookId.startsWith("book_01918") ? "The Rust Programming Language"`, a hard-coded
  `"35%"` and a substring-matched file format in `packages/library-ui` `BookTable`
- **Status**: `REMOVED`/`FIXED` — format comes from stored book files, the invented
  completion percentage is gone, unset fields render as unknown.

---

## Legitimately static (checked, deliberately kept)

| Item | Location | Why it stays |
| --- | --- | --- |
| Brand, logo, section names, buttons, aria labels | `packages/ui`, features | product chrome, not user data |
| `DEFAULT_*` labels and empty-state copy | every feature | UI copy; overridable through props |
| `DEFAULT_READER_SETTINGS` (font size, theme, margins) | `packages/reader-ui` | configuration defaults, not persisted user state |
| Deterministic cover palette derivation | `features/library/BookCoverThumbnail.tsx` | deterministic presentation of real metadata |
| `favicon.svg` | `apps/desktop/public` | brand asset; the only file in `public/` |
| Command names, event names, error-code strings | `lib/tauri.ts` | protocol constants |

## Scan commands used

```bash
grep -rnE "mock|sample|demo|fake|fixture|dummy" apps/desktop/src packages/*/src
grep -rnE 'const (books|authors|annotations|searchResults|chapters|stats|devices|plugins)\b.*=.*\[' apps/desktop/src
grep -rn "images.unsplash.com|data:image/|base64" apps/desktop/src packages/*/src
grep -rn "00000000-0000-0000-0000-000000000001" apps/desktop/src
grep -rn "from \"" apps/desktop/src --include=*.ts --include=*.tsx   # fixture imports
grep -ril "unsplash|Annotation integrity|mockhash|sample_epub" apps/desktop/dist   # shipped bundle
```
