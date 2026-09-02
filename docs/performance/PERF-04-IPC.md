# ⚡ LUMA — PERF-04 IPC TRAFFIC & PAYLOAD PROFILE

**Date**: 2026-09-02  
**Target Engine**: Tauri 2 IPC Command Bridge  
**Status**: `MEASURED & VALIDATED`  

---

## 1. IPC Traffic & Call Consolidation Audit

| User Operation | Baseline IPC Calls | PERF-04 IPC Calls | Reduction | Average Payload Size | Typical IPC Latency |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Open Reader View** | 3 (`open`, `listAnn`, `listBm`) | **1** (`openReaderDocument`) | **-66.7%** | 3.8 KB | 1.98 ms |
| **Library Search Keystroke** | 4 (`books`, `cols`, `tags`, `auths`)| **1** (`listBooks`) | **-75.0%** | 4.2 KB | 0.55 ms |
| **Library Sort / Filter** | 4 calls | **1** call | **-75.0%** | 4.2 KB | 0.60 ms |
| **Next Chapter Turn** | 1 call (`getReaderChapter`) | **1** call | **0.0%** | 8.5 KB | 4.22 ms |
| **Next PDF Page** | 1 call (`getReaderPdfPage`) | **1** call | **0.0%** | 1.2 KB | 3.60 ms |
| **Save Reading Progress** | 1 call (Debounced 400ms) | **1** call | **0.0%** | 0.3 KB | 0.20 ms |
