# BACKEND-01 — Backend Engineering Forensic Audit

**Date**: 2026-09-18
**Scope**: `apps/desktop/src-tauri` (transport) + `crates/` (luma-core, luma-storage, luma-search, luma-security)
**Method**: source inspection + prior runtime probes from this session (real imports against the Rust layer, bridge failure-path exercise)

---

## Executive Backend Assessment

This is a **single-user, local-first desktop backend** (Tauri IPC → Rust services → SQLite/WAL). Judged against that requirement profile — not against a multi-tenant server — the architecture is **correct in style and mostly correct in detail**. The layering is real (thin commands → services → repos → SQLite), the error contract is typed, observability is wired at the command boundary, and there is an unusually strong test posture (reliability, concurrency-fitness, perf, adversarial-canonical, sanitizer, runtime-acceptance suites).

Two correctness findings are material, both **data-integrity under partial failure**:

1. **🔴 Import is not transactional end-to-end.** The staged file is committed to the library directory *before* the DB writes, and the DB writes (book → book_file → tags → FTS) are **independent autocommit statements** — no wrapping transaction exists anywhere in `import_service.rs` (verified: no `transaction`/`with_tx` in the file or `book_repo.insert`).
2. **🟠 `device_id` is a per-call stamp, not a device identity.** Eight command sites call `DeviceId::new()` at invocation time (`commands/bookmark.rs:64`, `collection.rs:64,140`, `import.rs:117,153,178`, `library.rs:233`, `progress.rs:80`). The frontend now sends a real per-install id; the backend ignores it. Sync/provenance semantics built on `device_id` are currently meaningless.

Everything else is either sound, a documented low-priority gap, or complexity that is correctly *absent*.

---

## Architecture Style

**Modular monolith in a single process.** Crates: `luma-core` (domain models, errors, ids) ← `luma-storage` (repos, services, migrations, jobs, cache, events) ← `luma-search` (FTS5) ← `src-tauri` (transport). Dependency direction is enforced by `architecture_boundaries.rs` (attack-proven in phase 03). This is the *right* style: no network, no multi-team extraction pressure, strong consistency available for free. **No change recommended.** Microservices/CQRS/event-sourcing/2PC: ❌ NOT JUSTIFIED.

## Boundaries / Ownership

- Data ownership: SQLite is the single source of truth; files under a managed library dir; FTS is a derived index (rebuildable). Ownership is clean.
- The frontend `LumaTransport` → IPC contract is explicit; the browser bridge is a separate unbundled, env-fixture-gated test binary (`LUMA_BROWSER_EPUB_FIXTURE`), not a production path.
- No god module found; commands are split per domain (16 files), largest service ~524 lines.

## Controllers / Handlers (Transport)

**Verified thin.** Sampled `commands/import.rs` and `commands/reader.rs`: validation at the edge (`pathbuf_from_string` rejects empty, `parse_book_id` rejects malformed ids), `#[instrument]` with structured fields, no SQL, no business rules, errors mapped to typed `BackendError`. Reader commands accept **book ids only, never client paths** — file paths are resolved from DB records, which structurally eliminates path traversal on the read path.

## Data Access

Repos are hand-written rusqlite with parameterized queries throughout (`params![...]` verified in `book_repo`, `sqlite_fts`). This is not a repository-for-everything anti-pattern: repos carry real SQL and mapping, and the FTS MATCH is parameterized (no injection). Direct, understandable, appropriately unabstracted.

## Database

- WAL + `busy_timeout=5000` + **split writer/reader connections** with `query_only` enforced on the reader (`db.rs`, tested in `test_concurrency_fitness.rs::test_query_only_enforced_on_read_connection`). Strong.
- FK cascade deletion is DB-enforced, not app-enforced (`test_database_foreign_key_cascade_deletion`). Correct placement of the invariant.
- Migrations: versioned via `schema_migrations`, applied in one transaction each. Downgrade policy remains undocumented (carried from ARCH-04).

## Transactions

**The one genuine defect cluster.** `import_single_file` sequence:
1. file hashed/metadata-extracted from staging ✅ (good staging design)
2. cover saved, `staged.commit()` → file is now permanent in library dir
3. `book_repo.insert` — autocommit
4. `file_repo.insert` — autocommit
5. tags: get_or_create + add_tag_to_book — autocommit each
6. `update_fts_index` — autocommit
7. event published

Failure between 3–6 leaves: book without file record (3 fails after file commit), file without book (4–5 fail), or committed book with stale FTS (6 fails). SQLite makes the fix cheap: a single `unchecked_transaction()` wrapping 3–5 (and ideally 6) via the existing writer connection, plus delete-on-failure compensation for the committed file. The partial-failure state is currently *survivable* (reconcile_files repairs orphaned paths; a re-import re-does the work) but it is not *correct*.

Other transactions are fine: batch import is bounded (`MAX_IMPORT_BATCH_SIZE=5000`, chunk 25), per-file failure is contained and counted, cancellation via `CancellationToken` is cooperative and tested.

## Consistency / Concurrency

Strong consistency throughout (single local DB) — correct for the product; no eventual-consistency pretense. Optimistic versioning exists and is tested (`test_optimistic_concurrency_versioning`); concurrent read/write under WAL is stress-tested. The unbounded-resource audit found only bounded things: cache is capacity-bounded with LRU eviction (tested), job batch bounded, worker concurrency implicit (single writer conn serializes writes — an effective bulkhead).

## Authentication / Authorization / Multi-Tenancy

**N/A by design** — single-user local app; the OS user is the trust boundary, the IPC allowlist is the API surface. The bridge binary binds loopback and was CORS-hardened for the test harness only. Rate limiting/quotas: ❌ NOT JUSTIFIED (no untrusted network callers).

## Input Validation / Integration Security

- IPC inputs: ids parsed, paths rejected if empty, batch sizes bounded, extensions filtered at the picker *and* by format extractors.
- Sanitizer suite (adversarial canonical/HTML) exists and runs in CI — covers the document-content attack surface (EPUB/PDF/CBZ extraction), which is the real integration risk here. ✅
- SSRF/injection/command-execution: no outbound HTTP in production services; no `Command::new` on user input. Clear.

## Timeouts / Retries / Idempotency / Queues

No external network dependencies in production → no timeout/retry surface to get wrong. Re-import idempotency relies on the duplicate-assessment step (sha256 + path), which is the correct mechanism. In-process JobManager is bounded and cancellable; there is no queue durability problem to solve because jobs are user-witnessed and resumable by re-running the action. ❌ DLQ/outbox: NOT JUSTIFIED.

## Observability / Health / Config

`tracing` at the transport boundary with structured fields; storage layer logs in files/jobs. Diagnostics command exposes health without leaking paths (verified no `path`/`home_dir` echoes in the grep). Config is compile-time constants — appropriate; no env sprawl. Telemetry sink exists frontend-side. **Gap (🟡)**: services below the command layer rarely log; a mid-service failure (e.g., step 4 above) surfaces only as a command error string. Cheap fix: add `tracing::warn!` at service-level error branches.

## Graceful Shutdown

`ctx.shutdown()` handled in `main.rs` run loop; SQLite WAL makes crash-safety a non-event. In-flight imports are user-visible jobs — acceptable semantics for a desktop app.

## Testing

Genuinely strong and layered: unit (models, sanitizer, anchors), integration (real imports, reader formats, backup/restore), reliability (FK cascades, WAL stress, versioning, security bounds), concurrency-fitness, perf (benchmarks, large-scale, real-user-paths), runtime acceptance matrix, plus two architecture-fitness suites. **Missing**: a test that kills the process between import steps 2→3 (the partial-failure window above).

## Anti-Patterns Found

None of the classic set: no distributed monolith, no god controllers, no repo-without-value, no unbounded anything, no swallowed errors (errors are typed and mapped), no premature caching (the one cache is bounded and measured).

---

## Findings (prioritized)

| ID | Priority | Finding | Recommended Direction |
|---|---|---|---|
| BE-001 | 🔴 CRITICAL | Import DB writes are not wrapped in one transaction; file committed before DB | One `unchecked_transaction` around book+file+tags(+FTS) via writer conn; delete committed file on DB failure; add kill-between-steps test |
| BE-002 | 🟠 HIGH | `DeviceId::new()` per command call in 8 sites | Store one `DeviceId` in `LumaAppContext` at startup; accept the frontend's per-install id; migration to backfill stable device row |
| BE-003 | 🟡 MEDIUM | FTS update after DB commit can strand index | Include FTS write inside the BE-001 transaction (FTS5 is transactional in SQLite) |
| BE-004 | 🟡 MEDIUM | Sparse service-level logging | Add structured `warn!`/`error!` at service error branches |
| BE-005 | 🔵 LOW | Schema-downgrade policy undocumented | One ADR paragraph: "older binaries refuse newer user_version" |
| BE-006 | ⚪ CONTEXTUAL | Reader IPC stale-response races (frontend-side) | Track from FRONTEND-04 list; guard with request generation tokens |

## Explicitly Rejected Complexity

Microservices, CQRS, event sourcing, outbox/saga, 2PC, durable queues/DLQ, distributed tracing, rate limiting, multi-tenancy, connection pooling beyond 2 connections, cache-aside layers beyond the existing bounded cache, GraphQL/REST normalization on top of IPC. Each fails the "what requirement causes this?" test for a single-user local application.

## Strengths Worth Preserving (DO NOT CHANGE)

- Modular monolith with attack-proven crate boundaries
- Staged-then-commit import design with duplicate assessment
- Split WAL connections with `query_only` reader
- DB-level FK cascades and parameterized SQL everywhere
- Reader commands accepting ids, never paths
- The reliability/concurrency/perf test posture
- Bounded cache, bounded batches, cooperative cancellation

## Verdict

**🟡 SOUND WITH KNOWN DEBT.** The backend is correct in architecture and mostly correct in execution; BE-001 (import atomicity) and BE-002 (device identity) are the two changes that materially raise correctness, and both are small, local, and testable.
