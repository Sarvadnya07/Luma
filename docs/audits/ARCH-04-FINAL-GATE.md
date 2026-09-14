# 🏛️ LUMA — ARCH-04: Final Architecture & System Design Quality Gate

**Date**: 2026-09-14
**Method**: Independent re-verification, not report trust. Every claim below was checked against the working tree and by executing the relevant gates on this machine. Prior phase reports treated as hypotheses; ARCH-02's changes were inspected in source and exercised via the test suites that encode their contracts.
**Mode**: Final gate — fixes applied only where the gate itself was red (see §3); no redesign.

---

## 1. Executive Architecture Verdict

🟡 **SOUND WITH KNOWN ARCHITECTURAL DEBT.**

The architecture itself — modular monolith, acyclic crate layering, single data owner, typed IPC seam, allowlist security boundary — is verified correct for a local-first single-user desktop reader, and is now *enforced by CI*, not just documented. The debt that remains is governance and hygiene, not structure:

1. The ARCH-02 remediation was **committed (`8205a46`) with three red suites, a clippy violation, and rustfmt violations** — all fixed in this gate (§3). The root cause is process: that commit also bundled unrelated EPUB-highlight feature work, and no gate ran before commit.
2. The **ARCH-02 remediation report, the ARCH-03 validation report, and an ADR for the sanitizer migration were never written**, despite ARCH-02's own contract requiring them (§5).

Neither gap threatens the architecture; both threaten the *ability to see* the architecture.

## 2. Requirements → Architecture Chain (verified, not asserted)

| Requirement | Decision | Enforcement evidence | Status |
|---|---|---|---|
| Local-first, zero cloud | Embedded SQLite (WAL, split connections), files on disk, no network in storage path | zero network deps in storage crates (ARCH-01, re-spot-checked) | VERIFIED |
| Untrusted documents | All guards centralized in `luma-security` | all 10 `sanitize_untrusted_html` call sites in `luma-reader`; allowlist parser (ammonia) | VERIFIED |
| Annotation integrity | `luma-anchor` WASM-pure; sanitizer preserves `id`/`class` locator attributes | `generic_attributes(hashset!["lang","title","id","class"])`; `test_markdown_full_parsing_and_security_sanitization` asserts `id="heading-0"` survives | VERIFIED |
| Dependency direction | `core ← security ← reader ← storage ← search` | `architecture_boundaries.rs` (3 tests) + `eslint no-restricted-imports` + CI Dependency Policy step — all run in CI | VERIFIED |
| Evolution reversibility | Frozen `luma-sync`/`luma-ai` shells, zero dependents | manifests re-checked | VERIFIED |

## 3. Regressions Found by This Gate (and fixed)

The ARCH-02 sanitizer migration (regex blocklist → ammonia allowlist) was committed while red. Each defect, proven pre-existing at `8205a46` via `git stash`:

| Defect | Evidence | Fix (this pass) |
|---|---|---|
| Unclosed `<head><title>` HTML lost all body content | `test_adversarial_malformed_html`: `total_paragraphs == 0` | `strip_document_wrappers` now resumes from a literal `<body>` when `<head>` is unclosed (content-recovery contract) |
| HTML `<title>` lost (head metadata is stripped) | `test_canonical_html_document` fell back to filename | `html_doc.rs` extracts `<title>` from raw source; `<h1>` from sanitized fragment |
| Markdown blockquotes/structure destroyed | `markdown_doc.rs:38` ran the HTML sanitizer over markdown *source*, entity-escaping `> ` | source is parsed as text; new `luma_security::strip_raw_html_blocks` removes embedded raw-HTML lines (escaped script text still leaks payloads to search/text extraction — removal, not escaping) |
| Generated `id`/`class` stripped → locators broken | `test_markdown_full_parsing...`: `id="heading-0"` gone | sanitizer allows `id`/`class` as generic attributes (inert) |
| `blocked-javascript:` assertion encoded the old blocklist | `test_backend_reliability.rs:161` | test now asserts the *stronger* ammonia behavior: no `javascript:` URI survives at all |
| Clippy `unused_assignments` in `strip_wrapping_tags` | clippy `-D warnings` red | fixed |
| 7 files failed `cargo fmt --check` (CI gate) | fmt diff on backup_service, boundary tests, perf suites | `cargo fmt` applied |

Also fixed (committed broken in `8205a46` by the bundled feature work): `highlightEngine.ts` unused locals breaking `pnpm typecheck`.

**Final gate results (fresh, this machine):** `cargo test --workspace` 44/44 suites ok · `cargo clippy --workspace -- -D warnings` clean · `cargo fmt --check` clean · `pnpm typecheck` 7/7 (incl. desktop) · `pnpm lint` clean · `pnpm test` 53/53.

## 4. Fitness Functions (the ARCH-01→02 arc is now closed)

- `crates/luma-storage/tests/architecture_boundaries.rs`: dependency direction ≡ documented layering; policy table covers every workspace crate (new crates fail CI until registered); cycle detection. Negative-proofed during ARCH-02 (fails with a clear violation message).
- `eslint no-restricted-imports`: frontend cannot deep-import crate code. Negative-proofed (`__archprobe__`).
- CI (`.github/workflows/ci.yml`) runs fmt, clippy `-D warnings`, full tests, dependency policy, WASM compilation check, and the frontend gate — architecture rules fail builds, satisfying the "documentation alone does not count" standard.
- Performance budgets: `test_perf_validation.rs` asserts p95 against named constants (PERF-03).

## 5. Governance Findings (not fixed — owner decisions)

- **🟡 GOV-1 — Missing phase documentation.** No ARCH-02 remediation report, no ARCH-03 validation report, and no ADR for the sanitizer migration in `docs/adr/` (latest: ADR-0024). The migration is a security-boundary decision ARCH-02's own contract said must be recorded. Recommended: one ADR (blocklist→ammonia, alternatives considered, `id`/`class` generic-attribute trade-off) and a short ARCH-02/03 consolidated report.
- **🟡 GOV-2 — Commit hygiene.** `8205a46` mixed a feature, an architecture hardening, an audit doc, and telemetry churn in one commit, bypassing gates. Nothing structural to fix — but the discipline (gates before commit, one intent per commit) is what keeps §3 from recurring.
- **🔵 GOV-3 — Telemetry churn.** `docs/performance/runtime/raw_telemetry_capture.json` regenerates on every `pnpm test` run and must be manually reverted; consider `.gitignore`/path-scoped test config (recurring noise, owner declined so far).
- **⚪ Untracked files** `apps/desktop/scripts/`, `docs/reader-recovery/runtime-artifacts/` (EPUB highlight session artifacts) and modified `package.json`/`scripts/verify-epub-highlight.ts`/`tsconfig.json` belong to the concurrent highlight workstream; left untouched.

## 6. Final Scorecard

| Dimension | Status | Evidence | Risk |
|---|---|---|---|
| Requirements Alignment | ✅ | §2 chain, all VERIFIED | — |
| Cohesion / Coupling | ✅ | layering tests green in CI | — |
| Boundaries | ✅ | enforced (tests + eslint + CI), not just documented | — |
| Dependency Direction | ✅ | acyclic, policy-complete, CI-failing on violation | — |
| Data Ownership | ✅ | single SQLite owner (`luma-storage`) | — |
| API / Contract (IPC) | ✅ | typed IPC, 109 methods, names stable | — |
| Consistency | ✅ | single-process, single-writer DB — no distributed consistency debt | — |
| Reliability | ✅ | budget guards, soak/spike/capacity tiers, reliability suites | desktop-tier runtime evidence remains PERF-03's UNVERIFIED caveat |
| Scalability | ✅ (context-appropriate) | capacity ramp to 20k books measured; single-user desktop — distribution correctly rejected | — |
| Security | ✅ | allowlist sanitizer, adversarial suites green, CSP + minimal Tauri capabilities | see GOV-1 (undocumented decision) |
| Deployment | ✅ | single artifact, CI builds it | — |
| Observability | 🟡 | structured events, perf harness output | no unified error-metric surface (documented in ARCH-01) |
| Developer Experience | ✅ | one command per gate; architecture violations are self-explaining | — |
| Documentation | 🟡 | ADRs 0001–0024 accurate | GOV-1: sanitizer migration + phase reports missing |
| Evolution Path | ✅ | frozen shells, reversibility preserved | — |

## 7. Final Verdict & Blockers

**🟡 READY WITH KNOWN NON-CRITICAL GAPS** — the smallest material set, all governance:

1. **GOV-1** — write the sanitizer ADR + consolidated ARCH-02/03 report (est. small; no code).
2. **GOV-2** — adopt gate-before-commit discipline for multi-workstream commits (process, not code).
3. **GOV-3** — stop tracking `raw_telemetry_capture.json` (owner decision pending).

No structural, security, data-ownership, or dependency-direction blockers remain. The "Do Not Change" list stands: crate layering, single-DB ownership, the typed IPC seam, the ammonia boundary with its `id`/`class` allowance, and the frozen shells are all verified and should not be churned.
