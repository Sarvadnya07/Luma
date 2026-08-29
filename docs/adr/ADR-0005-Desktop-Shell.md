# ADR-0005: Desktop Shell
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Need a lightweight desktop shell with native OS windowing and strong security isolation.
- **Decision**: Choose Tauri v2 with explicit capability permissions (`capabilities/default.json`) and typed IPC command handlers.
- **Alternatives Considered**: Electron, Wails, Neutralino.js.
- **Consequences**: Ultra-low memory usage, native OS webview utilization (WebView2/WebKit), hardened security sandbox.
