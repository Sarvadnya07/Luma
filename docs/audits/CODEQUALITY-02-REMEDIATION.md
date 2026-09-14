# 🧠 LUMA — CODEQUALITY-02: Refactoring & Maintainability Remediation Report

**Date**: 2026-09-14
**Phase**: CODEQUALITY-02 — implement highest-value, evidence-backed maintainability improvements from the CODEQUALITY-01 audit.
**Method**: Pain-driven, test-supported refactoring only. No rewrites, no speculative abstraction, no metric gaming.

---

## Code Quality Changes Implemented (summary)

Four findings from CODEQUALITY-01 remediated, prioritized by the audit's roadmap:

| Debt ID | Remediation | Net diff |
|---|---|---|
| CQ-04 (🔴 HIGH) | Backup serialization panics → typed error propagation | −118 lines |
| CQ-02 (🔴 DO NOW) | Silent localStorage fallbacks → loud, logged degradation | +6 lines |
| CQ-10 (🔵) | `no-explicit-any` re-enabled + 11 violations typed | ±11 lines |
| CQ-06 (🔵) | Test-fixture knowledge duplication (×3) → shared module | −240 net across suites, +178 shared |

Total: **73 insertions, 353 deletions** across 10 files + 1 new shared module — a net simplification.

## Refactoring Ledger

### R-01 — Backup write path: unwrap → typed errors (CQ-04)

```text
Refactor ID: R-01
Area: crates/luma-storage/src/services/backup_service.rs
Original Pain: 14 .unwrap()s on serde_json serialization + zip writes inside create_backup;
a serialization or disk failure aborted the process instead of surfacing LumaError to the
user-facing backup command.
Evidence: audit smell count (14), verified by grep; create_backup is the only user backup path.
Behavior Characterized: 20 existing tests across test_backend_services, test_backup_knowledge_state,
test_runtime_acceptance_matrix cover create/inspect/restore round-trips — unchanged after refactor.
Refactoring: Extract Method — write_json(zip, options, name, &value) helper that serializes,
starts the archive entry, and writes, mapping every failure to LumaError::StorageError with the
entry name in the message. All 14 call sites became single-line calls (also removing the
start_file/write_all/map_err triplication — knowledge duplication collapsed with the panic fix).
Why This Structure: one helper owning "write one JSON entry" is a stable concept with 14 real
uses; error context names the failing entry for diagnosis.
Alternative Considered: point-fixing each unwrap with map_err (same diff size, keeps triplication).
Risk: LOW — behavior-preserving; same payload bytes; same entry names.
Tests Before/After: 20 passing / 20 passing.
Complexity Before/After: 14 inline blocks with 3 error-handling sites each → 1 helper + 14 one-liners.
Coupling: unchanged (same crate-internal helper).
Performance Impact: none (identical operations).
Decision: KEEP.
```

### R-02 — Loud localStorage fallbacks (CQ-02)

```text
Refactor ID: R-02
Area: apps/desktop/src/lib/tauri.ts (getSetting, setSetting, listNotes)
Original Pain: silent `catch { // ignore }` around fallback persistence; corrupt notes store or a
quota failure degraded to empty/in-memory data with zero signal — violating the "own your data"
contract invisibly.
Evidence: audit finding CQ-02; 3 silent catch sites verified.
Behavior Characterized: 41 frontend Vitest tests exercise the mock/fallback transport — all green
after the change (behavior preserved; only logging added).
Refactoring: Replace silent catches with logger.warn messages that state what failed and what the
degraded behavior is. No persistence semantics changed (full SQLite routing is a larger feature
and remains deferred — see Remaining Debt).
Risk: LOW — additive logging only.
Tests Before/After: 41/41.
Decision: KEEP. Full IPC→SQLite routing for notes/settings DEFERRED (medium-size feature; the
loud-failure prerequisite is now in place).
```

### R-03 — Re-enable `no-explicit-any` + type the 11 violations (CQ-10)

```text
Refactor ID: R-03
Area: eslint.config.mjs + SyncDeviceCenter.tsx, DuplicateReviewModal.tsx, LibraryView.tsx,
PdfReaderView.tsx
Original Pain: rule disabled while the codebase mostly complied — the guard was off when it would
have cost nothing; `any` hid real domain shapes (PDF search results, author fallbacks, label bags).
Evidence: enabling the rule surfaced exactly 11 errors (verified by lint run).
Refactoring:
- metadata?: Record<string, unknown>
- DuplicateReviewModal author fallback: named structural type { authors?: ...; author?: unknown }
- LibraryView label bags → Record<string, unknown>; injected component props keep ComponentType<any>
  with justified inline eslint-disable (generic passthrough is the real contract)
- PdfReaderView search results → DocumentSearchMatch from @luma/shared-types (replacing any[] —
  the correct domain type already existed)
Why: type safety clarifies contracts; zero behavior change.
Risk: LOW-MEDIUM — type-level only; typecheck proves equivalence.
Tests Before/After: 41/41 Vitest, typecheck clean.
Decision: KEEP. The three remaining ComponentType<any> uses are justified inline (ISP: the
injection point genuinely accepts any props shape).
```

### R-04 — Shared test-fixture module (CQ-06)

```text
Refactor ID: R-04
Area: crates/luma-storage/tests/common/mod.rs (NEW) + 3 perf test files
Original Pain: book-INSERT schema knowledge, EPUB generation, and synthetic-PDF generation were
duplicated in test_perf_large_scale, test_perf_real_user_paths, test_perf_validation — a schema
change would break 3 files independently.
Evidence: audit finding CQ-06; verified duplicated INSERT SQL ×3.
Refactoring: Extract Module — tests/common/mod.rs with seed_books(), insert_book(tx, &book),
create_epub(path, title, author, chapters), synthetic_pdf_bytes(pages). Each test binary compiles
the module (dead_code allowed — binaries only use what they need).
Why This Abstraction: this is genuine knowledge duplication (same schema, same fixture semantics),
not incidental textual similarity — the contract's deduplicate test passes.
Risk: MEDIUM-LOW — fixture semantics must be identical. One real bug was caught and fixed during
migration: the consolidated create_epub initially dropped the OPF <spine> from the written package
(caught immediately by test_perf_real_user_paths asserting 12 pages/spines; fixed and now the
fixture is verified by an end-to-end import test, which the three pre-copy versions never were).
Alternative Considered: leaving duplication (accepted by CQ-01 as CONTAIN) — rejected here because
the fixtures were being modified this phase anyway and the shared version now carries an e2e proof.
Tests Before/After: all suites green (workspace 0 failures).
Decision: KEEP.
```

## Function / Method Changes

- `backup_service.rs`: new private `write_json()` helper; `create_backup` body reduced from ~120 lines of repeated blocks to 14 one-line calls.
- `tauri.ts`: no signature changes; logging added inside three fallback paths.
- `test_perf_*`: local fixture fns replaced by `common::` imports.

## Cohesion / Coupling

- `write_json` gives the backup writer one coherent responsibility per unit (schema per entry unchanged).
- Frontend coupling unchanged (R-02/R-03 are local).
- Test coupling improved: schema knowledge now has one owner (`common::insert_book`).

## Duplication Decisions

- **Deduplicated**: books INSERT SQL (×3→×1), EPUB generator (×2→×1), synthetic PDF (×2→×1).
- **Preserved**: document-engine structural similarity (wrong abstraction), the three `ComponentType<any>` injection points (justified), the two persistence backends in `tauri.ts` (full unification deferred).

## Error Handling

- Backup path: serialization/IO failures now surface as `LumaError::StorageError("Failed to serialize/write archive entry {name}")` — actionable context, no panics.
- Frontend: silent `catch { // ignore }` → `logger.warn` with the degraded behavior stated.

## Type Safety

- 11 `any` removed; PDF search results now typed as `DocumentSearchMatch` (existing domain type); one structural type introduced for the author-fallback union.

## Static Analysis

- `@typescript-eslint/no-explicit-any` promoted from `off` to `error`; lint passes with 3 justified inline disables on the DI passthrough props.

## Architecture Boundary Enforcement

- Not implemented this phase (CQ-08 remains PLAN): layering is currently clean and the enforcement test is valuable but non-urgent; scheduled next.

## Tests Added / Updated

- No new test files; existing 20 backup tests + 41 frontend tests + full workspace suite act as characterization for R-01/R-02; the e2e import test now also validates the shared EPUB fixture (R-04).

## Validation Performed

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✅ 7/7 |
| `pnpm lint` (with `no-explicit-any: error`) | ✅ 0 errors |
| `pnpm test` (Vitest) | ✅ 41/41 |
| `cargo test --workspace` | ✅ 0 failures |
| `cargo clippy --workspace -- -D warnings` | ✅ clean |
| Backup characterization (create/inspect/restore round-trips) | ✅ 20/20 |

## Files Changed

- `crates/luma-storage/src/services/backup_service.rs` — R-01 (product code, error-path only)
- `apps/desktop/src/lib/tauri.ts` — R-02
- `apps/desktop/src/features/devices/SyncDeviceCenter.tsx`, `features/library/DuplicateReviewModal.tsx`, `features/library/LibraryView.tsx`, `features/reader/PdfReaderView.tsx` — R-03
- `eslint.config.mjs` — R-03
- `crates/luma-storage/tests/common/mod.rs` (NEW), `tests/test_perf_large_scale.rs`, `tests/test_perf_real_user_paths.rs`, `tests/test_perf_validation.rs` — R-04
- `docs/audits/CODEQUALITY-02-REMEDIATION.md` — this report

## Remaining Debt (unchanged or deferred)

- **CQ-01** `tauri.ts` god-module split — deferred: large, mechanical, deserves its own staged pass behind the existing transport seam.
- **CQ-02 full fix** (notes/settings → SQLite IPC) — deferred: feature-sized; loud failure now in place as the prerequisite.
- **CQ-03** `LibraryView.tsx` decomposition — deferred.
- **CQ-07** typed reader event bus — deferred.
- **CQ-08** architecture-boundary enforcement — deferred (next).
- **CQ-05** `luma-sync`/`luma-ai` frozen shells — unchanged (ACCEPT).

## Explicitly Rejected Changes

- Splitting the six document engines (incidental similarity — wrong abstraction).
- Replacing `ComponentType<any>` injection points with generics (would complicate the DI seam for no safety gain).
- Deduplicating the `ReflowableDocument`/`PdfDocument`/`CanonicalDocument` session caches in `reader_service.rs` (hot correctness-critical path; the audit deferred it and the same decision stands).
- Any interface/DI-container introduction (no second implementation exists anywhere it was considered).
