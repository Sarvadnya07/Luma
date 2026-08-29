# ADR-0001: Product Architecture Direction
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Luma requires a high-performance, local-first reading experience with robust annotation integrity for EPUB and PDF formats.
- **Decision**: Adopt a hybrid architecture composed of a Rust Core for business logic, persistence, and fuzzy anchoring, combined with a React/TypeScript webview frontend running inside a Tauri 2 desktop shell.
- **Alternatives Considered**: Electron (too heavy/high memory usage), Flutter (weak DOM/EPUB reflow support), pure native multi-codebase (prohibitive maintenance overhead across platforms).
- **Consequences**: Fast startup, low memory footprint (<80MB idle), portable core logic, and clean separation between UI and system logic.
