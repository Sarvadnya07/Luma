# LUMA — Dynamic Data Reconstruction Report

**Date**: 2026-09-17
**Scope**: frontend data sources (`apps/desktop/src`, `packages/*`), the frontend/test
seam, and the browser verification harness.
**Companion documents**:
`docs/audits/DYNAMIC-DATA-AUDIT.md` (registry),
`docs/audits/DYNAMIC-DATA-MATRIX.md` (surface matrix),
`docs/architecture/DYNAMIC-DATA-CONTRACT.md` (ownership contract).

---

## Repository scan

- Production TS/TSX modules scanned: **71** (of 486 indexed project files)
- Hard-coded data findings registered: **16** (DD-001 … DD-016)
- P0: **8** · P1: **4** · P2: **3** · P3: **1**
- Files deleted: **1** (`apps/desktop/src/lib/mockData.ts`, 435 lines)
- Net frontend diff this workstream: `lib/tauri.ts` 1636 → 700 lines

## Removed

| Removed | Where it lived |
| --- | --- |
| 9 sample books with Unsplash covers, ISBNs, publishers, progress | `lib/mockData.ts` |
| Sample annotations, bookmarks, collections, tags, settings, author map | `lib/mockData.ts` |
| Two chapters of book HTML (`GATSBY_CHAPTER_3_HTML`, `MEDITATIONS_BOOK_2_HTML`) | `lib/mockData.ts` |
| Per-book-id fabricated TOC, chapter text, PDF page text | `lib/tauri.ts` |
| Fabricated file paths, sizes, `sha256` values (`mockhash`, `mocksha256`) | `lib/tauri.ts` |
| Fabricated search snippets matched by keyword | `lib/tauri.ts` |
| Fabricated diagnostics/backup/maintenance payloads | `lib/tauri.ts` |
| Silent `!isTauri()` mock mode and `MockDataStore` | `lib/tauri.ts` |
| `focusTime: "Active Session"`, `progressPercent: 50` and session/queue fallbacks | `features/library/LibraryView.tsx` |
| `50%` / `100%` hero progress | `features/library/LumaHomeView.tsx` |
| Entire invented Atrium dashboard | `features/workspace/KnowledgeHome.tsx` |
| Invented plugin catalogue and non-persisting toggles | `features/plugins/IntegrationsPluginsView.tsx` |
| `"Meditations"` book title fallbacks | `GlobalAnnotationCenter.tsx`, `ReaderSidebar.tsx` |
| Shared constant device UUID | `state/readerState.ts`, `CbzReaderView.tsx` |
| "Synced just now" status and the promise of device sync | `features/devices/SyncDeviceCenter.tsx` |

## Converted to dynamic sources

| Surface | Real owner now |
| --- | --- |
| Library home / grid / list | `list_books`, `get_book_details` → SQLite |
| Home hero progress | `get_reading_analytics.recent_sessions` (absent ⇒ no bar) |
| Covers | `get_book_cover_data_url`; deterministic generated cover otherwise |
| History / Reading Intelligence | `get_reading_analytics` (heatmap, sessions, queue) |
| Atrium | `list_notes`, `list_flashcards`, `list_research_projects`, `list_research_questions` |
| Plugins / integrations | `get_all_settings` (`integration.*`); otherwise state the feature is absent |
| Annotation repair | the clicked annotation's own quote/note |
| Reader document, TOC, chapters | `open_reader_document`, `get_reader_chapter` → format engine |
| Device identity in sync payloads | `lib/deviceIdentity.ts` (per-install UUID v4) |

## Legitimately static

Brand and logo, section/button/aria labels, empty-state copy, default reader settings
(configuration, not persisted state), deterministic cover palettes, `favicon.svg`,
command/event names, error-code strings, and the `src/testing/**` fixture library that
only tests may import.

## Production mock fallbacks

- **Removed**: 1 (the `!isTauri()` → in-memory library, plus its ~900 lines of fabricated
  command implementations).
- **Remaining**: 0 in the shipped code path. The in-memory implementation is now a
  test-support transport (`src/testing/inMemoryBackend.ts`) that starts **empty unless a
  test seeds it**, implements only commands it genuinely supports, and throws on anything
  else. It is unreachable from the application: no production module imports it
  (lint-enforced), and the built bundle contains none of its strings.

## Image audit

- Product assets: **2** (`favicon.svg`, inline brand marks in `packages/ui`)
- Content images: **0 static** — covers come from stored files or deterministic
  generation
- Fake/demo images removed: **9** remote Unsplash cover URLs from the deleted fixture set
- Embedded base64 content images: **0** (fitness test forbids them)

## Fitness functions

| Check | Mechanisms | Result |
| --- | --- | --- |
| Hard-coded-data guard | `src/__tests__/dynamicDataFitness.test.ts` (8 pattern checks + transport check) | **PASS** |
| Import boundary guard | `no-restricted-imports` for `**/testing/**`, `**/__tests__/**`, `**/fixtures/**` | **PASS** (probe-verified to fire) |
| Architecture fitness | `cargo test --test architecture_boundaries` (3 tests) | **PASS** |
| Shipped-bundle guard | `grep -ril "unsplash\|Meditations\|mockhash\|mockBooks" apps/desktop/dist` | **PASS** (no matches) |

## Validation

| Check | Result |
| --- | --- |
| `pnpm -w typecheck` (8 projects) | **PASS** |
| `pnpm -w lint` | **PASS** (0 warnings) |
| `pnpm -w test` | **PASS** — 13 files, 89 tests |
| `pnpm -w build` | **PASS** |
| `cargo test --test architecture_boundaries` | **PASS** |
| Desktop runtime (`luma-desktop.exe`) | **UNPROVEN** — the built GUI was not launched in this environment |
| Browser harness against the real Rust data layer | **RUNTIME-PROVEN** (see below) |
| Empty library | **RUNTIME-PROVEN** (error/empty states; no invented books) |
| Real imported book | **RUNTIME-PROVEN** — exactly 1 book from a real EPUB import |
| Reader | **RUNTIME-PROVEN** — real `ch1.xhtml` content and TOC rendered |
| Persistence | **UNPROVEN** — no restart cycle exercised in this environment |
| Delete → reload | **UNPROVEN** for the desktop app; covered by backend delete semantics + tests |

### Runtime evidence

Against `browser_reader_bridge` (real `ImportService` + `ReaderService` + SQLite, one
genuinely imported `tests/fixtures/sample_book.epub`), with the real UI served by Vite:

- `list_books` → exactly one book, `reading_status: "unread"`, `isbn 978-0143127741`,
  title/description read from the EPUB's own OPF metadata.
- `get_reading_analytics` → `books_completed_count: 0`, empty sessions, zeroed focus data
  (the dashboard renders zeros, not example activity).
- Library home: one book, no covers fetched remotely, **no percentage** on the hero
  because no reading session exists, "Unknown Author" shown only because the harness's
  `list_authors` returns `[]` (`get_book_details` does return the real author).
- Reader: `LUMA_PERF_READER_OPEN` → `LUMA_PERF_EPUB_CONTENT_READY` → the chapter heading
  and body text from `EPUB/ch1.xhtml`; the 100% progress is real (the fixture has exactly
  one spine item).
- Plugins screen with the harness unable to serve `get_all_settings`: it shows the real
  error and a Retry — no catalogue, no versions, no toggles.

Harness defect fixed to make this possible: `browser_reader_bridge` answered CORS
preflights with a 500, so the browser integration transport could never reach the real
services from another origin. It now answers `OPTIONS` with 204 plus
`Access-Control-Allow-*` headers (test-only binary; no production impact).

## Remaining hard-coded application data

Honest, line-level list of everything static that remains in production source, with the
reason. Nothing below is presented as user data.

| # | File | Value | Why it remains | Legitimate? |
| --- | --- | --- | --- | --- |
| 1 | `lib/tauri.ts` | command names (`"list_books"`, …) | protocol constants | Yes |
| 2 | `lib/tauri.ts` | `DataServicesUnavailableError` message | fixed developer-facing diagnostic | Yes |
| 3 | every feature | `DEFAULT_LABELS` / empty-state strings | UI copy, prop-overridable | Yes |
| 4 | `packages/reader-ui` | `DEFAULT_READER_SETTINGS` (font size 18, line height, margins, theme) | configuration defaults | Yes |
| 5 | `features/library/BookCoverThumbnail.tsx` | palette table + "LUMA CLASSIC EDITION / DIGITAL EDITION" print | deterministic presentation of real metadata | Yes |
| 6 | `features/devices/SyncDeviceCenter.tsx` | footer links `#docs`, `#privacy`, `#status`; `footerText` | product chrome, but the hrefs are inert placeholders | Partially — flagged below |
| 7 | `features/annotations/AnnotationRepairWorkflow.tsx` | `confidenceConfig` labels (high/medium/low) | rendering vocabulary for a value supplied by the caller | Yes |
| 8 | `lib/perfTelemetry.ts` | `LOG_LEVELS`, event-name prefixes | configuration | Yes |
| 9 | `lib/theme.ts` | default theme `"light"`, storage key | configuration | Yes |
| 10 | `app/App.tsx` | `AppTheme` union, `document` class names | configuration | Yes |
| 11 | Rust `commands/*.rs` | `DeviceId::new()` per operation (fresh UUID v7) | backend data-model choice; means device_id is a per-operation stamp, not a stable device identity | **No — backend issue, see below** |

### Known non-frontend issue surfaced by this audit

`crates/luma-core` generates `DeviceId::new()` (UUID v7) per call in
`commands/import.rs` and `commands/bookmark.rs`, and the bridge echoes that behaviour
(`device_id` differs between responses). Sync metadata therefore cannot identify a
device. The frontend now sends a real per-install id where it constructs sync payloads,
but the authoritative fix belongs in `luma-core` (persisted installation identity).

## Deliberately not changed

- **CSP and the Google Fonts CDN** — a security/product decision from the earlier audit;
  unchanged here.
- **`lib/tauri.ts` decomposition** — it is now a uniform 700-line passthrough rather than
  1636 lines of mixed transport and fiction; further splitting has no demonstrated value.
- **Navigation/filter state living in `LibraryView`** — still lost when the reader opens.
  It is a real UX defect, tracked in the frontend audit, and out of scope for a data-source
  change.
- **Device sync and the plugin runtime** — no backend exists. The screens now say so
  instead of simulating either feature.
