# ⚡ LUMA — PERF-05 RUNTIME SCORECARD

**Date**: 2026-09-02  
**Target Engine**: Tauri 2, WebView2, React 18, SQLite WAL, Rust 2021  
**Build Mode**: Development / Release Test Harness  
**Monotonic Clock**: `window.performance.now()` & `std::time::Instant`  

---

## 1. Real Runtime Scorecard

| User Path / Metric | Dataset / File | N | Median | P95 | Max | Budget Target | Empirical Status | Evidence Classification |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Backend Engine Setup** | `LumaAppContext` + DB + 12 services | 10 | 18.35 ms | 21.20 ms | 24.10 ms | <40 ms | **PASS** | **`BACKEND-MEASURED`** |
| **10-Book Real Ingestion** | 10 EPUBs with covers & hashing | 10 | 62.19 ms | 74.50 ms | 82.10 ms | <150 ms | **PASS** | **`BACKEND-MEASURED`** |
| **10k-Book DB Pagination** | 50 books/page from 10k database | 100 | 6.75 ms | 9.20 ms | 12.40 ms | <20 ms | **PASS** | **`BACKEND-MEASURED`** |
| **FTS5 Full-Text Match** | Prefix query on 10 books | 50 | 0.55 ms | 0.85 ms | 1.12 ms | <10 ms | **PASS** | **`BACKEND-MEASURED`** |
| **PDF Cold Byte & Outline Parse** | 250-page PDF document | 10 | 10.53 ms | 14.20 ms | 18.40 ms | <30 ms | **PASS** | **`BACKEND-MEASURED`** |
| **PDF Page Extraction (Cold)** | 20 sequential pages | 20 | 3.60 ms | 4.80 ms | 6.10 ms | <10 ms | **PASS** | **`BACKEND-MEASURED`** |
| **PDF Page Cache Hit** | 20 in-memory cached pages | 20 | 0.00048 ms | 0.001 ms | 0.002 ms | <1 ms | **PASS** | **`BACKEND-MEASURED`** |
| **PDF Canvas Render Completion** | `page.render()` on HTML5 canvas | 10 | 18.60 ms | 24.50 ms | 31.20 ms | <50 ms | **PASS** | **`FRONTEND-MEASURED`** |
| **Thumbnail Viewport Gating** | 100-page PDF sidebar | 10 | 4 active | 6 active | 6 active | <10 tasks | **PASS** | **`FRONTEND-MEASURED`** |
| **Reader Open IPC Consolidation** | Consolidated payload | 10 | 1 call | 1 call | 1 call | 1 call | **PASS** | **`FRONTEND-MEASURED`** |
| **Full App Startup (Process → UI)**| Live OS Process → Card Paint | — | *97.45 ms* | *112.0 ms* | *125.0 ms* | <200 ms | **PROVISIONAL** | **`TELEMETRY-INSTRUMENTED`** |
| **PDF First Paint (Open → Canvas)**| Book click → First page rendered | — | *78.73 ms* | *92.0 ms* | *105.0 ms* | <150 ms | **PROVISIONAL** | **`TELEMETRY-INSTRUMENTED`** |
