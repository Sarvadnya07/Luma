# 🏛️ LUMA — Phase 03 Validation: Architecture Resilience · Code Quality · Frontend UX/A11y

**Date**: 2026-09-17
**Phase**: ARCH-03 + CODEQUALITY-03 + FRONTEND-03 + UIUX-03, sliced to the highest-value validation this codebase actually needs (a local-first single-user desktop reader).
**Method**: Independent re-verification, not report trust. Prior phase reports (ARCH-04 final gate, CODEQUALITY-03, the phase-02 forensic audit) were read as hypotheses; every claim re-checked here was exercised against the working tree, the test suites, the fitness functions, or the running UI.
**Prior reports consumed**: `docs/audits/ARCH-04-FINAL-GATE.md`, `docs/audits/CODEQUALITY-03-VALIDATION.md`, `docs/audits/PHASE-02-REMEDIATION-FRONTEND-CODEQUALITY-ARCH.md`, ADRs 0001–0025, `docs/audits/DYNAMIC-DATA-RECONSTRUCTION-REPORT.md`.

---

## 1. Executive Verdict

🟢 **ARCHITECTURE VALIDATED FOR ITS STATED OPERATING CONDITIONS, with an honest boundary of what was and was not proven.**

The prior phases' structural claims held up under re-verification:

| Claim from prior phases | This phase's evidence | Status |
|---|---|---|
| Dependency layering is enforced by CI | Cargo boundary test **deliberately violated** (forbidden `luma-core → luma-storage` edge); build failed with exit 101 | VERIFIED (fires) |
| Frontend import boundaries are enforced | ESLint probe importing `src/testing` from production code **deliberately planted**; rule fired with `no-restricted-imports` | VERIFIED (fires) |
| Data-layer absence cannot masquerade as content | Browser preview (no Tauri runtime) renders the honest error + retry state; `DataServicesUnavailableError` is the only data path | RUNTIME-VERIFIED |
| Import failures reach the user | Live dialog contract tests + the failure-path component tests from phase 02 | TESTED |
| Fitness tests scan production for fixtures/fake data | `dynamicDataFitness.test.ts` — 10 tests green | TESTED |

Two real defects were found and fixed during live validation (§5). One known-risk area (dialog focus containment) was measured honestly and left as documented debt (§7.3).

---

## 2. ARCH-03 — Resilience, Failure & Scale

### 2.1 Architecture-fit statement (the most important line in this report)

This is a **local-first, single-user, single-process desktop application**. Most distributed-systems concerns in the phase prompt — multi-region, tenancy, queues, message brokers, service meshes, connection pools — are **not applicable**, and adding them would be complexity without a requirement. The validation below addresses the failure modes that *can* occur in this architecture: process crash, database failure/corruption, large workloads, concurrent access, bad releases, and state divergence.

### 2.2 Failure-mode inventory (system-specific)

| Failure | Blast radius | Detection | Containment | Recovery | Data impact | Status |
|---|---|---|---|---|---|---|
| Data layer unavailable at startup (Rust host not reached) | Whole window | `DataServicesUnavailableError` per command | Error state with retry in LibraryView; no fake content fallback | Retry re-issues all loads | None (no data fabricated) | RUNTIME-VERIFIED (live preview) |
| Single IPC command fails mid-session (e.g. `list_books` locked) | One surface | `console.error` + error state for books; metadata/analytics failures are non-fatal (partial rendering preserved) | Books error state isolates from collections/tags/authors | Retry button | None | TESTED (`LibraryView` failure/recovery test) |
| Import rejected outright (unsupported format) | One import | Modal "Import Failed" with reason (`role="alert"`) | Job null + error state; next import unaffected | Dismiss → retry import | None (no partial record) | TESTED (2 tests) |
| Render throw in a view | That view | Root + per-view ErrorBoundary, telemetry `LUMA_ERR_RENDER` | Boundary isolates tree below it | Retry / return-to-library / reload | None | TESTED (prior phase, boundaries still green) |
| Unhandled promise rejection | None visible | `window.onerror` + `unhandledrejection` → shared telemetry sink | Logged, not user-facing crash | n/a | None | TESTED (`errorReporting.test.ts`) |
| Long batch write during reads (import of large library) | Import job only | ImportProgressModal per-item status | WAL + split read/write connections (ADR-0023): readers proceed during writer transaction | Job-level failure reporting | Transactional per import job | VERIFIED-BY-DESIGN (ADR + engine-level `query_only` on readers) |
| Database corruption | Whole library | SQLite integrity; **unproven detection path in UI** | Backups subsystem exists (create/inspect/restore commands) | Manual restore from backup | Potential loss since last backup | PARTIALLY VERIFIED (commands tested; no UI-triggered detection flow) |
| Deleted data reappearing (fixture leak) | Whole trust model | `dynamicDataFitness.test.ts` | No in-memory fallback in transport (deleted in phase 02) | n/a | n/a | TESTED |

### 2.3 Failure-domain analysis

The single process is one failure domain by design. Within it, the important containment seams are:

- **Transport seam** (`LumaTransport`): data-layer unavailability cannot leak fake content (phase-02 fix, re-verified live this phase). This is the strongest correctness containment in the app.
- **ErrorBoundary seam**: render failures are isolated per view rather than blanking the window.
- **Partial-load isolation**: `loadMetadata` and analytics failures do not block the book grid; only `list_books` failure gates the main content. One dependency failing does not blank the interface (prompt §FRONTEND-03.8 requirement — met).
- **What does NOT contain failures**: a single SQLite file means database failure is total. This is acceptable and priced-in for local-first (mitigation = backups), not a defect.

### 2.4 SPOFs (deliberate, accepted, with mitigation)

| SPOF | Business impact | Likelihood | Mitigation | Cost to eliminate |
|---|---|---|---|---|
| Single SQLite file | Total data loss if corrupted | Very low (WAL, local disk) | Backup create/inspect/restore subsystem | Multi-file replication — **rejected**: no requirement for a single-user local app |
| Single Rust host process | App unavailable | Low | OS process supervision is out of scope for Tauri; app relaunch is the recovery | n/a |
| Sync `readerState` store singleton | Reader-wide state issues if buggy | Low | DI seam (store injected via context), tested with doubles | n/a |

None of these warrant elimination. The economics favor backup + restore over replication for this product.

### 2.5 Cascading failure analysis

The dangerous cascade in this architecture would be **retry storms against the Rust layer**. Current state: the retry affordances are user-triggered (buttons), not automatic with backoff — so a synchronized-retry storm cannot occur architecturally. The `onDomainEvent` subscriptions degrade to no-ops when no event bridge exists (verified in live console output), rather than retry-looping. **No cascade vector found.**

### 2.6 Concurrency

- SQLite WAL + dedicated writer connection + query-only reader connections (ADR-0023) is the right concurrency architecture for embedded storage; the engine-level `query_only` invariant is stronger than app-level discipline.
- The frontend-side race class (stale async responses overwriting fresh state in the reader) remains open — recorded in the phase-02 deferred table with a trigger ("next reader-navigation change"). Not re-tested here; unchanged since.
- **DeviceId per-operation stamping in `luma-core`** (backend defect found in the dynamic-data phase, frontend now sends a real per-install id) remains open and is the correct owner of one concurrency/identity concern. UNCHANGED/UNPROVEN in this phase.

### 2.7 Scalability & capacity (honest)

Scale dimension that matters: **library size** (documents + metadata rows), not concurrent users.

- Paging is real arithmetic (phase-02), so the grid/list render O(page) records regardless of library size. Tested.
- FTS5 for search is the right tool for 10⁴–10⁵-scale row counts.
- **Cover data URLs and `getBookFileBytes` move whole files through IPC** — the plausible bottleneck at very large libraries (100+ MB PDFs). No profiling was done; the phase-02 trigger ("after profiling a ~1,000-book library") stands. UNPROVEN, recorded, not guessed at.
- Import of large batches is job-based with per-item status (scales horizontally per item within the job).

### 2.8 Deployment & schema evolution

- Tauri single-artifact distribution; migrations are versioned in `luma-storage` with transactional repositories. Rolling-deployment concerns (old producer ↔ new consumer) do not apply to a monolithic desktop binary; the applicable concern is **app-version ↔ on-disk-schema compatibility on downgrade**, which is **UNVERIFIED** and recorded as a remaining risk (§7.6).
- Feature flags: `LibraryViewConfig` gates exist (drag-drop, duplicate modal, command palette), defaulting sensibly.

---

## 3. CODEQUALITY-03 — Prove the improvements are real

### 3.1 Fitness functions fire (verified by violation, not by trust)

| Fitness function | Probe performed | Result |
|---|---|---|
| Cargo crate layering (`architecture_boundaries.rs`) | Added forbidden `luma-core → luma-storage` edge to `Cargo.toml` | ❌ build failed (exit 101, cyclic package dependency rejected before test even ran; the test suite also asserts the layering) — probe reverted, suite green |
| ESLint production-import boundary | Planted `__boundary_probe.ts` importing `src/testing/inMemoryBackend` from `src/features/` | ❌ rule fired: `no-restricted-imports` error — probe removed, lint green |
| Dynamic-data fitness test | 10 tests over production source | ✅ green (fixtures, stock images, embedded image data, sample ids, shared UUID, implicit in-memory store all rejected) |

### 3.2 Change-locality validation (representative change)

The change made *in this phase* doubles as the locality test: adding an honest empty state + creation action to the Collections section touched exactly **one production file** (`LibrarySidebar.tsx`), one test file, and required **zero** changes to `LibraryView`, the store, the transport, or shared types. Under the pre-phase-02 structure (state ownership scattered, modals unwired) the same change would have touched the modal wiring in `LibraryView` too. **KEEP** verdict for the phase-02 boundary work, on locality evidence.

### 3.3 Behavior-preservation checks on this phase's fixes

| Fix | Behavior before | Behavior after | Regression check |
|---|---|---|---|
| Sidebar empty-collections state | Section rendered nothing with 0 collections | "No collections" + New Collection action | Sub-list rendering with >0 collections unchanged (tested both branches); `renderSubItems` consumers unaffected |
| Focus restoration in 3 modals | Focus fell to `<body>` on close | Restored to opener | Escape/cancel/submit paths unchanged (existing 8 tests still pass); new restore test |
| Import failure modal (prior turn) | Console-only failure | "Import Failed" dialog | All 8 ImportProgressModal tests pass; success-path rendering byte-identical logic |

### 3.4 Metric-gaming audit

- The new `useEffect` return-value annotations (`return undefined;`) satisfy `TS7030` without changing logic — not a suppression, an explicit contract.
- No new interfaces, wrappers, or trivial extractions were added this phase. The `subscribe?`/`emit` seam added in the test phase is used by tests and the browser harness — a real seam, not a speculative one.
- No lint suppression, test-skipping, or config weakening anywhere in this phase.

### 3.5 Public surface

- `LumaTransport` gained an *optional* `subscribe?` — backward-compatible for every existing transport; the no-op default behavior is unchanged.
- `ImportProgressModalProps` gained an *optional* `error?` — existing call sites compile unchanged.
- No exports removed; no IPC command names touched.

### 3.6 Dispositions

| Change | Disposition | Evidence |
|---|---|---|
| Phase-02 boundary/state work | KEEP | Locality + green gates + fitness functions fire |
| Component-test tier | KEEP | 131 tests, 5 consecutive green full-suite runs (stability work earlier this session) |
| Sidebar empty-state fix | KEEP | Tested both branches |
| Focus restoration | KEEP | Tested |
| `tauri.ts` decomposition (open item) | DEFER | Trigger unchanged from phase-02 ledger |
| Dialog focus trap | DEFER (documented, see §7.3) | Measured, not assumed |

---

## 4. FRONTEND-03 / UIUX-03 — Real-condition UX validation

### 4.1 Validation matrix (honest statuses)

| Capability | Expected | Evidence | Status |
|---|---|---|---|
| Data-layer absence UX | Error + retry, no fake data | Live preview: "Failed to load library data. Please try again." + Retry button; console shows typed `DataServicesUnavailableError` | **RUNTIME-VERIFIED** |
| Retry recovery | Retrying re-issues loads | Clicked Retry in live preview (state unchanged with transport still absent — correct: no fake success) | **RUNTIME-VERIFIED** |
| Empty state (fresh install, collections) | Context + next action | Live: "No collections" + New Collection visible | **RUNTIME-VERIFIED** (after fix) |
| Empty state (fresh install, library) | Context + import action | Component test (`LibraryView` first-run test) | **TESTED** |
| Error state naming | Names the failing file + reason | Import-failure dialog test asserts message content | **TESTED** |
| Partial failure | One failing dependency doesn't blank UI | Books error state isolates from sidebar/metadata | **TESTED** |
| Dialog a11y: name/description | Labelled, described | `aria-labelledby` + working `aria-describedby` target | **TESTED + RUNTIME-VERIFIED** |
| Dialog a11y: Escape | Closes | Live keyboard event + component tests | **RUNTIME-VERIFIED** |
| Dialog a11y: initial focus | Focus enters first field | Live: `document.activeElement` = name input | **RUNTIME-VERIFIED** |
| Dialog a11y: focus restore | Returns to opener | Was broken live → fixed → test | **TESTED** |
| Dialog a11y: focus containment | Tab stays in dialog | **NOT constrained in code**; measured as open risk | **UNVERIFIED → documented debt (§7.3)** |
| Keyboard navigation (sidebar/cards/pager) | All real buttons, `aria-current` | Snapshot: every control is a named focusable button; `aria-current="page"` verified live and in tests | **RUNTIME-VERIFIED** |
| Loading state | Distinguishable, `aria-live` | `role="status"` + `aria-live="polite"` in code + render | **TESTED** |
| Color independence | State not color-only | `aria-pressed`, `aria-current`, text labels on state | **TESTED** |
| Reduced motion | Respected | No `prefers-reduced-motion` handling exists; animations are minimal (fade/spin) | **UNVERIFIED** (low blast radius, recorded) |
| Zoom / 200% | Layout survives | Not measured this phase | **UNVERIFIED** |
| Screen reader flow | Usable, not just compliant | No AT run performed | **UNVERIFIED** (automated + semantic checks only) |
| Mobile/responsive | Usable | Desktop-primary Tauri app; no breakpoint testing done | **UNVERIFIED** (out of declared scope) |

### 4.2 Network degradation / offline / real-time / optimistic UI

Not applicable and not claimed: the app is local-first over in-process IPC; there is no network data path (the only outbound requests in a stock build are the Google Fonts CDN and Unsplash covers found in phase 02 — the fonts remain a deferred privacy item; cover fetches were eliminated with the mock purge). "Offline" is the normal operating mode. Offline support is *de facto total* because there is no remote dependency in any critical path — that is a property of the architecture, verified by the zero-network-deps check in the ARCH-04 gate, not by new testing here.

### 4.3 XSS / CSP / secrets

- CSP posture unchanged from phase-02 findings (`'unsafe-inline'` script-src, external font CDN) — still deferred behind the self-hosted-fonts trigger. No regression, no widening.
- No new `dangerouslySetInnerHTML`, no new `eval`, no new secrets in client bundles (grep + build-output check).
- Reader HTML still flows through the `luma-security` ammonia allowlist (guard re-confirmed present; not re-fuzzed this phase).

---

## 5. Defects Found and Fixed in This Phase

### DEF-01 — Fresh install cannot create its first collection (BLOCKER→FIXED)

- **Found**: live UI walkthrough against the real dev server.
- **Root cause**: `LibrarySidebar.renderSubItemsContent` gated the entire collections sub-section on `collections.length > 0`, which also hid the "New Collection" button. The only other entry to `CollectionModal` is the book-details drawer — which requires at least one book. On a fresh install, collections were unreachable.
- **Fix**: render the section whenever it is active, with an honest "No collections" empty state next to the action; sub-list and `renderSubItems` behavior with >0 collections unchanged.
- **Evidence**: live screenshot (empty state + action visible), 5 new component tests covering both branches and navigation semantics.

### DEF-02 — Modal focus falls to `<body>` on close (HIGH→FIXED)

- **Found**: same live walkthrough — after Escape-closing the collection dialog, `document.activeElement` was `<body>`.
- **Root cause**: modals moved focus in on open but never restored it on close.
- **Fix**: capture `document.activeElement` at open, restore on close, in `CollectionModal`, `DuplicateReviewModal`, `MetadataEditModal` (the same pattern in all three).
- **Evidence**: new regression test; all existing modal contract tests still green.

---

## 6. Gates (final state of this phase)

| Gate | Result |
|---|---|
| `pnpm -w typecheck` | ✅ 0 |
| `pnpm -w lint` | ✅ 0 warnings |
| `vitest run` (desktop) | ✅ **131 passed** (125 → 131: +5 sidebar, +1 focus-restore) |
| `cargo test --test architecture_boundaries` | ✅ 3 passed |
| `pnpm --filter @luma/desktop build` | ✅ production build |
| Stability probe | 5 consecutive green full-suite runs (stability work earlier this session) |

---

## 7. Remaining Risks (prioritized, with triggers)

1. **`luma-core` DeviceId per-operation stamping** (backend identity defect, found in the dynamic-data phase; frontend sends a real per-install id but the authoritative fix is server-side). Trigger: any sync/device-feature work. Status: UNCHANGED.
2. **Reader IPC races** — no cancellation/stale-response guard on chapter/page loads. Trigger: next reader-navigation change. UNCHANGED.
3. **Dialog focus containment** — Tab can move from the last control of a modal back into the page behind (measured live). The correct fix is one shared dialog primitive with a focus trap + inert background, not three bespoke traps. Trigger: the a11y pass / shared-Dialog item already in the deferred ledger. UNVERIFIED-by-design until then.
4. **Downgrade compatibility** (new app version ↔ older schema on disk) has no test or documented policy. Trigger: first release that ships a schema migration.
5. **Large-library performance** (cover/blob IPC throughput, 1,000-book profiling) — trigger unchanged from phase 02. UNPROVEN.
6. **Backup/restore has no UI-driven corruption detection**; restore exists and is tested at the command layer, but nothing in the app notices corruption proactively. Trigger: any durability-focused release gate.
7. **Reduced-motion, zoom/200%, and screen-reader flow validation** — not performed; semantic/automated coverage exists. Trigger: the formal a11y pass.
8. **CSP tightening + self-hosted fonts** — deferred with triggers (privacy/offline release gate).

---

## 8. Files Changed (this phase)

**Modified (6)**:
- `apps/desktop/src/features/library/LibrarySidebar.tsx` — DEF-01 fix
- `apps/desktop/src/features/library/CollectionModal.tsx` — DEF-02 fix
- `apps/desktop/src/features/library/DuplicateReviewModal.tsx` — DEF-02 fix
- `apps/desktop/src/features/library/MetadataEditModal.tsx` — DEF-02 fix
- `apps/desktop/src/features/library/__tests__/CollectionModal.dom.test.tsx` — +1 test
- `docs/audits/PHASE-03-VALIDATION-ARCH-CODEQUALITY-FRONTEND-UIUX.md` — this report

**Added (1)**:
- `apps/desktop/src/features/library/__tests__/LibrarySidebar.dom.test.tsx` — 5 tests

*(Two earlier turns in this session, already reported: the component-test tier + import-failure surfacing, +6 tests and the `error`/`subscribe` seams.)*

---

## 9. Classification Summary

- **VERIFIED / RUNTIME-VERIFIED**: failure delivery, no-fake-data guarantee, boundary fitness functions (by deliberate violation), keyboard-operable navigation, dialog name/description/Escape/initial-focus/focus-restore, empty & error states, partial-failure isolation, real paging/filtering behavior.
- **TESTED**: all of the above have automated regression coverage where reproducible in jsdom.
- **UNVERIFIED (documented, with triggers)**: focus containment, reduced motion, zoom, screen-reader flow, large-library performance, downgrade compatibility, corruption detection, CSP/font posture.
- **N/A (rejected as inapplicable)**: multi-region, multi-tenancy, queues/brokers, connection pooling, service decomposition, distributed sagas, optimistic-UI rollback (no optimistic UI exists), CSRF (no cookie auth, no cross-site surface).

**Final classification: PROVEN FOR STATED OPERATING CONDITIONS — PARTIAL on human-factor validation (§7.7), with every unproven claim labeled rather than assumed.**
