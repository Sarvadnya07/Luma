# ADR-0025: Frontend Failure Handling, Theme Ownership, and Render Delivery

**Status**: Accepted
**Date**: 2026-09-17
**Supersedes**: none
**Related**: ADR-0004 (Frontend Framework), ADR-0019 (TypeScript-First Frontend), ADR-0024 (Modular Application Boundaries), `docs/audits/FORENSIC-AUDIT-FRONTEND-CODEQUALITY-ARCH-01.md`

---

## Context

A forensic frontend/code-quality/architecture audit (ARCH-01/FRONTEND-01/CODEQUALITY-01 follow-up, 2026-09-17) found that Luma's Rust core is rigorous while the React tier was missing three structural properties, all of which are cheap now and expensive later:

1. **No failure representation.** There was no error boundary anywhere, no `window.onerror`/`unhandledrejection` capture, no error telemetry, and no release source maps. A failed chapter or page load was a `console.error` into a blank viewport; an uncaught render error unmounted the tree into a permanently blank window with no signal.
2. **Ambiguous ownership of the chrome theme.** Four writers touched one preference (`App` state, the reader store, direct `documentElement` class toggles, direct `localStorage` writes) and three token systems described the same colours (`packages/design-system` `LUMA_THEMES`, CSS custom properties in `styles/index.css`, `packages/reader-ui` `READER_THEME_STYLES`) plus 135 inline hex literals.
3. **One eager bundle for every feature.** No route/engine-level code splitting: a single 948 kB chunk (266 kB gzip) contained all reader engines (including pdf.js), six non-library screens, and the mock data module — paid by every user before they opened a book.

Two smaller correctness problems fell out of the same work: the library's pagination was decorative (a `currentPage` nothing sliced, a pager hardcoded to `1,2,3,…,12`, and an unconditional "Showing 1-N of N" label), and the test suite wrote a timestamped artifact into the git-tracked `docs/performance/runtime/` directory on every run.

## Problem

Which fixes are justified now, at this maturity and this team size, without importing ceremony the product does not need?

Explicitly *not* on the table, because the audit found no requirement for them: SSR/SSG/RSC, a meta-framework, a client server-state cache, a new state library, a design-system rebuild, i18n infrastructure, virtualization before profiling, and any rewrite.

## Decision

Adopt five decisions, each reversible in isolation:

1. **A frontend failure tier exists and reports.** One dependency-free `ErrorBoundary` (root + per-view instances with retry / return-to-library / reload), one error sink (`lib/errorReporting.ts`) shared by the boundary and `window` handlers, and release source maps enabled so a report is symbolicable. Failure states are distinguishable from "still loading": the reader store carries an explicit `loadError` with a retry, separate from `loading` and from transient `statusMessage`.
2. **One owner per state value.** The application chrome theme is owned by `App` + `lib/theme.ts` (read/apply/persist/toggle in exactly one module); the reader store no longer writes the document class or `localStorage`. The reader's *paper* theme stays separate, because it selects the reading surface (dark/light/sepia/paper/eink) and the e-ink engine — it is a reading setting, not chrome theming.
3. **Delivery is split by feature, and the landing surface stays eager.** `App` lazily loads the two top-level views; the library view lazily loads the eight non-library screens and the two modals; reader engines are only reachable through the lazily loaded reader. `pdfjs-dist` and the React vendor split into their own chunks.
4. **The UI may not state facts the domain does not have.** Pagination is real arithmetic (one page rendered, true totals, page clamped and reset on filter change). The list view no longer fabricates a "35%" progress or guesses a file format by substring-matching an id; it shows the real `reading_status` and omits what is unknown.
5. **Tests are hermetic and boundaries are enforceable.** The telemetry harness writes to a temp directory unless `LUMA_TELEMETRY_OUT` explicitly opts in, so `pnpm test` leaves the tree clean and the committed performance evidence is not overwritten by whoever ran the suite. A narrow ESLint rule prevents feature code from importing the reader-store singleton, keeping the DI seam real.

## Alternatives Considered

| Alternative | Why rejected |
|---|---|
| Add `@testing-library/react` + jsdom environment in this phase | Valuable (the missing component tier is a real gap) but it is a new dependency and a suite-wide change; the pure logic added here is covered in the existing node environment, and the tier is tracked as the next step rather than smuggled into a structural change. |
| Keep the eager bundle and rely on OS-level caching | The audit measured a single 948 kB chunk; desktop startup is the metric a reader is judged on, and splitting required no new dependency. |
| Put the whole app under one root error boundary only | Loses the shell on a section failure. Two levels cost ~30 lines and keep the sidebar and recovery affordances alive. |
| Move the chrome theme into SQLite settings via IPC | Consistent with the "SQLite owns durable knowledge" rule, but the project's own source-of-truth contract names theme as the single sanctioned `localStorage` exception; changing the persistence mechanism was not needed to fix the *ownership* defect. Revisit if theme ever becomes a synced preference. |
| Rewrite `lib/tauri.ts` (1,636 lines, 109 methods) in this phase | Real debt (CQ-01) but a large, riskier refactor than the reliability/ownership work; it has a tested seam and is scheduled separately with the ledger entry kept open. |
| Replace the `Pagination` component's API | Its `{currentPage, totalPages, onPageChange}` shape was already correct — the implementation was lying, not the interface. Keeping the API avoided touching every future consumer. |
| Introduce a state machine for the import flow | Representable-impossible states exist there, but the flow was not the pain point in this phase; recorded as a candidate, not adopted. |

## Consequences

**Positive**

- A render crash is recoverable and reported, instead of a blank window with no signal.
- Reader load failures are visible and retryable; "empty" can no longer be mistaken for "loading".
- The initial JS payload for the library surface dropped from **948.5 kB minified / 266.6 kB gzip in one chunk** to **318 kB minified / 94.5 kB gzip** across three chunks, with pdf.js (435 kB) deferred until a PDF is actually opened.
- Theme has one writer, one documented storage key, and a regression test that fails if a second writer reappears.
- The library's pager and count label are true by construction, and paging arithmetic is unit-tested rather than re-derived inline.
- `pnpm test` no longer dirties the working tree nor overwrites the committed performance evidence.
- Source maps exist, so the new error telemetry is actually usable.

**Negative / accepted costs**

- One extra module-resolution hop before the library paints (the library chunk is fetched after the shell). Accepted: local assets, negligible latency, and the alternative is shipping pdf.js to everyone.
- Two additional small modules (`lib/theme.ts`, `lib/errorReporting.ts`) and a components directory. Accepted: each replaces duplicated or missing behaviour rather than adding indirection.
- The error boundary UI is intentionally unstyled-by-design-system (inline styles with token fallbacks) so it can render when the design system itself is the thing that broke; it is therefore not visually identical to the rest of the app.
- `manualChunks` is a manual policy that must be revisited if the dependency graph changes materially.

**Still open, deliberately**

- The Google Fonts CDN (`index.html`) is still external: it is blocked by the app's own CSP in a packaged build, and it makes a third-party request in an offline-first product. Self-hosting is the fix; it requires font files and a decision, so it is deferred with an explicit recommendation. Live evidence recorded in the audit report.
- CSP tightening (`script-src 'self'` instead of inline, `img-src` without `https:`) is a security decision with a real behaviour change for documents that reference remote images — deferred, with the recommended policy written down.
- `lib/tauri.ts` decomposition, `LibraryView` decomposition, accessibility of the six modal surfaces, token consolidation (135 inline hex literals), and the component-test tier remain open with ledger entries.

## Compliance

- Rust layering enforcement is unchanged and still passes (`cargo test --test architecture_boundaries`).
- No new runtime dependency was introduced.
- `pnpm -w typecheck`, `pnpm -w lint`, and the frontend suite (76 tests, up from 53) pass; the production build succeeds.
