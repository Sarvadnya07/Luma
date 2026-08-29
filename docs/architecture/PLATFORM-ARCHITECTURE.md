# Luma — Platform Architecture

## 1. Desktop Shell (Tauri 2)

Luma chooses Tauri 2 as its primary desktop application runtime for:
1. **Resource Efficiency**: Webview-backed UI with native Rust core consumes < 80MB RAM at idle compared to 300MB+ for Electron.
2. **Security Sandbox**: Capability-based permissions restrict frontend IPC to explicit commands. No arbitrary disk or node native execution.
3. **Multi-Platform Support**: Native Windows (WebView2), macOS (WKWebView), and Linux (WebKitGTK) support.

---

## 2. WASM Boundary Strategy

### 2.1 WASM-Compatible Modules
- `luma-core`: Domain models, IDs, serializations, and error structures.
- `luma-anchor`: Unicode normalization, Levenshtein distance, tokenization, and multi-signal fuzzy matching engine.
- `luma-reader`: Text extraction and TOC parser modules.

### 2.2 Native-Only Modules
- `luma-storage`: Direct SQLite filesystem access, WAL journal management, and OS file locking.
- `luma-security`: OS path resolution and native file I/O security guards.
- `luma-desktop`: Tauri OS windowing and system tray integration.

### 2.3 WASM Target
Crates compile cleanly to `wasm32-unknown-unknown` using `wasm-bindgen` without requiring `std::fs` or native OS sockets.
