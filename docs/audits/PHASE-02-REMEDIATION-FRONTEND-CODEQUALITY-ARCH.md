# 🛠️ LUMA — Phase 02 Remediation: Frontend · Code Quality · Architecture

**Date**: 2026-09-17
**Audit input**: `docs/audits/FORENSIC-AUDIT-FRONTEND-CODEQUALITY-ARCH-01.md`
**Mode**: IMPLEMENTATION (ARCH-02 + CODEQUALITY-02 + FRONTEND-02, sliced by impact and risk; UIUX-01 discovery recorded, UIUX-02 applied only where the audit had evidence)
**ADR**: `docs/adr/ADR-0025-Frontend-Failure-Delivery-and-Ownership.md`

---

## 0. Verification summary

| Gate | Command | Before | After |
|---|---|---|---|
| TypeScript (all 8 projects) | `pnpm -w typecheck` | ✅ | ✅ |
| ESLint | `pnpm -w lint` | ✅ 0 warnings | ✅ 0 warnings (+1 new boundary rule, 0 violations) |
| Frontend tests | `pnpm --filter @luma/desktop test` | 53 tests / 9 files | **76 tests / 12 files** |
| Rust arch fitness | `cargo test --test architecture_boundaries` | 3 passed | 3 passed (untouched) |
| Production build | `pnpm --filter @luma/desktop build` | 1 chunk, 948.5 kB min / 266.6 kB gzip | 21 chunks; **initial 318.3 kB min / 94.5 kB gzip** |
| Working tree after `pnpm test` | `git status` | dirty (tracked artifact rewritten) | **clean** |
| Live UI (Vite + browser) | Preview session | — | library + reader render; theme persists; pager honest |

**Live-verified during this phase** (dev server on `:1420`, browser transport, mock library):

- Library renders, count label reads `Showing 1-9 of 9 books`, pager renders `Previous / 1(current) / Next` — no fabricated page numbers.
- Reader opens via the lazily loaded chunk, renders sanitized chapter HTML, no alerts, no console errors; 9 book cards expose keyboard-focusable `Open …` buttons.
- Theme toggle writes `class="dark"` + `color-scheme` + `luma_theme` from a single module; survives reload.
- `body` background now resolves from `--bg-primary` (`rgb(24,24,27)` in dark) after removing the hardcoded utility class.
- **New evidence for two audit findings**: the dev build fetched `fonts.googleapis.com` CSS **and** `fonts.gstatic.com` `woff2` files (the packaged app blocks both via CSP), and the mock library fetched `images.unsplash.com` covers (two failed with `ERR_BLOCKED_BY_ORB`) — direct proof that remote-image loading is live in this codebase.
- **Correction to a prior audit claim**: reader content *is* selectable (`user-select: text` on the reader container; programmatic selection returns text). Only application chrome resolves to `user-select: none`. The earlier "copy/paste is broken by default" wording was too broad and is corrected in the audit report.

---

## 1. ARCH-02 — Architecture, boundaries, ownership

### 1.1 Architectural changes implemented

| # | Change | Requirement / quality attribute | Evidence before | Risk of change |
|---|---|---|---|---|
| A1 | **Failure tier across the React boundary**: root + per-view `ErrorBoundary`, one error sink, global `error`/`unhandledrejection` capture, release source maps | Reliability, operability ("does the system degrade safely and can failures be diagnosed?") | No boundary, no handlers, no telemetry, no maps; a render throw produced a permanently blank window | Low — additive |
| A2 | **Single owner per state value** for the chrome theme (`App` + `lib/theme.ts`); store no longer writes DOM/storage | Encapsulation, explicit ownership, predictability | 4 writers of one preference; two copies able to disagree (`App.isDarkMode` vs `store.settings.theme`) | Low |
| A3 | **Split delivery by feature boundary**: lazy top-level views, lazy non-library screens, lazy reader engines, `manualChunks` for pdf.js and React | Performance as an architectural property; "do not ship JS for functionality the user has not requested" | One eager 948 kB chunk paying for every engine and screen | Low |
| A4 | **Read path obeys the existing DI seam** (new tests use `createReaderStoreForApi`), and the seam is now *enforced* by an ESLint boundary rule | Testability, boundary enforcement | Seam existed but was bypassed by 10 components; nothing prevented the next bypass | Low — 0 existing violations |
| A5 | **Failure semantics are explicit**: reader `loadError` distinct from `loading` and `statusMessage`; retry re-attempts the failed operation | Preserve distinct loading/error/empty/partial states | Load failure = `console.error` + blank viewport | Low |
| A6 | **Consistency of the reading position**: progress flush on close is unconditional | Correctness under ordinary use (a reader left open lost its last position) | Flush only when a debounce timer happened to be pending | Low |

**Preserved deliberately** (per the preservation rule): the modular monolith, the enforced Rust crate layering and its fitness tests, the SQLite-owns-durable-state model with `localStorage` for theme only, CSR rendering, the `LumaTransport` abstraction, the `Pagination` component's public props, and the reader's separate paper-theme concept (dark/light/sepia/paper/eink) which selects the reading surface and the e-ink engine — that is a reading setting, not chrome theming, and merging it would have been a redesign rather than a fix.

### 1.2 Module / domain boundary changes

None moved between features or crates. Two *new* small modules were introduced at the correct layer rather than inside the components that needed them:

- `apps/desktop/src/lib/theme.ts` (67 L) — sole owner of chrome-theme read/apply/persist.
- `apps/desktop/src/lib/errorReporting.ts` (115 L) — sole owner of failure classification, sink, and global handlers.
- `apps/desktop/src/lib/pagination.ts` (64 L) — pure paging arithmetic, so the UI cannot re-derive it inline.
- `apps/desktop/src/components/ErrorBoundary.tsx` (166 L) — deliberately dependency-free (inline styles with token fallbacks) so it renders when the design system is the thing that failed.

`LibraryView` remains a god component (open, CQ-03) but is 6 lines smaller and 10 imports lighter, and its lazy children moved eight screens out of its module graph.

### 1.3 Dependency changes

- `App` now depends on `lib/theme` instead of owning theme effects.
- `LibraryView` depends on `lib/pagination`; its dependency on `packages/library-ui` is unchanged (public entry point only).
- `features/**` may no longer depend on `state/readerState` (enforced).
- **No new runtime dependency was added.** No dependency was removed in this phase (`playwright`/`jsdom` removal remains deferred — see §5).

### 1.4 API / contract changes

- `Pagination` gained an optional `ariaLabel` prop; all existing props and the call signature are unchanged (drop-in).
- `BookTable`'s previously ignored `onOpenDetails` prop is now honoured (a "Details" action cell appears only when the prop is provided) — a prop that lied is now a prop that works.
- `BookCard` and `BookTable` render real interactive elements instead of click-handling containers; no prop changes.
- Rust IPC contracts, `@luma/shared-types`, and Tauri command signatures are untouched.

### 1.5 Data ownership changes

None to the durable layer (SQLite remains the only durable owner). One frontend ownership change: the chrome-theme preference has exactly one writer. `localStorage["luma_theme"]` remains the sanctioned exception documented in `SOURCE-OF-TRUTH.md`; the *mechanism* was not changed, only the number of writers.

### 1.6 Sync/async, event architecture, reliability, security boundaries

- **Async**: no new async mechanism. The reader store's retry reuses the existing promise chain; the debounced progress writer is unchanged except for the unconditional flush on close.
- **Events**: the `luma-reader-scroll-to` `CustomEvent` bus is **unchanged** (CQ-07/CQ-LOW-NEW3 style debt, deferred — replacing it needs a store-shape decision).
- **Reliability**: added the UI failure tier (A1) and the conditional-read failure states (A5). No retries were added to IPC itself: local IPC has no network failure mode, and the retry that matters is user-facing.
- **Security boundaries**: no change to capabilities or the sanitizer (correctly, per the preservation rule — `core:default` only, ammonia at the Rust boundary). CSP hardening and self-hosted fonts are *deferred* with the exact recommended policy recorded rather than applied, because tightening `img-src`/`script-src` changes observable behaviour for documents that reference remote assets and deserves its own verified change.

### 1.7 Configuration changes

- `vite.config.ts`: `sourcemap: true` for all builds (previously debug-only) and an explicit `manualChunks` policy with the rationale in-file.
- `eslint.config.mjs`: a feature-boundary rule. **Important implementation note recorded in the config itself**: the later `files` block *replaces* `no-restricted-imports` rather than merging, so the workspace-package restriction is repeated there — otherwise enforcing the new boundary would have silently dropped the existing one.
- `index.html`: hardcoded `bg-[#FAF7F2] text-[#1C1917]` body classes removed (a class selector outranks the `body` element rule, so these silently defeated `--bg-primary`/`--text-primary` in dark mode). `select-none` retained deliberately, documented in-file.

### 1.8 Team / ownership and developer-experience impact

- **DX improved**: `pnpm test` is now side-effect free (no more surprise dirty tree on an unrelated tracked file); a crash is now diagnosable (boundary + sink + source maps); the library's paging numbers are true.
- **DX cost**: one extra chunk fetch before the library paints; a new boundary rule to understand; two more small modules in `lib/`.
- **Conway's Law note**: `lib/tauri.ts` and `LibraryView.tsx` remain the two files every frontend change touches. That is the merge-conflict surface the day a second engineer joins, and it is the next structural item (§5).

### 1.9 Migration strategy

All six changes are in-place and independently revertible (no data migration, no contract versioning, no compatibility shim needed). The lazy-loading change was verified by building and diffing the chunk graph, and the theme change by reloading the live app and confirming persistence.

### 1.10 Architecture tests / fitness functions

| Function | Mechanism | Status |
|---|---|---|
| Crate dependency direction, cycles, policy coverage | `cargo test --test architecture_boundaries` | ✅ unchanged, passing |
| Workspace packages consumed only via public entry points | ESLint `no-restricted-imports` | ✅ unchanged |
| **New**: features must not import the reader-store singleton | ESLint `no-restricted-imports` (features block) | ✅ new, 0 violations |
| **New**: theme has a single writer | `theme.test.ts` asserts exactly one `setItem` call for the storage key; `readerState.test.ts` asserts the store never touches `document`/`localStorage` | ✅ new |
| **New**: paging arithmetic is true | `pagination.test.ts` (5 cases incl. clamping and empty lists) | ✅ new |
| **New**: failures are classified and reported | `errorReporting.test.ts` (7 cases incl. listener install/dispose) | ✅ new |

Deliberately *not* added: hundreds of architecture rules, an import-graph tool, or a frontend bundle-budget gate in CI. Those are recorded as candidate next steps with evidence requirements, not as ceremony.

---

## 2. CODEQUALITY-02 — Refactoring, abstraction, debt

### 2.1 Code quality changes implemented

- **Correctness fix found by a new test**: `describeError` could return `undefined` despite a `string` return type, because `JSON.stringify(undefined)` returns `undefined` while TypeScript types it as `string`. Now explicitly handled (`"Unknown error"`, `"null"`, non-string results coerced) and covered by tests including a circular reference.
- **Duplicated knowledge removed**: five copies of the same inline "open this book" handler in `LibraryView` (each carrying two debug logs) collapsed into one `handleSelectBook` callback. `LibraryView.tsx` −122 lines / +128 lines net ~0, but the *knowledge* was removed rather than the lines.
- **Lying data removed (dispensable + lying-UI smell)**: `BookTable` no longer fabricates `35%` progress, no longer guesses a file format by substring-matching a file id, and drives its status badge from the real `reading_status`. The impossible-to-derive FORMAT column was removed; unknown progress renders `—`.
- **Dead prop revived**: `BookTable.onOpenDetails` was accepted and discarded (`onOpenDetails: _onOpenDetails`); it now renders a real Details action.
- **Dead code removed**: `pageWindow`/`PAGE_GAP`/`PageToken` were deleted from `lib/pagination.ts` immediately after the pager moved its windowing inside the component — the abstraction existed for one consumer that could not import it across the package boundary. (Abstraction removed before it became wrong.)
- **Production debug noise removed**: all 15 `[LUMA-OPEN]` trace sites across `App.tsx`, `LibraryView.tsx` (10), `readerState.ts` (5), `EpubReaderView.tsx` (2), `PdfPageCanvas.tsx` (2), `PdfReaderView.tsx` (1) are gone. Real errors still log through the existing logger.
- **Style/architecture hygiene**: `App.tsx` and `main.tsx` rewritten with LF line endings per `.gitattributes`/`.editorconfig` (they were the only CRLF outliers in `src/`).
- **Boy-scout**: a stray double blank line inside `LibraryView.loadBooks`'s catch block removed.

### 2.2 Refactoring ledger

```text
Refactor ID: REF-01
Area: Reliability — application shell
Original pain: Any uncaught render error produced a permanently blank window with
  no message, no recovery and no record; failed document loads were console-only.
Evidence: 0 matches for ErrorBoundary/componentDidCatch/window.onerror/
  unhandledrejection across apps/desktop/src; readerState catch blocks logged only.
Behavior characterized: reader load success/failure paths covered by new store tests.
Refactoring: ErrorBoundary (root + per-view), lib/errorReporting sink + global
  handlers, store loadError state with retryLoad, release source maps.
Why this structure: the boundary must not depend on the design system it might be
  rendering, so it is dependency-free; one sink keeps console + telemetry together.
Alternative considered: a logging library / error-monitoring SDK — rejected, it
  cannot report anywhere in an offline desktop app and adds a dependency.
Risk: Low (additive). Tests before: 0. Tests after: 7 (reporting) + 2 (store).
Complexity before/after: no boundary / one 166-line boundary + 115-line sink.
Coupling before/after: reader failures coupled to console / coupled to one sink.
Change locality: new UI failure handling now has an obvious home.
Performance impact: negligible (listeners only; no per-render work).
Maintenance impact: strongly positive — failures are now visible and diagnosable.
Decision: KEEP.

Refactor ID: REF-02
Area: State ownership — chrome theme
Original pain: four writers of one preference; token layer defeated by literals.
Evidence: App.tsx localStorage+class writes; readerState.updateSettings performing
  the same writes; LUMA_THEMES unused; 135 inline hex literals in src.
Behavior characterized: theme.test.ts (7 cases) + a store guard test.
Refactoring: lib/theme.ts as sole reader/applier/persister; store side effects
  removed; body token authority restored in index.html.
Alternative considered: move theme into SQLite settings via IPC — deferred; the
  project's documented localStorage exception is not the defect, the writer count is.
Risk: Low. Tests before: 0. Tests after: 9.
Change locality: theme is now one file plus one App effect.
Decision: KEEP.

Refactor ID: REF-03
Area: Delivery — bundle
Original pain: 948.5 kB single chunk; library users paid for pdf.js and 8 screens.
Evidence: Vite build output + `chunks are larger than 500 kB` warning; static
  imports of pdfjs-dist and all feature screens.
Behavior characterized: build comparison before/after; live browser session.
Refactoring: React.lazy for both top-level views and 8 feature screens + 2 modals,
  Suspense fallbacks that keep the sidebar mounted, manualChunks for react/pdfjs.
Alternative considered: manualChunks only (no lazy) — rejected: it splits the file
  but still downloads every engine at startup.
Risk: Low (thin components; behavior verified live).
Change locality: each screen is now its own chunk and its own fetch.
Performance impact: initial JS 948.5 → 318.3 kB min (266.6 → 94.5 kB gzip); pdf.js
  (435 kB) deferred until a PDF is opened.
Decision: KEEP.

Refactor ID: REF-04
Area: Correctness — library pagination and list truthfulness
Original pain: a pager that could not page, a count label that always said
  "Showing 1-N of N", a table showing invented progress and a guessed format.
Evidence: LibraryView.tsx (currentPage set but never used to slice; hardcoded
  label; `Math.ceil(books.length / 20)`), packages/library-ui Pagination
  (literal 1/2/3/…/12 buttons, `onPageChange(12)`), BookTable (return 35; format
  by substring-matching a file id).
Behavior characterized: pagination.test.ts (5 cases incl. clamping/empty);
  live check of the rendered label and pager tokens.
Refactoring: real paging via lib/pagination + honest labels + page reset on filter
  change and clamp on shrink; ListView/BookTable honesty fixes.
Why this structure: the arithmetic is pure and testable; the component keeps its
  API and renders only true page numbers.
Alternative considered: deleting the pager entirely — deferred as a product choice
  (virtualization vs paging vs infinite scroll) that needs a decision, not a guess.
Risk: Low-Medium (visible UI change). Tests before: 0. Tests after: 5.
Decision: KEEP.

Refactor ID: REF-05
Area: Test hygiene — hermetic suite
Original pain: `pnpm test` rewrote a git-tracked documentation artifact on every
  run (235-line churn), overwriting the repository's committed perf evidence.
Evidence: reproduced; git diff on docs/performance/runtime/raw_telemetry_capture.json.
Refactoring: output path resolves from LUMA_TELEMETRY_OUT, defaulting to a temp dir.
Alternative considered: deleting the write entirely — rejected: capturing raw
  telemetry is a legitimate activity, it just must not be a side effect of `test`.
Risk: Very low. Validation: two consecutive test runs, `git status` clean.
Decision: KEEP.

Refactor ID: REF-06
Area: Duplication — book selection handler
Original pain: five copies of one handler, each with two debug logs (divergent
  change risk on any navigation change).
Evidence: LibraryView.tsx five inline blocks.
Refactoring: one useCallback used by all five call sites.
Risk: Very low. Validation: typecheck + live click-through.
Decision: KEEP.
```

### 2.3 Duplication decisions

| Duplication | Classification | Decision |
|---|---|---|
| Book-selection handler ×5 | Knowledge duplication | **Deduplicated** (REF-06) |
| Paging arithmetic (previously inline in `LibraryView`, previously hardcoded in `Pagination`) | Knowledge duplication | **Deduplicated** into `lib/pagination.ts` + component-local windowing |
| Pager window logic (`lib` vs `packages/library-ui`) | Incidental (package boundary) | **Deliberately left duplicated-in-intent**: the package cannot import app code; two ~15-line implementations with different responsibilities (arithmetic vs presentation) beat a new shared package for one pager |
| Six document engines / format-specific branches | Incidental | **Left alone** (as advised by the audit) |
| `ReadingProgress` construction ×4 in `readerState.ts` | Knowledge duplication | **Deferred** (needs the `DocumentPosition` decision; ledger entry open) |
| Two divergent `verify-epub-highlight.ts` copies | Knowledge duplication | **Deferred** (needs an owner decision on which is authoritative) |

### 2.4 Abstraction changes

- **Added**: `paginate`/`clampPage`/`totalPagesFor` (pure, 3 consumers), `describeError`/`buildReport`/`createErrorSink` (2 consumers: boundary + global handlers), theme helpers (1 consumer now, 2 potential: reader settings vs chrome).
- **Removed**: `pageWindow`/`PAGE_GAP`/`PageToken` (created and deleted within the same phase once the package boundary made it wrong).
- **Rejected**: any abstraction over the 109-method API client in this phase (see §4).

### 2.5 SOLID, composition, error handling, side effects, concurrency, types

- **SOLID**: no new interfaces, no DI container, no inheritance. The one DIP-shaped addition (`ErrorSink`) has two real consumers (boundary + window handlers) and an injectable default for tests — justified, not speculative.
- **Composition**: `BookCard` was restructured so the primary action is a real button rather than a clickable container (removes the invalid-nesting trap that blocked a semantic fix).
- **Error handling**: introduced one classification point (`buildReport`) instead of ad-hoc strings; the store now distinguishes load failure from transient status; `PdfPageCanvas` cancelled-render early return is untouched (correct already).
- **Side effects**: removed (theme DOM/storage writes out of the store); made explicit (progress flush on close); added to the boundary only where required.
- **Concurrency**: the debounced progress writer is unchanged in structure; the close-path flush now always runs. Cancellation/stale-response guards on document loads remain open (deferred — needs care in the reader path, ledger entry kept).
- **Types**: no `any` added (lint would fail); the `describeError` return-type lie is fixed; the injected test double is typed through the real client type.

### 2.6 Static analysis, quality gates, dead code, comments, observability

- **Static analysis**: one new high-signal rule; zero new suppressions; zero warnings.
- **Quality gates**: local gates unchanged (typecheck/lint/test) and now meaningful for the new modules; CI is unchanged (no new CI dependency added).
- **Dead code removed**: `[LUMA-OPEN]` traces, `_onOpenDetails`, `pageWindow`. **Known remaining dead surface** (not removed this phase): `LUMA_THEMES` (unused export), `SanitizerConfig`/`sanitize_untrusted_html_with_config` (documented as unused), unused `playwright`+`jsdom` dev deps, and the duplicated verifier script.
- **Comments**: new modules carry why-oriented comments only (ownership, why dependency-free, why the temp-dir default, why `JSON.stringify` cannot be trusted). No comment restates code.
- **Observability**: the frontend now has a single failure channel (`LUMA_ERR_*` events through `perfTelemetry`) plus source maps. Field/RUM capture, error sampling, and a bundle budget remain open.

### 2.7 Performance-sensitive code

No optimization was performed without measurement. The only performance work was *delivery* (lazy chunks), measured by build output. In-repo `perfTelemetry` marks (`LUMA_PERF_REACT_MOUNT`, `LUMA_PERF_READER_VISIBLE`, …) remain the measurement vehicle and still fire.

---

## 3. FRONTEND-02 — Frontend architecture, state, components, UX

### 3.1 Implemented

| # | Change | Finding addressed | Class |
|---|---|---|---|
| F1 | Error boundary + error sink + release source maps | FE-CRIT-1 | REQUIRED |
| F2 | Reader load-error state with retry, distinct from loading/status | FE-CRIT-1 | REQUIRED |
| F3 | Single chrome-theme owner; store side effects removed | FE-HIGH-2 | REQUIRED |
| F4 | Feature/engine-level code splitting + chunk policy | FE-HIGH-4 | HIGH VALUE |
| F5 | Real pagination + honest totals/labels | FE-MED-4 | REQUIRED (state/UI lied) |
| F6 | Iterator/keyboard-accessible book surfaces (`BookCard` primary overlay button, `BookTable` title/detail buttons, `sr-only` caption, `aria-current` pager, focus-visible rings) | FE-MED-3 (partial) | REQUIRED (a11y) |
| F7 | Honest list data (no fabricated progress/format) | CQ-LOW-NEW | REQUIRED |
| F8 | Theme-token authority restored on `<body>` | FE-HIGH-2 / CQ-K | REQUIRED |
| F9 | Boundary rule preventing store-singleton imports from features | FE-07 / CQ-08 (frontend half) | HIGH VALUE (partial: see deferred) |
| F10 | Progress flush on close made unconditional | ARCH-1 | REQUIRED (correctness) |

### 3.2 State ownership after this phase

| State | Owner now | Correct? |
|---|---|---|
| Chrome theme | `App` + `lib/theme.ts` | ✅ single owner |
| Reader paper theme / typography | reader store `settings` (persisted via reader settings path; canvas + e-ink engine selector) | ✅ unchanged, now the *only* theme writer in the store |
| Reader session/document/annotations/bookmarks/progress | reader store (via injected API) | ✅ |
| Reader load failure | reader store `loadError` (+`retryLoad`) | ✅ new |
| Library server data, filters, section, page | `LibraryView` local state | ⚠️ unchanged (FE-HIGH-3 open — see §5) |
| Paging arithmetic | `lib/pagination.ts` (pure) + component-local page state | ✅ new |
| Theme storage key | `lib/theme.ts` only | ✅ enforced by test |

### 3.3 Component API changes

- `Pagination`: + `ariaLabel?: string`; implementation now truthful and windowed; `aria-current` and focus-visible states added.
- `BookCard`: no prop change; root is no longer a click target — a full-card overlay button takes the primary action (`aria-label="Open <title>"`), and the details button is layered above it (`z-20` vs overlay `z-10`). *Note for future maintainers*: this layering is load-bearing; a naive rewrite into nested buttons would be invalid HTML.
- `BookTable`: `onOpenDetails` now honoured; title cell is a real button; row-level click retained for mouse users; new accessible caption.
- `LibraryView`: props unchanged; internal `config`/`labels`/`components` dead configuration surface **not** removed in this phase (deferred to avoid widening the diff — CQ-03 open).
- `ReaderView`: unchanged public props; renders a `role="alert"` banner with Retry when `loadError` is set.

### 3.4 Loading / empty / error / partial states after this phase

| Surface | loading | empty | error | partial | retry |
|---|---|---|---|---|---|
| Library grid/list | ✅ | ✅ | ✅ banner | ⚠️ per-call failures still degrade to empty (e.g. authors `.catch`) | ✅ |
| Reader open / chapter / page | ✅ (Suspense + store) | ❌ (still no "empty chapter" copy) | ✅ **new banner + retry** | ❌ | ✅ **new** |
| Section screens (lazy) | ✅ Suspense fallback keeping the sidebar | n/a | ✅ covered by the view boundary | ❌ | ✅ boundary retry |
| App shell (root) | n/a | n/a | ✅ **new root boundary** | n/a | ✅ retry/reload |

### 3.5 Deferred / not implemented in FRONTEND-02

Deliberately *not* done in this phase, each with a reason: library server-data owner and navigation-state survival (FE-HIGH-3) — needs the view-state decision; the remaining 10 components that call the `LumaApi` global (FE-07) — a mechanical migration that changes every feature and deserves its own diff; dialogs/dialog semantics for the six modals (FE-MED-3) — a shared Dialog component is the right fix and is a component design task; `user-select` narrowing; token consolidation off the 135 literals; component-test tier (RTL); CSP/font decisions.

---

## 4. UIUX-01 (discovery) and UIUX-02 (applied)

### 4.1 Product/UX understanding (as established from the implementation, not the README)

A local-first single-window reading and knowledge application. Primary users are individual readers/researchers with a large private library and no tolerance for losing annotations. Critical journeys, in order of frequency: (1) find a book in a large library → open it; (2) read and turn pages; (3) highlight/annotate and trust that the highlight survives; (4) search within a document and the library; (5) revisit notes/annotations. Import and backup are rarer but higher-risk. Everything else (workspace, intelligence, devices, plugins) is secondary surface.

### 4.2 UIUX-01 findings from this phase's live inspection (evidence-classified)

| ID | Area | Severity | Evidence | Current behaviour → why it matters | Recommended direction |
|---|---|---|---|---|---|
| UX-01 | Pager | 🔴 REQUIRED | `Pagination` hardcoded 1/2/3/…/12; `currentPage` never sliced; label always "Showing 1-N of N" | A control that cannot change the content erodes trust in every other control | **Fixed** (real paging + true totals) |
| UX-02 | List truthfulness | 🔴 REQUIRED | `BookTable` fabricated 35% and guessed format from an id | Users act on wrong information about their own library | **Fixed** (real status; unknown shown as unknown) |
| UX-03 | Keyboard access | 🔴 REQUIRED (a11y) | `BookCard` root `<div onClick>`, `<tr>` rows not focusable | Book opening was mouse-only on the two densest surfaces | **Fixed for cards/rows** (real buttons) |
| UX-04 | Failure visibility | 🔴 REQUIRED | Load failure = blank viewport + console | Users cannot distinguish "broken" from "slow" | **Fixed** (banner + retry) |
| UX-05 | Fonts | 🟠 HIGH | Dev loads `fonts.googleapis.com` CSS + `fonts.gstatic.com` woff2; packaged CSP allows only `'self'` | Shipped app silently renders in fallback serif while the dev build matches the design; an offline-first reader also makes a third-party request at launch | Self-host subset `woff2` + `font-display: swap`; delete the CDN `<link>` |
| UX-06 | Remote assets in a local-first product | 🟠 HIGH | Live: mock covers fetched from `images.unsplash.com`; CSP deliberately allows `img-src … https:` so sanitized document `<img>` can fetch remotely | Reading activity can leak to third-party hosts; offline reading shows broken images | Pin `img-src 'self' data: asset:` (or rewrite remote image URLs at the sanitizer boundary and surface "remote content blocked") |
| UX-07 | Token authority | 🟠 HIGH | Live: `body` had `bg-[#FAF7F2]` overriding `--bg-primary` in dark mode | The design-token layer silently did not apply where it mattered most | **Fixed for body**; consolidate the remaining 135 literals |
| UX-08 | Dialog semantics/focus | 🟠 HIGH (a11y) | `SettingsModal` has no `role="dialog"`, no `aria-modal`, no `Escape`, no focus trap; `CommandPaletteModal` traps neither | Keyboard/AT users can lose context in a modal and cannot reliably dismiss it | One shared Dialog primitive (semantics + trap + restore + Escape) for all six |
| UX-09 | Focus visibility | 🟡 CONTEXTUAL | `packages/ui` Button uses `focus:outline-none focus:ring-2 ring-stone-400/40` | Visible-focus contrast is likely below the WCAG 2.2 AA threshold, and the ring is not `focus-visible`-scoped | Token-based `focus-visible` ring meeting 3:1 |
| UX-10 | Chrome text selection | 🔵 POLISH | Live: `body` → `user-select: none`; reader content opts back in with `select-text` (selection verified working) | Book titles/quotes in chrome cannot be copied; reader selection is fine (earlier audit claim corrected) | Narrow `select-none` to interactive chrome |
| UX-11 | Empty/partial states | 🟡 CONTEXTUAL | Reader has no "empty chapter" state; some library fetches degrade to empty via `.catch(() => [])` | A partial failure is indistinguishable from real emptiness | Distinguish partial failure explicitly |
| UX-12 | Motion preferences | 🔵 POLISH | No `prefers-reduced-motion` usage; `animate-pulse`, smooth scroll, PDF canvas filter are unconditional | Motion-sensitive users cannot opt out | Add reduced-motion guards |
| UX-13 | Light-chrome/dark-canvas split | ⚪ CONTEXTUAL (not a defect) | Live screenshot: dark chrome + paper reading canvas | Intentional and defensible (reading surface ≠ chrome), but the two "theme" concepts share the word "theme" | Rename internally (`chromeTheme` vs `paperTheme`) when the token layer is consolidated |

**Strengths worth preserving (UIUX-01)**: the reader's visual hierarchy and typography are genuinely good (verified in a live screenshot: serif body, clear heading scale, drop cap, unobtrusive 75% progress strip, restrained toolbar); the library home establishes an editorial identity rather than a card grid; loading/empty/error states already existed for the library surface; the sidebar's grouping (Library / Deep Study / Explore) reflects real task grouping; empty-state copy is actionable ("Select Document to Import").

**Explicitly not-justified UIUX changes** (recorded so they are not re-litigated): a visual redesign, replacing the typography system, converting the reader chrome to a floating/glass aesthetic, adding animation for "premium feel", migrating to a component library, and changing the sidebar information architecture (the audit found no evidence of a navigation problem — only state-ownership and honesty problems).

### 4.3 Validation performed for the UI changes

Typecheck + lint + 76 tests (`pagination` cases cover the paging behaviour that cannot be reached with a 9-book mock library); production build chunk diff; live session on the dev server verifying: library renders, count label true, pager tokens true, 9 keyboard-focusable card buttons, reader opens through the lazy chunk with sanitized chapter HTML, no console errors, theme toggles and persists, dark `body` background now resolves from the token. Visual review via screenshot (dark chrome + paper canvas, no layout regressions).

### 4.4 Potential regression risks introduced

1. **Overlay-button layering in `BookCard`** — z-index is load-bearing (details button `z-20` over the primary overlay `z-10`); documented in a code comment.
2. **Extra async boundary** — the library views now mount behind Suspense; a slow disk could show the section fallback slightly longer. Fallbacks keep the sidebar mounted to avoid a jarring full-shell swap.
3. **Error boundary reset semantics** — the view boundary resets when the open book changes (`resetKey`), so a broken view can be escaped by navigating; a genuinely broken *library* view requires the reload button.
4. **Lazy chunk + `manualChunks`** — a future dependency added to the pdf.js group changes what is deferred; the policy is documented in `vite.config.ts`.
5. **Test-only stubs** — the new store tests use an injected API double; if the real client's surface changes, the double must be updated (deliberate: it documents exactly what the store consumes).

---

## 5. Files changed

**Added (8)**: `apps/desktop/src/lib/theme.ts`, `lib/errorReporting.ts`, `lib/pagination.ts`, `components/ErrorBoundary.tsx`, `lib/__tests__/theme.test.ts`, `lib/__tests__/errorReporting.test.ts`, `lib/__tests__/pagination.test.ts`, `docs/adr/ADR-0025-Frontend-Failure-Delivery-and-Ownership.md` (+ this report, + the audit report).

**Modified (14)**: `apps/desktop/index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/state/readerState.ts`, `src/state/__tests__/readerState.test.ts`, `src/features/library/LibraryView.tsx`, `src/features/reader/ReaderView.tsx`, `EpubReaderView.tsx`, `PdfReaderView.tsx`, `PdfPageCanvas.tsx`, `src/lib/__tests__/runtimeTelemetryCapture.test.ts`, `vite.config.ts`, `packages/library-ui/src/index.tsx`, `eslint.config.mjs`.

Diff: **+625 / −387** in tracked files (excluding new files), of which ~180 lines are removed debug logging and ~120 are removed duplicated/lying UI code.

---

## 6. Remaining architectural risks (in priority order)

1. **`lib/tauri.ts` — 1,636 lines, 109 methods, transport + mock backend + localStorage fallback + domain API in one class** (CQ-01, open). Every IPC change touches it twice. The tested seam exists; the decomposition is the highest-value maintainability work left.
2. **`LibraryView.tsx` — ~1,000 lines, 47 hooks, and it owns navigation** (CQ-03 + FE-HIGH-3, open). Navigation/filter state dies when the reader opens, and it is the second file every frontend change touches. Fix the state ownership before decomposing, and add the component-test tier first.
3. **No component/behavior test tier** (no `@testing-library/react`; `jsdom` installed but unused; `playwright` declared with no config or specs). A11y and interaction regressions are undetectable in CI.
4. **Accessibility is not a stated quality attribute** anywhere in `docs/`, which is why 14 interactive files still have no a11y affordances. Adding the requirement is the cheapest durable fix.
5. **Token scatter**: 135 inline hex literals + three token sources remain; every future contrast/theming question is a grep.
6. **CSP perimeter** (`'unsafe-inline'` for scripts; `img-src https:`) and the external font CDN — recorded with a recommended policy; each is a deliberate, verifiable change away.
7. **Dev bridge** (`src/bin/browser_reader_bridge.rs`) is an unauthenticated loopback API over the real library; fine as dev tooling, but its containment (feature flag, per-run token, excluded from bundles) should be explicit and stated in the threat model.
8. **Reader IPC races**: no cancellation/stale-response guard on chapter/page loads.

## 7. Deferred changes (with triggers)

| Item | Trigger to act |
|---|---|
| `tauri.ts` decomposition + `MockTransport` replacing 109 inline mock closures | Next change that touches ≥3 IPC commands |
| `LibraryView` decomposition + nav-state survival | Immediately before a second frontend contributor joins (merge-conflict surface) |
| Component/behavior test tier (RTL + jsdom env for `src/features/**`) | Before any `LibraryView`/reader UI refactor |
| Shared Dialog primitive for the six modals | With the a11y pass |
| Token consolidation (single source → CSS custom properties; delete `LUMA_THEMES`/`READER_THEME_STYLES` duplication) | With the design-token/a11y pass |
| Self-hosted fonts | Any offline-verification or privacy release gate |
| CSP tightening (`script-src`, `img-src`) | With a decision on remote images inside documents |
| `DocumentPosition` type + single `ReadingProgress` factory | Next reader-navigation change |
| IPC command-name registry (compile-time drift detection) | Next protocol change |
| Virtualization vs paging vs infinite scroll for large libraries | After profiling a ~1,000-book library |
| Dead surface removal (`SanitizerConfig`, `LUMA_THEMES`, unused `playwright`/`jsdom`, duplicate verifier script) | A dedicated cleanup change |
| `luma-reader-scroll-to` event bus → typed intent | With the reader-store split |

## 8. Explicitly rejected in this phase

- **Any rewrite** of the frontend, the API client, or `LibraryView` — every problem found is localized and testable; a rewrite would destroy the enforced layering and the reader invariants.
- **New state library / server-state cache / meta-framework / SSR** — no requirement; the app is a single-window offline desktop application.
- **A client virtual list** before profiling — the honest fix was to make paging real first.
- **A new shared package for pager windowing** — two ~15-line implementations across a package boundary beat a fourth package.
- **Widening the CSP to make the Google Fonts CDN work** — self-hosting is the fix; a wider policy is the losing option.
- **Adding `@testing-library/react` inside a structural change** — the tier is needed, but it is a dependency and suite-wide decision, not a smuggled side effect.
- **A frontend bundle-budget CI gate in this phase** — worth having; recorded as the next quality-gate step with the measured baseline (318 kB / 94.5 kB gzip initial) rather than as an unowned rule.
- **Replacing the `luma-reader-scroll-to` event bus** — needs the store-shape decision, not a mechanical swap.

## 9. Recommended next phase

1. **Component-test tier + a11y pass together** (RTL/jsdom for `src/features/**`, shared Dialog, `focus-visible` ring, reduced motion, partial-vs-empty states, `user-select` narrowing). Rationale: it makes every subsequent UI change verifiable and it is the largest remaining quality gap.
2. **`tauri.ts` decomposition** (transport / domains / mock provider) with the existing 76 tests as the guard — the biggest single-file change cost.
3. **Navigation-state ownership** (survive the reader) **then** `LibraryView` decomposition.
4. **Token consolidation** (one source of truth; delete the duplicates and the 135 literals).
5. **Security/fonts**: self-host fonts, tighten CSP, document the dev bridge.
