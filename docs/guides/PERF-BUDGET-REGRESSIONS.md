# 🛠️ Respond to a Performance Budget Regression

> **Diátaxis Mode**: How-to Guide
> **Audience**: Maintainers and contributors changing code exercised by the perf validation harness.
> **Prerequisites**: Rust 1.80+; a local `cargo build --workspace` that succeeds.

The perf validation harness asserts measured p95 latencies against recorded budget constants. When a budget is exceeded, `cargo test --workspace` fails with a `PERFORMANCE REGRESSION` message. This guide tells you how to read the failure, decide whether it is a real regression, and how to update a budget deliberately when the codebase legitimately changed.

---

## 1. Where the budgets live

All budgets are constants in one place:

```text
crates/luma-storage/tests/test_perf_validation.rs  →  mod budget
```

| Constant | Budget (p95) | Covers |
| :--- | ---: | :--- |
| `STARTUP_P95_MS` | 40 ms | Context + DB + services init (10 runs) |
| `PAGINATION_1K_WALK_P95_MS` | 60 ms | 20-page walk over a 1k-book library (10 runs) |
| `FTS5_SEARCH_P95_MS` | 10 ms | FTS5 query on a 1k-book index (50 runs) |
| `PDF_COLD_OPEN_P95_MS` | 30 ms | 250-page synthetic PDF open (10 runs) |
| `PDF_NAV_20P_P95_MS` | 200 ms | 20 sequential cold page extractions (10 runs) |
| `BULK_INGEST_10K_P95_MS` | 600 ms | 10k-book bulk insert, 3 fresh-DB runs (SYNTHETIC SCALE) |
| `PAGINATION_10K_QUERY_P95_MS` | 20 ms | Single 50-row page query on a 10k library (20 runs) |
| `CAPACITY_RAMP_P95_MS` | 20 ms | Capacity-ramp page query at 1k/5k/10k/20k scales |

`docs/performance/PERF-03-VALIDATION-REPORT.md` documents these same values; the harness constants are the single source of truth. Debug-profile numbers — do not compare against release builds.

## 2. Run the harness locally

```bash
cargo test -p luma-storage --test test_perf_validation -- --nocapture
```

Each hot path prints a `PERF-STAT` line, then a guard verdict:

```text
PERF-STAT|startup_context_init|n=10|p50=9.309ms|p95=16.811ms|min=6.888ms|max=16.811ms|mean=9.158ms
BUDGET-GUARD|startup_context_init|p95=16.811ms|budget=40.000ms|OK
```

`BUDGET-GUARD|...|FAIL` is followed by an assertion panic like:

```text
PERFORMANCE REGRESSION: startup_context_init p95 8.130ms exceeds recorded budget 5.000ms
```

The four tests in the harness map to four tiers: `test_multi_run_hot_paths_with_percentiles` (Tier 1 hot paths), `test_soak_repeated_open_close_cycles` (Tier 2 soak, drift guard: late-half p50 must stay under 2× the early-half), `test_spike_burst_and_recovery` (Tier 3, recovery must return under 5× baseline), `test_capacity_ramp_to_first_breach` (Tier 4, every scale 1k–20k asserted against `CAPACITY_RAMP_P95_MS`).

## 3. Decide: real regression or noise?

The harness measures on your machine, in debug profile. Before changing anything:

1. **Re-run 2–3 times.** A marginal breach (within ~10–20% of budget) that disappears on re-run is machine noise, not a regression.
2. **Check what you changed.** The Tier-1 paths cover startup, `BookRepository::list` pagination, FTS5 search, and PDF parsing. If your change touches none of these, look for indirect effects (e.g., a new lock, an extra DB round-trip in a shared service).
3. **A real breach is a finding, not an obstacle.** If a hot path genuinely got slower, fix the regression — do not raise the budget to make CI pass.

## 4. Update a budget deliberately

Raise a budget constant only when the codebase legitimately changed cost profile (new functionality on a path, an intentional trade-off) **and** the new number is still acceptable for users:

1. Edit the constant in `mod budget` in `crates/luma-storage/tests/test_perf_validation.rs`.
2. Update the matching value in `docs/performance/PERF-03-VALIDATION-REPORT.md` so the two agree.
3. Record the why in your commit message.

Lower a budget when you have made a path faster and want to lock the gain in.

## 5. Verify

```bash
cargo test -p luma-storage --test test_perf_validation
```

All four tiers must pass. If a soak/spike relative guard fails (Tiers 2–3), the cause is degradation *within* the run — see the drift and recovery rules in section 2 — and a budget constant will not fix it.
