# Luma

> Read beautifully. Annotate reliably. Keep your knowledge. Own your data.

Luma is a modern, distraction-free, local-first reader application for **EPUB** and **PDF** with a core focus on **Annotation Integrity**: ensuring highlights, notes, and bookmarks survive layout changes, font resizing, reflow, and document revisions.

---

## Architecture & Monorepo Structure

```text
/
|-- apps/
|   `-- desktop/          # Tauri 2 + React + TypeScript + Vite desktop app
|-- crates/
|   |-- luma-core/        # Domain entities, typed IDs, error definitions
|   |-- luma-anchor/      # Resilient fuzzy annotation anchoring engine
|   |-- luma-reader/      # Document reader contracts and extractors
|   |-- luma-storage/     # SQLite persistence, migrations, and repositories
|   |-- luma-search/      # Search abstractions and SQLite FTS5 integration
|   |-- luma-sync/        # Sync domain models, change records, version tracking
|   |-- luma-ai/          # AI provider abstractions
|   `-- luma-security/    # Path validation, hashing, content sanitization
|-- packages/
|   |-- shared-types/     # Shared TypeScript domain types
|   |-- ui/               # Reusable UI primitives
|   |-- design-system/    # Theme tokens and typography
|   |-- reader-ui/        # Reader UI component abstractions
|   |-- library-ui/       # Library management UI abstractions
|   `-- annotation-ui/    # Annotation panel UI abstractions
|-- docs/                 # Product, architecture, ADR, spike, and test docs
`-- tests/                # Fixtures, integration suites, and corpus metadata
```

---

## Getting Started

### Prerequisites

- Rust 1.80+ and Cargo
- Node.js 20+
- pnpm 9+; this repository currently pins `pnpm@11.20.0`
- Tauri 2 system dependencies for your OS
  - Windows: Microsoft WebView2 Runtime and Visual Studio C++ Build Tools
  - macOS/Linux: install the platform packages listed in the Tauri prerequisites

### Install Dependencies

Run this from the repository root:

```bash
pnpm install
```

### Run the App

For frontend development in a browser:

```bash
pnpm dev
```

This starts the Vite dev server for `apps/desktop` at:

```text
http://localhost:1420
```

For the full desktop app with the Tauri shell:

```bash
pnpm --filter @luma/desktop exec tauri dev
```

### Build

Build all TypeScript workspace packages:

```bash
pnpm build
```

Build the installable desktop app:

```bash
pnpm --filter @luma/desktop exec tauri build
```

Tauri build artifacts are written under:

```text
apps/desktop/src-tauri/target/release/bundle/
```

### Test and Quality Checks

Run the Rust test suite:

```bash
cargo test --workspace
```

Run frontend tests:

```bash
pnpm test
```

Run TypeScript type checks:

```bash
pnpm typecheck
```

Run ESLint:

```bash
pnpm lint
```

Run Clippy:

```bash
cargo clippy --workspace -- -D warnings
```

Format Rust code:

```bash
cargo fmt --all
```

---

## License

MIT License. See [LICENSE](LICENSE).
