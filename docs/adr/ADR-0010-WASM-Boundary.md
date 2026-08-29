# ADR-0010: WASM Boundary
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Core domain models and anchor calculations should run both natively in desktop Rust and in WebAssembly contexts (web workers / browser).
- **Decision**: Keep `luma-core` and `luma-anchor` free of OS-specific filesystem and socket dependencies, verifying clean compilation to `wasm32-unknown-unknown`.
- **Alternatives Considered**: Native-only Rust core with full FFI or Node bindings.
- **Consequences**: High portability, ability to run anchor verification in background web workers without IPC overhead.
