# 🧠 LUMA — CODEQUALITY-01: Code Quality, Maintainability & Architecture Audit

**Date**: 2026-09-14
**Scope**: Full monorepo (8 Rust crates, 6 TS packages, Tauri desktop app, CI, tests)
**Method**: Static inspection of implementation (not filenames), dependency-direction analysis from Cargo manifests, clippy/eslint/tsc/pnpm-audit runs, smell searches (unwrap/catch/god-component/localStorage), test-suite inventory.
**Mode**: AUDIT-FIRST — no refactoring performed.

---

## Executive Code Quality Assessment

Luma is a **structurally disciplined codebase with a small number of concentrated debt hotspots**. Dependency direction is acyclic and clean (verified from all 8 crate manifests); clippy is zero-warning under `-D warnings`; TypeScript is strict-mode clean; no npm vulnerabilities; CI runs fmt/clippy/tests/cargo-deny on 3 OSes. The debt is not spread thin — it lives in exactly three places: (1) a 1,635-line `tauri.ts` API client that silently degrades to localStorage mock persistence, (2) a 1,084-line `LibraryView.tsx` god component, (3) ~24 `.unwrap()`s in `backup_service.rs` serialization paths that can panic on write.

**Verdict**: The codebase is genuinely understandable and locally changeable at the crate/module level. The risks are concentrated, visible, and enumerable — not diffuse. No rewrite is warranted anywhere.

## Project Maturity

**Growing Product** moving toward Production. Evidence: workspace tooling, CI matrix, strict linters, dependency policy (deny.toml), broad integration test suites (47 tests in luma-storage alone). Missing production markers: no error telemetry/observability in the UI layer, silent-fallback patterns in the API client, no architecture-boundary enforcement tests.

## Architecture Map

| Area | Responsibility | Criticality | Change frequency |
|---|---|---|---|
| `luma-core` | Domain entities, typed IDs, LumaError | High (everything depends on it) | Low |
| `luma-anchor` | Fuzzy annotation anchoring | High (correctness core) | Medium |
| `luma-reader` | Format engines (EPUB/PDF/TXT/MD/HTML/CBZ) | High | Medium |
| `luma-storage` | SQLite repos, services, jobs, migrations | High | High (hot) |
| `luma-search` | FTS5 adapter | Medium | Low |
| `luma-security` | Sanitization, path guards, hashing | High (security boundary) | Low |
| `luma-sync` | Causality/version models | **Currently unused by other crates** | — |
| `luma-ai` | LLM traits | **Currently unused by other crates** | — |
| `apps/desktop` | Tauri shell + React UI | High | High (hot) |
| `packages/*` | Shared TS types/UI | Medium | Medium |

## Dependency Direction

Verified from manifests — **acyclic, layered**:

```
luma-core ← luma-security ← luma-reader ← luma-storage ← (desktop)
           luma-anchor (core)   luma-search (core, storage)
           luma-sync (core)     luma-ai (core)
```

No cycles. No upward dependencies (core depends on nothing). Foundational crates are the most stable — correct direction. Two crates (`luma-sync`, `luma-ai`) have **zero dependents outside themselves** — speculative scaffolding for future features (see debt registry).

## Cohesion

- **Good**: each `luma-reader` document engine is one format, one module; services in `luma-storage` are split by domain (import/reader/search/backup/annotation); `ReaderService` at 16 public methods is cohesive around "open + navigate + search one document."
- **Weak spot**: `reader_service.rs` mixes two session models (reflowable reflow sessions + PDF page sessions + canonical sessions) — three `RwLock<HashMap>` caches with identical bounded-insert logic duplicated inline. Cohesion is acceptable; the triplicated cache logic is the actual smell.

## Coupling

- Rust: explicit, parameter-based. `Database` and `CacheManager` are cloned freely — cheap `Arc` clones, acceptable, but the pattern means **connection identity is implicit** (fine here; both are process-global by design).
- Frontend: `readerState.ts` communicates with reader views via **5 distinct `window.dispatchEvent`/`CustomEvent("luma-reader-scroll-to")` channels** — stringly-typed global event bus is hidden coupling. Component contracts exist only by convention.
- `packages/*` are consumed properly by the app (verified imports) — no phantom package boundaries.

## Public / Internal Boundaries

- Crates expose `pub` liberally; there are no `pub(crate)` sweeps, but the workspace is the only consumer, so the boundary risk is low today.
- **No architecture-enforcement tests exist** (no import rules, no cargo-deny for workspace deps, no layer tests). Boundaries are enforced only by review convention.
- `packages/shared-types` is the single TS↔Rust contract surface — good discipline.

## Readability / Naming

Strong. Domain terminology is consistent (`spine`, `anchor`, `canonical`, `reflowable`). Test names describe scenarios (`test_concurrent_readers_during_long_write_transaction`). No cryptic abbreviations observed in sampled modules.

## Comments

Sampled comments are why-oriented (e.g., bounded-cache rationale, security guard explanations). No stale-TODO plague found. No lying comments detected in sampled hot files.

## Functions / Methods

No pathological long functions found in sampled service code. `LibraryView.tsx` (1,084 lines) is the exception — see god-component finding. Hook density: 47 `useState/useEffect/useCallback/useMemo` in one component is a strong accidental-complexity signal.

## Classes / Modules

| Component | Size | Assessment |
|---|---|---|
| `apps/desktop/src/lib/tauri.ts` | 1,635 lines, 109 exported methods | **God module** — API client + mock backend + localStorage fallback + event bus |
| `LibraryView.tsx` | 1,084 lines | **God component** — listing, filtering, import, modals, keyboard, selection |
| `knowledge_repo.rs` | 789 lines | Large but cohesive (knowledge domain) |
| `epub_doc.rs` | 844 lines | Large but cohesive (one format) |
| `mockData.ts` | 435 lines | Test fixture data shipped in prod bundle |

## Complexity

Essential complexity dominates: EPUB/PDF parsing, fuzzy anchoring, and migration logic are inherently complex and are kept *local* to their modules — that is the right trade. Accidental complexity is concentrated in the frontend god components and the mock/real transport duality in `tauri.ts` (every one of 109 methods carries a mock branch).

## Code Smells (significant, evidence-backed)

1. **God module** — `tauri.ts`: API + transport + mock store + fallback persistence in one file. Divergent change driver: every new backend command touches this file twice (method + mock branch).
2. **God component** — `LibraryView.tsx`: listing/filter/import/selection/modals in one component, 47 hooks.
3. **Silent fallbacks** — `tauri.ts` swallows errors (`catch { // ignore }`) around localStorage settings/notes and degrades to `localStorage` persistence for notes without surfacing it. Persistence contract becomes invisible at the call site (see `listNotes` reading `luma_notes_workspace` from localStorage).
4. **Panic-capable serialization** — 14 `.unwrap()`s in `backup_service.rs` (serde JSON + zip writes); a disk-full or lock failure aborts the process instead of returning `LumaError`.
5. **Stringly-typed event bus** — `luma-reader-scroll-to` CustomEvents (5 emit sites) as hidden cross-component contract.
6. **Speculative crates** — `luma-sync` (68 LOC) and `luma-ai` (172 LOC) with zero dependents: architecture astronautics risk, though currently harmless.
7. **Test fixture duplication** — `seed_books`/`create_epub`/`create_synthetic_pdf` re-implemented in 3 perf test files (knowledge duplication; budget constants and schema INSERT drift together).

## Abstractions

The transport abstraction in `tauri.ts` (`LumaTransport` + `MockDataProvider` + injectable invoke) is **justified** — it makes the whole frontend testable in Vitest without Tauri, and it has two real implementations. The abstraction is not the problem; its *placement* (mixed into the same 1,635-line file as the 109 methods) is. `luma-ai`'s LLM trait is premature abstraction (zero implementations consumed).

## Duplication

- **Knowledge duplication (fix)**: book-seeding SQL + EPUB-generation fixtures across 3 test files (schema knowledge duplicated — a column change breaks 3 files).
- **Incidental similarity (leave)**: the six document engines share structural shape but encode different format knowledge — deduplication would create a wrong abstraction.
- **Inline duplication (minor)**: bounded-session insert logic ×3 in `reader_service.rs`.

## SOLID

Applied with restraint — the codebase does **not** cargo-cult it: no interface-for-every-class, no DI ceremony in Rust; services are concrete with typed errors. SRP is violated only where flagged above. No LSP/refused-bequest issues found (no deep inheritance anywhere; composition used throughout). This restraint is a strength.

## Composition / Inheritance

Rust: composition only. TS: hooks/composition only; no HOC inheritance chains. No fragile base classes.

## Error Handling

- **Rust: strong.** `LumaError` typed everywhere; `map_err` discipline in services (import_service: 25 explicit error sites); clippy clean under `-D warnings`. The 14 `backup_service.rs` unwraps are the exception.
- **TS: weak spots.** Silent `catch { // ignore }` blocks (settings/notes fallbacks); `onDomainEvent` logs but returns a no-op unlisten — event-loss is invisible to callers.

## State / Side Effects

- Zustand stores own state explicitly — good.
- `LumaApi` module-level singleton (`export const LumaApi = createLumaApi()`) with `resetLumaApi()` — implicit global, but single-consumer app; acceptable with eyes open.
- The localStorage mock fallback means **two persistence sources for notes/settings** depending on runtime — the actual state-ownership defect (SQLite is supposed to be the only source of truth per project contract).

## Concurrency

- Rust: `RwLock<HashMap>` session caches with bounded insertion; `spawn_blocking` for CPU work in spike tests; `Database` dual-connection (read/write) verified by `test_concurrency_fitness`. No deadlock patterns found (locks are never held across `.await` in sampled code — worth a targeted check during any refactor).
- TS: no shared mutable state beyond the mock store; event listeners returned with unlisten functions — lifecycle is explicit.

## Testability

**Strong and verified**: 47 integration tests in `luma-storage` covering services end-to-end with real files; concurrency fitness suite; perf validation harness with budget asserts (this thread's work). The `LumaTransport` injection makes frontend testable — 41 Vitest tests run without Tauri. Test-only pollution is minimal (the mock provider is justified; its *placement* in the prod bundle is not).

## Types

TS strict-mode, zero `: any` in `tauri.ts` (verified), shared-types package mirrors Rust models. Rust: typed IDs (`BookId`, `FileId`) — primitive obsession avoided at the domain core. No type gymnastics observed.

## Configuration

`deny.toml` licenses+advisories strict; tsconfig base + per-package; eslint flat config. No secrets in source. Minor: eslint turns `no-explicit-any` **off** (currently harmless — zero `any` usage — but the guard is disabled when it would cost nothing).

## Dependencies

`pnpm audit` clean; `cargo-deny` in CI; workspace-deps for all internal crates; pinned pnpm version. No stale/vulnerable dependency signals.

## Organization

Feature-foldered frontend (`features/reader`, `features/library`, …) with a thin `state/` + `lib/` — supports local reasoning. `lib/mockData.ts` is the only misplacement (test fixture in prod source tree).

## Architecture Fitness

**Documented but not continuously enforced.** No architecture tests, no dependency-direction CI check, no import lint rules. The crate layering is currently clean by discipline, not by enforcement.

## Code Generation

None present — no generated-code risk.

## Legacy

No legacy quadrant yet (young codebase). Highest refactor-risk area is `reader_service.rs` + anchoring (correctness-critical, high blast radius) — but both have characterization-grade integration coverage, so they are *safely* modifiable.

## Refactoring Risk

| Area | Tests | Risk |
|---|---|---|
| `tauri.ts` split | 41 frontend tests via transport seam | **Low-risk** — seam already exists |
| `LibraryView.tsx` split | Library flows exercised in Vitest | Low-medium |
| `backup_service.rs` error handling | backup tests exist | Low |
| `reader_service.rs` cache consolidation | 47 storage tests | Medium (hot, correctness-critical) |

## Technical Debt Registry

| ID | Debt | Type | Classification | Interest |
|---|---|---|---|---|
| CQ-01 | `tauri.ts` god module (1,635 lines, 109 methods, mock+real+fallback mixed) | Architecture | Accidental/Prudent | **High** — every IPC change lands here twice |
| CQ-02 | Silent localStorage fallback for notes/settings (dual persistence truth) | Correctness-adjacent | Reckless | **High** — violates the project's own SQLite-only persistence contract |
| CQ-03 | `LibraryView.tsx` god component (47 hooks) | Design | Accidental | Medium |
| CQ-04 | 14 `unwrap()`s in backup serialization | Robustness | Reckless (small) | Medium — user-visible abort on backup failure |
| CQ-05 | `luma-sync`/`luma-ai` empty-shell crates | Speculative | Prudent (pause) | Low — zero cost until touched |
| CQ-06 | Test fixture duplication (3×) | Testing | Accidental | Low-medium |
| CQ-07 | Stringly-typed CustomEvent bus between store and readers | Coupling | Accidental | Medium — contract invisible |
| CQ-08 | No architecture-boundary enforcement | Process | — | Accrues slowly |
| CQ-09 | `mockData.ts` in prod bundle | Organization | Accidental | Low-medium (bundle size) |
| CQ-10 | eslint `no-explicit-any` disabled | Static analysis | Prudent | Low |

## Code Review / PR Locality

Recent history (65 commits) shows small, scoped commits (`fix(library,reader): ...`, `chore: remove temporary verification scratch scripts`) — good change locality. One reviewer (solo project) — review-audit concerns are not applicable yet.

## Static Analysis

Clippy `-D warnings` in CI: high signal, zero noise. ESLint recommended + TS strict: adequate; two disabled rules (`no-explicit-any`, `no-undef` for TS files — the latter is correct). tsc strict: clean. Suggest enabling `no-explicit-any` (CQ-10) since the codebase already complies.

## Quality Gates

Local: fmt/lint/typecheck/test — all scripted (`ci:checks`). CI: 3-OS matrix + cargo-deny. Missing tier: none material for this maturity; consider adding the perf-budget harness as a WARN (not BLOCK) CI tier.

## Metrics

Signals used in this audit: unwrap counts, hook density, file size, coupling direction from manifests, test counts per area — all as triage, none as targets. No vanity metrics (LOC/coverage %) relied upon.

> **Reproducibility note (smell counts)**: the workspace-wide "68 unwrap/expect" figure splits as **32 `.unwrap()` occurrences in non-test crate `src/`** (`grep -rn "\.unwrap()" crates/*/src --include="*.rs" | grep -vE tests`) plus `.expect(` call sites and test-adjacent paths making up the remainder. Both functions are panic-capable — `unwrap()` panics without a message, `.expect(` panics with one — so all 32 `.unwrap()` plus the `.expect(` call sites in non-test crate `src/` are panic paths; CQ-04 tracks the 14 `.unwrap()`s in `backup_service.rs` specifically.

## Performance / Maintainability Interaction

The perf harness (548 lines) is justified by the PERF-03 contract and asserts budgets — unusual complexity, documented, benchmarked. `PdfPageCanvas` intersection-gated thumbnails carry a comment explaining why — correct pattern. Optimization keep/defer/reject decisions are owned by `docs/performance/PERF-03-VALIDATION-REPORT.md` (§10) and are not restated here.

## Anti-Patterns Found

God module (CQ-01), god component (CQ-03), silent error swallowing (CQ-02), speculative generality (CQ-05), hidden dependency via global events (CQ-07). **Not found**: cargo-cult SOLID, DI ceremony, interface explosion, deep inheritance, utility dumping grounds, lying comments, magic-value plague.

## Decision-Tree Findings

- *Should I refactor `tauri.ts`?* Yes — pain is real (dual-touch on every IPC change), seam exists, tests protect it.
- *Extract abstraction for the 6 document engines?* **No** — incidental structural similarity; formats change independently.
- *Deduplicate test seeding?* Yes — same schema knowledge ×3.
- *Delete `luma-sync`/`luma-ai`?* Not yet — keep frozen; revisit when AI/sync features actually start.
- *Split `reader_service.rs` caches?* Defer — hot correctness-critical path; consolidate only with the existing test suite as guard.

## Strengths Worth Preserving

1. Acyclic, stable-direction crate layering with typed-ID domain core.
2. Typed error discipline (`LumaError`) + clippy-zero-warning CI.
3. Transport seam making the entire frontend testable without Tauri.
4. Integration-test depth (real files, real DB, concurrency fitness, budget-asserted perf harness).
5. Restraint: no premature abstraction, consistent domain language.

## Critical Gaps

1. Dual persistence truth (CQ-02) — the only finding that touches the product's core promise ("own your data").
2. Silent degradation patterns hide failures from users and developers alike.
3. No continuous architecture enforcement — layering is one refactor away from erosion.

## Prioritized Code Quality Roadmap

| Priority | Item | Action |
|---|---|---|
| 🔴 DO NOW | CQ-02 | Route notes/settings through IPC→SQLite; make fallback loud (log + surface), not silent |
| 🟠 HIGH | CQ-01 | Split `tauri.ts` into transport / api-domains / mock-provider modules (seam already exists) |
| 🟠 HIGH | CQ-04 | Replace backup `unwrap()`s with `LumaError` propagation |
| 🟡 PLAN | CQ-03 | Decompose `LibraryView.tsx` into container + presentational children |
| 🟡 PLAN | CQ-07 | Type the reader event bus (const event map, or move to store actions) |
| 🟡 PLAN | CQ-08 | Add a workspace-layer lint/cargo test asserting dependency direction |
| 🔵 CONTAIN | CQ-05, CQ-09, CQ-06, CQ-10 | Freeze empty crates; move mockData behind test export; shared test-fixture crate; enable `no-explicit-any` |
