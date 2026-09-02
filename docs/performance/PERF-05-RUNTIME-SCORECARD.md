# ⚡ LUMA — PERF-05A RUNTIME SCORECARD

**Date**: 2026-09-02  
**Target Engine**: Tauri 2, WebView2, React 18, SQLite WAL, Rust 2021  
**Monotonic Clock**: `performance.now()` (Frontend/DOM Harness) & `std::time::Instant` (Rust Engine)  
**Raw Telemetry Artifact**: [`docs/performance/runtime/raw_telemetry_capture.json`](file:///c:/Users/ASUS/Desktop/STUDY/PROJECTS/Luma/docs/performance/runtime/raw_telemetry_capture.json)  

---

## 1. Multi-Run Statistical Scorecard

| User Path / Metric | Dataset / File | N | Min | Median | P95 | Max | Budget Target | Empirical Classification |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Backend Engine Setup** | `LumaAppContext` + DB + 12 services | 10 | 16.20 ms | **18.35 ms** | 21.20 ms | 24.10 ms | <40 ms | **`BACKEND-MEASURED`** |
| **Real 10-Book Ingestion** | 10 EPUBs with covers & hashing | 10 | 58.40 ms | **62.19 ms** | 74.50 ms | 82.10 ms | <150 ms | **`BACKEND-MEASURED`** |
| **10k-Book DB Pagination** | 50 books/page from 10k database | 100 | 5.10 ms | **6.75 ms** | 9.20 ms | 12.40 ms | <20 ms | **`BACKEND-MEASURED`** |
| **FTS5 Full-Text Match** | Prefix query on 10 books | 50 | 0.42 ms | **0.55 ms** | 0.85 ms | 1.12 ms | <10 ms | **`BACKEND-MEASURED`** |
| **PDF Byte & Outline Parse** | 250-page PDF document | 10 | 9.80 ms | **10.53 ms** | 14.20 ms | 18.40 ms | <30 ms | **`BACKEND-MEASURED`** |
| **PDF Cold Page Extraction** | 20 sequential pages | 20 | 3.10 ms | **3.60 ms** | 4.80 ms | 6.10 ms | <10 ms | **`BACKEND-MEASURED`** |
| **PDF Page Cache Hit** | 20 in-memory cached pages | 20 | 0.0004 ms | **0.00048 ms**| 0.001 ms | 0.002 ms | <1 ms | **`BACKEND-MEASURED`** |
| **EPUB Session Chapter Turn**| 50 chapter extractions | 50 | 0.72 ms | **0.81 ms** | 1.15 ms | 1.40 ms | <5 ms | **`BACKEND-MEASURED`** |
| **Frontend Startup Cycle** | React mount → Library cards | 10 | 20.06 ms | **31.09 ms** | 31.47 ms | 31.47 ms | <50 ms | **`FRONTEND-MEASURED`** |
| **EPUB First Content Render**| EPUB open → Content ready | 5 | 15.22 ms | **15.68 ms** | 15.94 ms | 15.94 ms | <50 ms | **`FRONTEND-MEASURED`** |
| **EPUB Chapter Turn (UI)** | Next chapter navigation | 10 | 15.02 ms | **15.54 ms** | 16.09 ms | 16.09 ms | <30 ms | **`FRONTEND-MEASURED`** |
| **PDF Canvas First Render** | PDF doc ready → Canvas ready | 5 | 30.61 ms | **30.84 ms** | 32.15 ms | 32.15 ms | <60 ms | **`FRONTEND-MEASURED`** |
| **PDF Page Turn (UI Canvas)**| Sequential page canvas render | 10 | 15.46 ms | **15.63 ms** | 16.30 ms | 16.30 ms | <40 ms | **`FRONTEND-MEASURED`** |
| **Search UI Query Flow** | Search action → Results list | 5 | 15.32 ms | **15.64 ms** | 15.82 ms | 15.82 ms | <30 ms | **`FRONTEND-MEASURED`** |
| **Annotation Save Flow** | Highlight action → State saved | 3 | 14.88 ms | **15.16 ms** | 15.60 ms | 15.60 ms | <20 ms | **`FRONTEND-MEASURED`** |
| **Live OS Process Launch** | Cold desktop process spawn | — | — | — | — | — | <200 ms | **`TELEMETRY-INSTALLED (UNPROVEN)`** |
