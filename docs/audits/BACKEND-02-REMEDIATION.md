# 🛠️ BACKEND-02 — Backend Remediation Report

**Date**: 2026-09-18
**Baseline**: `docs/audits/BACKEND-01-AUDIT.md` (findings BE-001 🔴, BE-002 🟠)
**Mode**: IMPLEMENTATION — only the highest-value, evidence-verified findings. No architecture changes.

---

## Backend Changes Implemented

### BE-001 🔴 → FIXED — Import is now atomic

**Verified defect**: `import_single_file` committed the staged file to the library directory *before* DB writes, and book → book_file → tags → FTS were four separate autocommit statements. A crash mid-sequence left a book without its file record (or vice versa), and a DB failure left an orphaned library file permanently.

**Fix** (`crates/luma-storage/src/services/import_service.rs`):
- All persistence (book, book_file, authors, series, tags, cover, FTS) now runs in **one writer transaction** via `with_write_conn` + `unchecked_transaction` on the existing writer connection.
- **File compensation**: if any DB step fails, the already-committed library file (and cover) is deleted before returning the error — no orphaned artifacts.
- Transaction stays short: no hashing/IO inside the transaction; staging and hashing complete first.
- FTS indexing extracted to a `&Connection` static fn so it participates in the same transaction (previously it opened its own connection).

**Supporting change** (`crates/luma-storage/src/repos/*`): added additive `*_with_conn(&Connection, …)` variants to `book_repo`, `book_file_repo`, `author_repo`, `series_repo`, `tag_repo`, `cover_repo`. Existing public methods delegate — no API break. This was required because repos lock the writer mutex and cannot be called inside a transaction on that same connection.

### BE-002 🟠 → FIXED — Stable device identity

**Verified defect**: eight command sites called `DeviceId::new()` per invocation, so `device_id` provenance was a per-call stamp, meaningless for sync semantics.

**Fix**:
- New `apps/desktop/src-tauri/src/device_identity.rs`: `load_or_create_device_id(data_dir)` resolves/persists one DeviceId per data directory at startup (`device_id` file), regenerating on corruption with a warning.
- `LumaAppContext` now carries a stable `device_id` resolved once at startup (`context.rs`).
- All 8 per-call sites (bookmark, collection ×2, import ×3, library, progress) replaced with `ctx.device_id`.

### BE-004 🟡 → PARTIAL — Structured logging at import error branches

- Failure paths in the import transaction emit `tracing::error!`/`warn!` with structured fields (book title, error) before compensation runs.

## Transaction / Consistency Changes
Single-writer transaction for the full import invariant (book ⇄ file ⇄ tags ⇄ FTS); rollback on any failure; compensating file/cover deletion on DB failure. SQLite autocommit hazards eliminated on this path.

## Concurrency Changes
None required — BE-001 keeps transactions short (no hashing/IO inside), so WAL writer contention is bounded.

## Testing

**New — `crates/luma-storage/tests/test_import_atomicity.rs`** (2 tests, passing):
1. `successful_import_persists_book_file_tags_and_fts_together` — full import persists book, file, tags, FTS in one step.
2. `import_failure_rolls_back_all_database_writes_and_removes_library_file` — deterministic partial-failure injection (soft-deleted tag re-created inside the tx triggers UNIQUE violation): asserts **zero** book/file/tag rows and **no orphaned library file** after failure.

**New — `device_identity` unit tests** (in `device_identity.rs`, passing):
1. `creates_then_reuses_device_id` — same id across calls, persisted.
2. `regenerates_on_corrupt_file` — corrupt file → fresh id, no panic.

## Files Changed
- `crates/luma-storage/src/services/import_service.rs` (transactional rewrite)
- `crates/luma-storage/src/repos/{book,book_file,author,series,tag,cover}_repo.rs` (additive `*_with_conn`)
- `apps/desktop/src-tauri/src/device_identity.rs` (new)
- `apps/desktop/src-tauri/src/context.rs` (stable device_id)
- `apps/desktop/src-tauri/src/main.rs` (mod registration)
- `apps/desktop/src-tauri/src/commands/{bookmark,collection,import,library,progress}.rs` (ctx.device_id)
- `crates/luma-storage/tests/test_import_atomicity.rs` (new)
- `eslint.config.mjs` + `apps/desktop/scripts/bridge-smoke.mjs` (lint-gate fix, see below)

## Lint Gate Fix (unrelated but blocking)
`pnpm lint` failed pre-existing: `.mjs` scripts had no Node globals and `bridge-smoke.mjs` referenced undefined `root`/`env` (previously shadowed because `no-undef` was only disabled for TS files). Fixed by adding a Node-globals ESLint block for `**/*.mjs` and correcting the script's `root`/`env` references. The bridge script was genuinely broken — lint now catches it.

## Validation Performed

| Gate | Result |
|---|---|
| `cargo fmt --check` | PASS (exit 0) |
| `cargo clippy --workspace --all-targets -- -D warnings` | PASS (no errors) |
| `cargo test --workspace` | PASS — 45 suites ok, 0 failures (includes new atomicity + device-id tests) |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS (all packages) |
| `pnpm test` | PASS — 131/131 |

## Security Regression Results
Reader commands still take ids only (no client paths). Import path unchanged for traversal guards. No secrets added; new logging emits titles/errors only. No new IPC surface. PASS by inspection + existing adversarial/sanitizer suites green.

## Remaining Risks
- BE-002's frontend-supplied device id (from the sync-device registration flow) is now only used by the sync layer; the backend identity is the persisted per-install file. If multi-device sync later requires cross-device identity federation, revisit.
- Compensation deletion is best-effort (logged if it fails); an orphaned file on double-failure (DB fail + delete fail) remains theoretically possible. Acceptable for single-user local app.

## Deferred Improvements
- Batch import path could share the same transaction shape per-file (each file is already individually atomic; cross-file batching is not an invariant today).

## Explicitly Rejected Complexity
- Outbox/Saga/event infrastructure — single-store local app, unjustified.
- Repository trait layer — `*_with_conn` variants preserve the direct-SQL approach.
- Distributed transaction concerns, retries/timeouts for external calls — no network dependencies in production services (verified in BACKEND-01).

## Verdict
BE-001 (data integrity under partial failure) and BE-002 (identity correctness) closed with regression tests locking both in. Backend now: **correct under partial failure on the import invariant, stable device identity, all gates green.**
