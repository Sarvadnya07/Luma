# Luma

> **Read beautifully. Annotate reliably. Keep your knowledge. Own your data.**

Luma is a modern, distraction-free, local-first reader application for **EPUB** and **PDF** with a core focus on **Annotation Integrity** — ensuring highlights, notes, and bookmarks survive layout changes, font resizing, reflow, and document revisions.

---

## Architecture & Monorepo Structure

```text
/
├── apps/
│   └── desktop/          # Tauri 2 + React 19 + TypeScript + Vite Desktop App
├── crates/
│   ├── luma-core/        # Domain entities, typed IDs, error definitions (WASM-compatible)
│   ├── luma-anchor/      # Resilient fuzzy annotation anchoring engine (WASM-compatible)
│   ├── luma-reader/      # Document reader contracts & format abstractions
│   ├── luma-storage/     # SQLite persistence, migrations, and repositories
│   ├── luma-search/      # Search abstractions & SQLite FTS5 integration
│   ├── luma-sync/        # Sync domain models, change records, version tracking
│   ├── luma-ai/          # AI provider abstractions (no premature implementation)
│   └── luma-security/    # Path validation, hashing, untrusted content sanitization
├── packages/
│   ├── shared-types/     # Shared TypeScript domain types
│   ├── ui/               # Reusable UI primitives
│   ├── design-system/    # Theme tokens & typography
│   ├── reader-ui/        # Reader UI component abstractions
│   ├── library-ui/       # Library management UI abstractions
│   └── annotation-ui/    # Annotation panel UI abstractions
├── docs/
│   ├── product/          # Product foundation specifications
│   ├── architecture/     # System, core, data, and platform architecture
│   ├── adr/              # Architecture Decision Records (ADR-0001 to ADR-0010)
│   ├── spikes/           # Technical spike findings (EPUB, PDF, Anchoring, SQLite, Search)
│   ├── security/         # Security threat model & untrusted content boundary
│   └── testing/          # Testing strategy & corpus index
└── tests/
    ├── fixtures/         # Synthetic EPUB/PDF/text test fixtures
    ├── integration/      # End-to-end and cross-crate integration suites
    └── corpus/           # Reference document corpus metadata
```

---

## Getting Started

### Prerequisites
- **Rust** 1.80+ (with `wasm32-unknown-unknown` target if building for web)
- **Node.js** 20+ and **pnpm** 9+

### Build & Test

```bash
# Install dependencies
pnpm install

# Run Rust tests
cargo test --workspace

# Run Rust linter
cargo clippy --workspace -- -D warnings

# Build Desktop App
pnpm --filter @luma/desktop build
```

---

## License

MIT License (see [LICENSE](LICENSE)).
