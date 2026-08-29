# ADR-0003: Rust Core Boundary
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Domain models, persistence, security validation, and anchor math must be decoupled from UI and platform-specific windowing code.
- **Decision**: Isolate core logic into 8 single-responsibility crates (`luma-core`, `luma-anchor`, `luma-reader`, `luma-storage`, `luma-search`, `luma-sync`, `luma-ai`, `luma-security`). `luma-core` has zero sibling dependencies.
- **Alternatives Considered**: Monolithic single crate with internal modules.
- **Consequences**: Clear dependency graph, zero circular dependencies, high testability, and isolated compilation boundaries.
