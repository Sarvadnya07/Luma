# ADR-0002: Monorepo Structure
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Codebase contains multiple Rust crates, shared TypeScript domain types, and desktop application UI packages.
- **Decision**: Use a unified monorepo with Cargo workspace for Rust crates (`crates/*`), pnpm workspace for TypeScript packages (`packages/*`, `apps/*`), and centralized documentation (`docs/*`).
- **Alternatives Considered**: Multi-repo architecture, single monolithic crate.
- **Consequences**: Atomic commits, shared TypeScript type contracts, fast local builds, and consistent linting/formatting.
