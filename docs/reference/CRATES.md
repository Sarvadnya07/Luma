# 📦 Workspace Crates & Packages Catalog

> **Diátaxis Mode**: Reference  
> **Source of Truth**: `Cargo.toml`, `pnpm-workspace.yaml`  
> **Audience**: Systems engineers, contributors, and package maintainers.

The Luma monorepo is structured as a dual workspace consisting of **8 native Rust crates** and **6 TypeScript frontend packages**, connected via the Tauri 2 desktop application shell.

---

## 1. Native Rust Crates (`crates/*`)

All Rust crates are managed via the root `Cargo.toml` workspace.

```text
crates/
├── luma-core/        # Domain types, strong IDs, error types, timestamps
├── luma-anchor/      # Resilient fuzzy multi-signal annotation anchoring engine
├── luma-reader/      # Document format extractors (EPUB, PDF), spine sessions
├── luma-storage/     # SQLite migrations, connection pools, and repositories
├── luma-search/      # Full-text search abstractions and SQLite FTS5 integration
├── luma-sync/        # Synchronization causality tracking and change records
├── luma-ai/          # AI provider traits and abstractions
└── luma-security/    # Safe path traversal guards, SHA-256 hashing, archive defense
```

### Detailed Crate Specifications

| Crate | Responsibility | Key Dependencies | WASM Ready |
| :--- | :--- | :--- | :--- |
| **`luma-core`** | Fundamental entities (`Book`, `BookFile`, `Annotation`, `Bookmark`), typed IDs (`BookId`, `AnnotationId`), and the `LumaError` hierarchy. | `serde`, `chrono`, `uuid`, `thiserror` | ✅ Yes |
| **`luma-anchor`** | Multi-signal fuzzy matching engine that resolves annotations across font size shifts, CSS reflow, and text edits. | `luma-core`, `unicode-normalization`, `regex` | ✅ Yes |
| **`luma-reader`** | Ingests `.epub` (via `zip` & `quick-xml`) and `.pdf`, extracting spine manifests, metadata, cover images, and text content. | `luma-core`, `luma-security`, `zip`, `quick-xml` | ⚠️ Native / Future WASM |
| **`luma-storage`** | Persistent SQLite store with schema migrations, WAL mode, transaction management, and domain repositories. | `luma-core`, `rusqlite` | ❌ Native Only |
| **`luma-search`** | SQLite FTS5 full-text indexing over library metadata and extracted annotation content. | `luma-core`, `luma-storage` | ❌ Native Only |
| **`luma-sync`** | Causality logs, vector clocks, and change record serialization for future peer-to-peer sync. | `luma-core`, `serde` | ✅ Yes |
| **`luma-ai`** | Abstract interface for local/remote LLM interactions (summarization, glossary generation). | `luma-core`, `async-trait` | ✅ Yes |
| **`luma-security`** | Canonical path validation, zip bomb mitigation, SHA-256 hashing, and input sanitization. | `sha2`, `hex` | ✅ Yes |

---

## 2. TypeScript Frontend Packages (`packages/*`)

All frontend packages are managed via pnpm workspaces (`pnpm-workspace.yaml`).

```text
packages/
├── shared-types/     # Shared TypeScript domain interfaces mirroring Rust models
├── design-system/    # Typography, color tokens, and theme definitions
├── ui/               # Reusable atomic UI components (Buttons, Inputs, Modals)
├── library-ui/       # Book grid, shelf list, filter bar, and import dialogs
├── reader-ui/        # EPUB reflow viewport, PDF canvas viewport, navigation controls
└── annotation-ui/    # Highlight inspector, note editor, and anchor status badge
```

### Detailed Package Specifications

| Package | Purpose | Export Entry |
| :--- | :--- | :--- |
| **`@luma/shared-types`** | Synchronized TypeScript definitions for books, annotations, reading progress, and IPC payloads. | `src/index.ts` |
| **`@luma/design-system`** | Design tokens, Tailwind configurations, fonts, and dark/light/sepia reading themes. | `src/index.ts` |
| **`@luma/ui`** | Headless and styled atomic UI primitives built for desktop responsiveness. | `src/index.tsx` |
| **`@luma/library-ui`** | Library overview, book card grids, trash view, and collection organizers. | `src/index.tsx` |
| **`@luma/reader-ui`** | Continuous scroll and paginated reader views, spine loaders, and text selection handlers. | `src/index.tsx` |
| **`@luma/annotation-ui`** | Contextual annotation popups, sidebar note managers, and anchor resolution indicators. | `src/index.tsx` |

---

## 3. Desktop Application Shell (`apps/desktop`)

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand state stores.
- **Backend Shell**: Tauri 2 (`apps/desktop/src-tauri`), registering the 33 IPC commands and initializing the SQLite database at `./data/luma.db`.
