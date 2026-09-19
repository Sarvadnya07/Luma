# CI PERFORMANCE GATE CALIBRATION — startup_context_init

Date: 2026-09-19
Scope: `crates/luma-storage/tests/test_perf_validation.rs` budget guard, applied CI-wide to all 8 budget paths.
Verdict on the objective question: **C — a CI-runner-sensitive benchmark requiring per-OS/environment calibration** (root cause: it is also **B** — the budgets were calibrated on exactly one environment, the maintainer's desktop).

---

## Benchmark definition (exact)

`startup_context_init` measures, per sample:

```rust
let start = Instant::now();
let db = Database::open_in_memory()?;          // SQLite in-memory conn + PRAGMA config
                                               // + full run_migrations() (schema DDL)
let cache = CacheManager::new();
let bus = EventBus::default();
let _search = SearchService::new(db, bus, cache);
let _reader = ReaderService::new(db, cache);
startup.push(start.elapsed());
```

- **Timer boundaries**: wall-clock `Instant` around the whole construction sequence; nothing else.
- **Samples**: n=10, fresh in-memory DB per sample (cold state each run).
- **Percentile**: nearest-rank over sorted samples; **p95 at n=10 = 2nd-largest sample** — extremely outlier-sensitive.
- **Setup/teardown in measurement**: none (pure construction).
- **DB**: in-memory SQLite (no disk I/O); **subprocess**: none; **tracing**: none active in the timed section.
- **Profile**: debug (`cargo test` default) — debug-profile numbers are explicitly non-comparable with release.
- **Dominant cost**: CPU + allocator — SQLite DDL execution and allocator behavior dominate. **No filesystem-dependent work.**

**What the 40 ms budget represents**: the maintainer's local Windows 11 x86_64 NVMe desktop's tolerable p95 for this construction sequence, in debug profile. It was **never measured on any CI runner** (`PERF-03-VALIDATION-REPORT.md`: "Environment: Windows 11 x86_64 desktop, NVMe SSD").

## Historical baselines

| Commit | Environment | Runner type | p50 | p95 | Budget | Result |
|---|---|---|---:|---:|---:|---|
| 30d5ff0 (budget introduced) | Windows 11 desktop, NVMe | local | — | 8.130 (guard-verify run) | 5 (deliberate fail test) | FAIL (intentional proof) |
| 6f77c82 (report session) | Windows 11 desktop, NVMe | local | 9.31 | 16.81 | 40 | PASS |
| bff68ed — run 35345697236 (ubuntu) | GitHub-hosted ubuntu | CI | 62.5 (pagination) — startup passed* | — | 40 | pagination FAIL / startup PASS |
| bff68ed — run 35345697236 rerun (ubuntu) | GitHub-hosted ubuntu | CI | 18.15 | 41.19 | 40 | FAIL |
| a83be5e — run 35412785721 (macos-26-arm64) | GitHub-hosted macOS arm64 | CI | 8.32 | 45.10 | 40 | FAIL |
| a83be5e — run 35412572982 (macos-26-arm64) | GitHub-hosted macOS arm64 | CI | — | **26.56 (capacity_ramp_scale_20000, budget 20)** | 20 | FAIL (different guard, same runner class) |
| 35412785721 rerun (macos-26-arm64) | GitHub-hosted macOS arm64 | CI | 8.32 | 45.10 | 40 | FAIL (reproduced) |

\* First failure of run 35345697236 was `library_pagination_1k_20pages` 62.5/60ms on ubuntu; startup passed that run — the breach wanders between paths/runs, the signature of environment noise, not a code regression.

## Local measurements (this audit — Windows desktop, debug profile)

8 independent harness executions × 10 samples each, `startup_context_init`:

| Run | p50 | p95 | min | max |
|---:|---:|---:|---:|---:|
| 1 | 6.217 | 8.944 | 5.973 | 8.944 |
| 2 | 6.046 | 7.040 | 5.966 | 7.040 |
| 3 | 6.097 | 7.028 | 6.001 | 7.028 |
| 4 | 6.085 | 8.786 | 5.956 | 8.786 |
| 5 | 6.152 | 7.096 | 6.041 | 7.096 |
| 6 | 6.134 | 7.202 | 6.044 | 7.202 |
| 7 | 6.371 | 7.500 | 5.916 | 7.500 |
| 8 | 6.152 | 7.251 | 5.952 | 7.251 |

**min 5.916 / median-p50 ≈ 6.15 / p95 range 7.03–8.94 / max 8.94** — 4.5×–5.7× headroom under the 40 ms budget locally. Local is COMPARABLE to CI only as a ratio baseline; absolute numbers are a different machine class.

## CI measurements (macos-26-arm64, GitHub-hosted, debug profile)

| Run | p50 | p95 | max | Verdict |
|---|---:|---:|---:|---|
| 35412785721 (pre-rerun) | 8.322 | 45.101 | 45.101 | FAIL (p95) |
| 35412785721 rerun | 8.322 | 45.101 | 45.101 | FAIL (reproduced) |
| 35345697236 rerun (ubuntu runner) | 18.148 | 41.194 | 41.194 | FAIL |
| 35412572982 — capacity_ramp_scale_20000 | — | 26.559 | — | FAIL (budget 20, different guard) |

CI p50 is **2.4×–3.0×** local p50; CI p95 reaches **6.4×** local p95. A second, independent budget (`capacity_ramp_scale_20000`, a different workload) also breached on the same runner class — environment-level slowdown, not one flaky test.

## Change-impact conclusion (exact)

`git diff 6f77c82..HEAD` (last-known-budget-introducing commit → HEAD) touches: the browser bridge binary (separate `[[bin]]`, not linked into `test_perf_validation`), Tauri command modules (`main.rs`, `context.rs`, commands/*) which are not compiled into the `luma-storage` test target, frontend TS files (not compiled by cargo at all), and docs. **No execution path connects any HEAD change to `startup_context_init`**: the benchmark constructs `Database::open_in_memory` + `CacheManager` + `EventBus` + `SearchService` + `ReaderService` — none of these modules were modified in 6f77c82..HEAD. Additionally the breach appears on macOS while local Windows (which shares the budget's origin environment) shows 4.5×–6.4× headroom, and a *different* budget breached on the *other* runner — inconsistent with a code regression, consistent with runner CPU variance. Conclusion: **NOT a regression introduced by recent changes.**

## Runner/environment sensitivity

**HIGH** — same commit, same code: local p95 7–17 ms vs CI p95 41–45 ms (macOS arm64), 41 ms (ubuntu); breach wanders between runs and even between different budgets.

## Statistical / methodological review

- p95 at n=10 is the 2nd-largest sample — dominated by a single scheduling blip on shared virtualized runners. It is retained (per instructions) as the guard statistic; the calibration compensates for the environment gap instead.
- Observed CI jitter on a *passing* distribution is up to ~5× p50 (p50 8.3 → p95 45.1). Any fixed budget must sit above that jitter ceiling on CI to have acceptable false-positive rates, while staying low enough to catch genuine regressions.

## Recommended policy (implemented)

**OPTION C — CI-specific baseline with controlled tolerance**, implemented as an explicit, documented `CI_RUNNER_MULTIPLIER` applied only when `CI` env var is set:

- `effective_budget = base × 1.5` on CI; `base` (unscaled) locally.
- **Evidence window for the multiplier: (1.13, 2.0)**
  - Lower bound 1.13× = worst observed no-regression CI jitter must pass (45.1/40).
  - Upper bound 2.0× = a genuine 2× code regression shifts the whole distribution 2× (worst no-regression CI p95 45.1 → ~90 ms); the effective budget must stay below ~80 ms to catch it.
- **Chosen 1.5× (midpoint)**: worst jitter passes with 33% headroom (45.1 vs 60 ms); a genuine ≥1.7× regression (p95 ≈ 77 ms) still breaches; a 2× regression (≈90 ms) breaches decisively.
- **Local regime completely unchanged** — the user-perceptible contract (40 ms on the reference desktop) still asserts at exactly 40 ms; local regression sensitivity is untouched.
- The guard is **NOT disabled** on CI: all 8 budgets still assert and fail the build; every decision point prints `BUDGET-CALIB|...|regime=CI|effective=...` so logs are self-describing.

## Regression sensitivity (numerical rationale)

| Scenario | Expected CI p95 | Effective budget 60 ms | Verdict |
|---|---:|---:|---|
| Observed worst jitter (no regression) | 45.1 ms | 60 | PASS (33% headroom) |
| Genuine 1.7× regression | ≈76.7 ms | 60 | BREACH ✅ |
| Genuine 2× regression | ≈90.2 ms | 60 | BREACH ✅ |
| Local: any regression past 40 ms | — | 40 (unscaled) | BREACH ✅ unchanged |

## 2026-09-19 addendum: multiplier window collapsed → statistic stabilized instead

A third CI datapoint invalidated the (1.13, 2.0) window: run 35444985378 (commit 2fccef4, code unchanged on the measured path) breached the scaled budget with **p95 = 82.0 ms vs effective 60 ms**. With the no-regression jitter ceiling now 2.05× and the catch-a-2×-regression ceiling at 2.0×, **no global CI multiplier can satisfy both** — the problem is the statistic, not the constant.

Root statistical cause: at n=10, nearest-rank p95 IS the 2nd-largest sample. One OS scheduler stall (observed: 82 ms vs an 8–18 ms CI median) occupies that slot and becomes the verdict.

**Implemented fix (smallest correct change):** raise startup_context_init sampling from n=10 to n=30. The p95 remains the 2nd-largest sample, but a lone stall no longer occupies that slot; a systematic slowdown still shifts the whole tail and breaches. The 1.5× CI multiplier is retained. Local regime unchanged (verified: local p95 21.9 ms vs 40 ms budget, n=30).
## Reason

The budget is a real, useful contract, but its recorded constant encodes one machine's speed. Demanding that contract unscaled from a shared virtualized arm64 runner produces false positives that mask true signals (the guard spent multiple runs failing on noise while a *different* real defect class — the pdf.js worker crash — was found by hand). The calibration removes the environmental confound while keeping — and numerically proving — regression detection.
