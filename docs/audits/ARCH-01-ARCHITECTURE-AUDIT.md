# 🏛️ LUMA — ARCH-01: Architecture & System Design Audit

**Date**: 2026-09-14
**Scope**: Full monorepo (8 Rust crates, 6 TS packages, Tauri 2 desktop app, CI, docs)
**Method**: Dependency direction derived from crate manifests; IPC/state boundaries read from implementation (`context.rs`, `tauri.ts`, stores); security boundary inspected in `luma-security`; CI and capability config read directly; existing ADRs cross-checked against code.
**Mode**: AUDIT-FIRST — no redesign performed.
**Note**: This audit covers the *system* architecture. Two prior documents named "ARCH-01" (`docs/ARCH-01-REPORT.md`, `docs/LUMA-ARCH-01-REPORT.md`) cover the *canonical document model* feature work; neither is a system-design audit. No duplication with them.

---

## Executive Architecture Assessment

Luma is a **local-first modular monolith** in the most literal sense: one deployable (a Tauri desktop app), a Rust workspace of 8 crates layered in one direction, a React frontend reachable only through a typed IPC seam, and a single SQLite database owned by one crate. There are no services, no network APIs, no queues, and no cloud — and this is correct for the product: a private, offline reader where the user owns their data.

**Verdict: 🟢 The architecture genuinely supports the stated requirements.** The three non-negotiables from `ARCHITECTURE-PRINCIPLES.md` (local-first, annotation integrity, Book≠BookFile) are all structurally enforced, not just documented. The weaknesses found are real but bounded: architecture rules exist only on paper (no fitness functions), the HTML sanitization boundary is weaker than the security principle claims, and a few documented decisions diverge from code.

## Requirements & Quality Attributes

| Requirement (from README / principles) | Architectural support | Evidence |
|---|---|---|
| Local-first, zero cloud lock-in | Single SQLite file, embedded, WAL; no network calls in storage path | `db.rs`, zero `reqwest`/network deps in storage crates |
| Annotation integrity under reflow | `luma-anchor` as an isolated, WASM-pure crate; annotations bound to Book not file | crate boundary, `ADR-0009/0011` |
| Multiple formats without knowledge loss | `Book` ≠ `BookFile` in domain model; format engines behind per-format docs | `luma-core` models, `luma-reader` extractors |
| Security: untrusted documents | Guards centralized in `luma-security` (path traversal, zip bombs, HTML sanitization, SHA-256); dedup by content hash | `security/lib.rs`, import staging pipeline |
| Performance (instant search, fluid reading) | FTS5 index, dual read/write connections, read/writer PRAGMA split | `db.rs` (WAL, busy_timeout), `luma-search` |

Quality attributes drove real boundaries: the WASM compilation check in CI exists *because* annotation anchoring may need to run client-side; the security crate exists *because* documents are untrusted. This is requirements-first, not technology-first.

## Current Architecture Map

```text
┌─ apps/desktop (Tauri 2) ───────────────────────────────────────────┐
│  Frontend: React 19 + zustand (reader state) + feature folders     │
│    └─ lib/tauri.ts — typed IPC client (1,636 lines, 109 methods)   │
│  Native: src-tauri — 88 thin commands → LumaAppContext             │
│    ├─ context.rs: services + db + event bus + job manager          │
│    └─ spawn_event_bridge: DomainEvent → luma://* webview events    │
└──────────────┬─────────────────────────────────────────────────────┘
               │ typed IPC only (frontend never imports crate code)
┌─ crates ─────▼─────────────────────────────────────────────────────┐
│ luma-core (2.8k)   ← domain, typed IDs, error, canonical doc model │
│ luma-security(281) ← core        guards: paths, bombs, HTML, SHA   │
│ luma-anchor (786)  ← core        fuzzy anchoring (WASM-pure)       │
│ luma-reader (5.6k) ← core, security   EPUB/PDF/CBZ/TXT engines     │
│ luma-storage(8.6k) ← core, anchor, reader, security                │
│                     14 services + repos + EventBus + JobManager    │
│ luma-search (298)  ← core, storage   FTS5 engine                   │
│ luma-sync (68)     ← core        frozen shell                      │
│ luma-ai (172)      ← core        frozen shell                      │
└────────────────────────────────────────────────────────────────────┘
Storage: one SQLite DB (WAL, writer + reader connections), files on disk
```

## Architectural Style

**Modular monolith, layered.** Detected from dependency reality, not folder names:

- Layering is strictly acyclic and points toward `luma-core` (verified in all 8 manifests): `core ← security ← reader ← storage ← search/desktop`. No crate depends upward; the frontend imports no crate code (only `@luma/*` TS packages); no Rust crate references `tauri`.
- The Tauri shell is the composition root: `LumaAppContext` owns all state and services; 88 commands are thin adapters per ADR-004 (validate → forward to service → typed `Result`).

**Style fit**: excellent. A desktop reader gains nothing from distribution but pays for it heavily (packaging, IPC latency, consistency). The one deployment artifact is also the right failure domain: the app is single-user, single-machine.

## Module / Domain Boundaries

Boundaries are drawn on real change drivers:

- `luma-storage` is large (8.6k lines, 14 services) but each service is a coherent aggregate (books, annotations, backup, import...). Its size is justified: it owns all persistence knowledge. Watch for it becoming a dumping ground — `jobs/`, `events/`, `cache/`, and `files/` living inside "storage" is temporal convenience, not domain cohesion.
- `luma-search` at 298 lines is correctly small; extraction into its own crate is arguably premature, but harmless.
- `luma-sync` (68 lines) and `luma-ai` (172 lines) are **speculative shells** — documented in CODEQUALITY-01, frozen with zero dependents. Acceptable: they mark an intended extension point without polluting working crates.

## Service Boundaries

N/A — no services to extract. Correctly so. Extraction triggers (scale divergence, team ownership, independent deployability, fault isolation) do not exist for a single-user desktop app. The ADR set contains no premature microservice decisions.

## Dependency Graph

No cycles (verified from manifests). One direction observation:

- `luma-storage → luma-reader` is the heaviest edge: storage depends on the reader to extract metadata during import, and `reader_service.rs` owns document sessions. This couples the persistence layer to parsing. It is pragmatic (import needs metadata), but it means reader format changes can ripple into storage. Acceptable at this scale; the alternative (an import orchestration layer in the shell) would add indirection without removing the coupling.

## API / Contract Architecture

- **IPC**: 88 Tauri commands, names stringly-matched on both sides but types carried by `@luma/shared-types` mirroring Rust models. 41 Vitest tests exercise the transport seam. This is the project's most important boundary and it is well-guarded — except the match itself is by string literal, so a command rename compiles clean and fails only at runtime (CQ-01, known debt).
- **Events**: 9 `luma://*` webview event names in `context.rs` constants; `DomainEvent` is a typed enum bridged one-way to the webview. Contract is stable and centralized.
- No REST/GraphQL/gateway — correct absence.

## Sync / Async Model

Appropriately boring: request/response IPC for everything user-initiated; async (tokio broadcast + `JobManager` with cooperative cancellation and SQLite-persisted job state) only for long operations (batch import, scans). No queue infrastructure, no eventual consistency. The event bus is used for **notification** (cache invalidation, UI sync), not for command transport — the right tool split.

## Event-Driven Architecture

Present in exactly the dose the system needs. `EventBus` is a typed in-process broadcast channel (capacity 256, lag documented). Consumers: the Tauri event bridge and background jobs. No event sourcing, no replay, no schema versioning — none justified.

## CQRS / Event Sourcing

Absent, correctly. Reads and writes go through the same SQLite database with a writer/reader connection split — a concurrency optimization, not a CQRS architecture. No premature "advanced" patterns detected.

## Data Ownership

Clean: **`luma-storage` is the single owner of the SQLite schema and all data access.** No cross-crate SQL, no second persistence path by design. Known violation (CQ-02 from CODEQUALITY-01): `tauri.ts` falls back to `localStorage` for settings/notes on IPC failure — now loud (warn-logged) but still a de facto second owner for degraded operation. The annotation data — the crown jewels — never touches that fallback.

## Consistency

Strong/local: every workflow is a local SQLite transaction. WAL gives concurrent readers with one writer; `busy_timeout=5000ms` bounds contention. Read-after-write is trivially satisfied within the process. No tolerance decisions needed. Correct model; nothing to change.

## Availability / Reliability

Single-machine availability (app up or not). Reliability is handled where it matters for a reader:

- Timeouts: SQLite busy timeout; job cancellation tokens.
- Idempotency: import dedupes by SHA-256 content hash — a re-import cannot duplicate a book.
- Recovery: staging directory for in-flight imports (atomic promote); WAL checkpoint on graceful shutdown; in-memory DB fallback if the database file cannot be opened.
- Missing: no corruption-recovery story beyond "restore a backup" (backup is ZIP-based, per-file JSON + typed errors — hardened in CODEQUALITY-02). Acceptable for the product; a `PRAGMA integrity_check` on boot would be a cheap safety net (Deferred).

## Scalability

Scaling dimension that matters: **library size**, and it is engineered for (FTS5 search, paginated queries, bulk-insert seeding measured to 20k books in the perf harness; soak/spike/capacity tiers assert budgets). All other scaling axes (instances, tenants, regions) are meaningless here. No over-engineering detected.

## Caching

`CacheManager` in-process, owned by the shell context, invalidated via domain events. Small, explicit, event-driven invalidation — the right consistency story. The reader session caches inside `reader_service.rs` (triplicated logic flagged in CODEQUALITY-01) remain the hot-path exception, deliberately deferred.

## Storage

SQLite (bundled rusqlite, WAL) + filesystem for books/covers: exactly right for the workload — relational metadata with FTS, transactional integrity, zero ops burden. Documented and justified in ADR-0006. Files on disk are path-guarded (`sanitize_relative_path`) and content-hashed.

## Security Architecture

Trust boundary: **everything crossing the import boundary is untrusted.** Enforcement observed:

- Path traversal: `sanitize_relative_path` with base-dir containment (tested).
- Zip bombs: entry count (100k), uncompressed size (500MB), expansion ratio (100:1) caps (tested).
- Content identity: SHA-256 at import.
- HTML: EPUB/CBZ text passes through `sanitize_untrusted_html` before storage; CSP `default-src 'self'` in `tauri.conf.json`; Tauri capability set is minimal (`core:default` only); no secrets in source; `luma-ai` has no key-handling code at all yet.

🟠 **Weakness (ARCH-02)**: the sanitizer is a **blocklist** — it removes known-dangerous tag pairs and neutralizes event handlers / `javascript:` URIs by regex, then the sanitized HTML is injected with `dangerouslySetInnerHTML` (EpubReaderView.tsx:305). Blocklist sanitizers historically lose against evasion (mutation XSS, exotic attribute encodings, constructor of unknown vectors). The security principle ("executable scripts are eliminated") is *mostly* true but the mechanism is weaker than the claim. Mitigations already present (CSP, no remote content, local files) reduce real risk. Recommended direction: an allowlist HTML parser (e.g., `ammonia` crate) at the same boundary — a contained swap, same call sites.

- Also: `unsafe-inline` in the CSP is required by the current rendering approach but weakens the webview's last line of defense; it becomes redundant once rendering moves to a sandboxed webview/iframe, which would be the stronger architectural fix (Contextual).

## Multi-Tenancy

N/A — single user by product definition. No tenancy complexity exists or is needed.

## Edge / Gateway

N/A. The Tauri IPC surface is the edge; the capability file (`core:default` only) is the least-privilege edge policy, and it is minimal. Business logic is correctly out of the shell (thin commands per ADR-004).

## Configuration

`LumaAppContextConfig` (data dir, db filename) is the only native config; frontend settings live in the settings service (persisted, owned). No config sprawl, no env-specific divergence, no secrets. `deny.toml` enforces dependency licensing/sources.

## Deployment

Single-artifact desktop distribution; CI builds on 3 OSes with fmt/clippy/tests/cargo-deny/WASM checks. No release pipeline yet (no `tauri-action`/signing/updater config) — appropriate for pre-release; the updater will be an architectural decision (security boundary) when it arrives. No progressive rollout machinery is needed for a desktop app.

## Cloud / Infrastructure

None, by design. This is the single largest cost saving in the system and it is a *decision*, not an omission — documented in ADR-0001.

## Real-Time

WebView event push (`app.emit`) for progress/changes; no sockets, no fan-out. Correct.

## AI/ML/LLM/Agents

`luma-ai` is trait-only scaffolding (172 lines, no consumers). When activated, the architectural question — local inference vs remote API, key custody, document-content privacy — is *not yet decided*, and the crate correctly makes no promises. The ReadingIntelligenceDashboard consumes only local analytics data. Nothing to audit beyond the boundary's cleanliness, which is good.

## Frontend / Backend Architecture

SPA in a webview, all rendering client-side — the only sensible model for a local-first desktop reader. State: zustand for reader state (676 lines, one owner); feature-folder components; the known god-module `tauri.ts` (CQ-01) is the one structural sore spot — transport + 109 methods + mock backend in one file, every IPC change lands twice (frontend method + command). The transport seam itself is justified (it makes the 41-test harness and MOCK transport possible); its placement isn't. Rendering strategy (dangerouslySetInnerHTML for sanitized EPUB HTML) is covered under Security.

## Team Topology

Single-developer project. Conway's law is trivially satisfied; the crate boundaries nonetheless anticipate a future split (core/anchor/reader could be staffed independently). No coordination pathology to report.

## Developer Experience

Strong for the maturity stage: `pnpm`/`cargo` gates are fast locally, the Diátaxis docs hub is real (and maintained — INDEX.md links verified), the perf-budget harness gives immediate regression feedback with named constants, and the test-fixture module keeps benchmark suites writable. Onboarding path: README → docs/INDEX → ADRs → code, all consistent with each other (spot-checked).

## Cost / Vendor Lock-In

No infrastructure cost. Lock-in: rusqlite (bundled SQLite), Tauri, React — all deliberate, all MIT/Apache, all replaceable at bounded cost because storage knowledge is confined to one crate. cargo-deny enforces the license policy continuously.

## ADRs / Architecture Documentation

26 numbered ADRs plus architecture docs per domain. Spot-checked ADR-004 (application services) and ADR-005 (event bus + jobs): **both accurately describe the shipped code.** Divergences found:

- 🟡 **Doc drift (ARCH-03)**: `docs/architecture/adrs/` (ADR-004/005) vs `docs/adr/` (ADR-0001–0024) are two parallel ADR series with different numbering — a maintainer cannot tell which is authoritative. Also, ADR-0023 documents the writer/reader connection split correctly, but the dependency-policy doc's dependency table lists React 18.3 while the project uses React 19 (minor staleness).
- The documentation set is otherwise an asset, not a liability — rare for this stage.

## Fitness Functions

🟠 **The biggest genuine gap (ARCH-01)**: architecture rules are *documented* (`DEPENDENCY-POLICY.md`, layer diagrams, dependency policy) but **not enforced**:

- No import-boundary tests for the frontend (nothing fails if `apps/desktop` imports from `packages/library-ui/src/internal` or a package reaches into a feature folder).
- No crate dependency test (nothing fails if a future PR adds `luma-storage → luma-search` or a cycle).
- Package manifests are currently clean (verified `@luma/*` dependency lists), but nothing holds them that way.

The WASM compile check is the one *existing* fitness function — and it proves the pattern works. Recommended: (a) a cargo test asserting the crate layering from manifests (~30 lines), (b) an eslint `no-restricted-imports`/boundaries rule for `apps/desktop → packages/*` public entries. Small, durable, CI-enforced.

## Evolution / Migration

The codebase is at **Simple → Modular complete; Selective Distribution never justified.** Real evolution triggers to watch, with their natural architectural responses:

1. **Sync across devices becomes real** (`luma-sync` unfreezes): the event bus + change records + causality models are already the seam; the risk is sync semantics reaching into storage services — should land as a new crate consuming `DomainEvent`s, not as service edits.
2. **AI features activate** (`luma-ai` unfreezes): privacy boundary decision needed (local vs remote); document extraction should come from the canonical document model, not re-parsing.
3. **Plugin surface** (`features/plugins` exists as UI): the security boundary design (sandboxing, capability grants) must precede any plugin loading.

None of these justify distribution today. The strangler/branch-by-abstraction machinery is unnecessary pre-commitment.

## Rewrite Assessment

No rewrite proposed or warranted. Incremental remediation list below is fully compatible with the current structure.

## Anti-Patterns

| Anti-pattern | Present? | Evidence |
|---|---|---|
| Premature microservices | No | — |
| Shared DB across "independent" services | No | single owner crate |
| Premature DDD/CQRS/ES/K8s | No | absent, correctly |
| Technology-first boundaries | No | WASM/security boundaries are requirement-driven |
| Speculative crates (luma-sync/ai) | Yes, contained | frozen, zero dependents, documented |
| Business logic in transport | Partially | mock backend + fallbacks inside `tauri.ts` (CQ-01) |
| Blocklist sanitization | Yes | ARCH-02 above |

## Strengths Worth Preserving

1. **The single-owner storage crate** — one place knows the schema. Do not fragment it into "microservices in-process."
2. **The typed IPC seam + mock transport** — it is what makes 41 frontend tests possible without a Rust runtime.
3. **The event bus dose** — notification-only, typed, in-process. Resist upgrading it to a command bus.
4. **Security guards centralized in one pure crate** — easy to audit, easy to test, easy to strengthen (ARCH-02).
5. **The ADR discipline** — 26 decisions with context/consequences, matching code. Keep writing them.

## Required Changes

| ID | Priority | Finding | Direction |
|---|---|---|---|
| ARCH-01 | 🟠 HIGH | Architecture boundaries documented but not enforced | Add crate-layering test + eslint import boundaries; wire into CI |
| ARCH-02 | 🟠 HIGH | HTML sanitizer is a regex blocklist guarding `dangerouslySetInnerHTML` | Swap to allowlist parser (`ammonia`) at the same boundary; keep CSP |
| ARCH-03 | 🟡 MEDIUM | Two parallel ADR series; minor doc staleness (React version) | Declare `docs/adr/` authoritative, archive/merge `docs/architecture/adrs/`, refresh dependency table |
| ARCH-04 | 🟡 MEDIUM | `jobs/`, `events/`, `cache/`, `files/` hosted inside `luma-storage` | Accept for now (contain); if storage keeps growing, extract an `luma-runtime` crate rather than letting storage become a dumping ground |
| ARCH-05 | 🔵 LOW | No DB integrity check on boot | `PRAGMA quick_check` + diagnosable error path at startup |

## Not-Justified Changes (explicitly rejected)

- Extracting `luma-search` or splitting `luma-storage` per-service: navigation cost without change-cost reduction.
- Any client-server or distribution move: no trigger exists.
- Sandbox iframe rendering *only* as a security fashion statement: worth doing as the fix for `unsafe-inline` + defense-in-depth (Contextual), not as an emergency — the blocklist+CSP combination has no known current exploit path in a local-file context.
- Rewriting `tauri.ts` before CQ-01's split plan is scheduled: it works, is tested, and the transport seam is sound.

## Prioritized Architecture Roadmap

1. **DO NOW**: ARCH-01 (fitness functions — small, permanent protection) and ARCH-02 (sanitizer hardening — the one place where the security principle outruns the mechanism).
2. **PLAN**: ARCH-03 (ADR consolidation, one afternoon), ARCH-05 (boot integrity check).
3. **CONTAIN**: ARCH-04 (runtime concerns in storage), CQ-01/CQ-02 (tracked in CODEQUALITY audits), speculative crates.
4. **Evolution watchlist**: sync/ai/plugin unfreeze triggers as described above — each has a pre-identified seam.

---

## Verification Notes

Every claim above was checked against the repository at commit `41e4bef`: crate manifests (dependency direction), `context.rs` (service ownership, event bridge), `db.rs` (WAL/dual-connection), `luma-security/src/lib.rs` (guard constants and sanitizer algorithm), `tauri.conf.json` + `capabilities/default.json` (CSP, least privilege), `ci.yml` (gates), `import_service.rs` (staging/hash), `backup_service.rs` (typed errors, ZIP), `tauri.ts` (109 methods, mock transport), `eslint`/`grep` searches for boundary violations (none found), and package manifests for `@luma/*` coupling (clean).
