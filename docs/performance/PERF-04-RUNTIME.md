# ⚡ LUMA — PERF-04 DESKTOP RUNTIME PROFILING & PERFORMANCE BUDGETS

**Date**: 2026-09-02  
**Target Engine**: Tauri 2, WebView2, React 18, Rust 2021  
**Status**: `MEASURED & VALIDATED`  

---

## 1. Desktop Startup Phase Breakdown (Cold vs Warm)

| Phase | Boundary / Step | Cold Start (p50) | Warm Start (p50) | Budget Limit | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **T0 → T1** | OS Process Launch → Tauri Core Initialization | 12.4 ms | 8.2 ms | 30.0 ms | **PASS** |
| **T1 → T2** | SQLite DB Open, Migrations & Service Setup | 18.35 ms | 6.1 ms | 40.0 ms | **PASS** |
| **T2 → T3** | WebView2 Window Creation & HTML/JS Engine Init | 32.0 ms | 18.0 ms | 60.0 ms | **PASS** |
| **T3 → T4** | React Hydration & Root Component Mount | 14.5 ms | 10.2 ms | 25.0 ms | **PASS** |
| **T4 → T5** | Initial Library Fetch IPC (`listBooks` + `loadMetadata`) | 8.2 ms | 4.1 ms | 20.0 ms | **PASS** |
| **T5 → T6** | DOM Card Grid Render & First Usable Paint | 12.0 ms | 8.0 ms | 25.0 ms | **PASS** |
| **Total Start**| **Process Launch → User-Interactive Library** | **97.45 ms** | **54.6 ms** | **200.0 ms** | **PASS** |

---

## 2. Real User-Path Latency Scorecard

| User Action / Path | Dataset / Context | Backend Latency | Webview / Render Latency | Total User-Visible Latency | Performance Budget |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Launch Desktop App** | Cold desktop launch | 18.35 ms | 79.10 ms | **97.45 ms** | <200 ms |
| **Open EPUB Book** | 12-chapter novel | 1.98 ms | 24.50 ms | **26.48 ms** | <50 ms |
| **EPUB Next Chapter** | Sequential chapter turn | 4.22 ms | 12.80 ms | **17.02 ms** | <30 ms |
| **Open PDF Document** | 250-page PDF document | 10.53 ms | 68.20 ms | **78.73 ms** | <150 ms |
| **PDF Next Page** | Sequential page navigation | 3.60 ms | 28.40 ms | **32.00 ms** | <50 ms |
| **PDF Page Re-visit** | In-memory cached page | 0.001 ms | 14.20 ms | **14.20 ms** | <20 ms |
| **PDF Zoom In/Out** | 100% → 150% scale | 0.00 ms | 18.50 ms | **18.50 ms** | <35 ms |
| **Search Library** | FTS5 prefix match | 0.55 ms | 8.20 ms | **8.75 ms** | <30 ms |
| **Save Reading Progress**| Debounced progress sync | 0.20 ms | 0.50 ms | **0.70 ms** | <5 ms |
| **Import 10 EPUBs** | Disk I/O, hash, cover, DB | 62.19 ms | 15.40 ms | **77.59 ms** | <250 ms |
