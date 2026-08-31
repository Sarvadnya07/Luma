<div align="center">

# 📖 Luma

**Read beautifully. Annotate reliably. Keep your knowledge. Own your data.**

A modern, distraction-free, local-first reader application for **EPUB** and **PDF** engineered with cryptographic **Annotation Integrity** — ensuring highlights, notes, and bookmarks survive layout changes, font resizing, reflow, and document revisions.

[![Rust](https://img.shields.io/badge/Rust-1.80%2B-orange.svg?logo=rust)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-blue.svg?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61dafb.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6.svg?logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[Getting Started](docs/getting-started/GETTING-STARTED.md) • [Documentation Hub](docs/INDEX.md) • [Architecture](docs/architecture/SYSTEM-ARCHITECTURE.md) • [IPC Reference](docs/reference/TAURI-IPC-API.md) • [Contributing](CONTRIBUTING.md)

</div>

---

## ✨ Key Features

- 🛡️ **Annotation Integrity**: Highlights and notes are cryptographically bound using multi-signal fuzzy anchoring (`Exact`, `PrefixSuffix`, `FuzzySearch`, `StructureFallback`). They never vanish when font sizes change or documents reflow.
- 📚 **Dual-Format Engine**: Native support for **EPUB** (reflowable, spine-aware, continuous/paginated) and **PDF** (canvas rendering, precision text-layer selection).
- 🔒 **Local-First & Private**: All library metadata, books, and annotations live in a high-performance local SQLite database with Write-Ahead Logging (WAL). Zero cloud lock-in.
- ⚡ **High-Performance Architecture**: Core parsing, anchoring, security guards, and database persistence written in pure, memory-safe **Rust**; fluid, reactive interface built with **React 19**, **TypeScript**, and **Tailwind CSS**.
- 🔍 **Full-Text Library Search**: Instant searching across book titles, authors, descriptions, and highlights powered by SQLite FTS5.
- 🗂️ **Library Organization**: Shelves, collections, tags, reading status tracking (`Unread`, `Reading`, `Completed`), and duplicate file ingestion protection.

---

## 🏛️ System Architecture

```text
/
├── apps/
│   └── desktop/          # Tauri 2 + React 19 + TypeScript + Vite desktop application
├── crates/
│   ├── luma-core/        # Domain entities, typed IDs (BookId, AnnotationId), LumaError
│   ├── luma-anchor/      # Resilient fuzzy multi-signal annotation anchoring engine
│   ├── luma-reader/      # Document extractors (EPUB, PDF), spine session abstractions
│   ├── luma-storage/     # SQLite persistence, migrations, and transactional repositories
│   ├── luma-search/      # Full-text search abstractions and SQLite FTS5 integration
│   ├── luma-sync/        # Causality tracking, change records, and version models
│   ├── luma-ai/          # Abstract traits for local/remote LLM integrations
│   └── luma-security/    # Canonical path guards, zip bomb mitigation, SHA-256 hashing
├── packages/
│   ├── shared-types/     # Shared TypeScript domain interfaces mirroring Rust models
│   ├── design-system/    # Theme tokens (Dark, Light, Sepia) and typography
│   ├── ui/               # Reusable atomic UI primitives
│   ├── library-ui/       # Library grid, shelves, filter bars, and import modals
│   ├── reader-ui/        # EPUB reflow viewport and PDF canvas text-layer viewport
│   └── annotation-ui/    # Contextual annotation popups, notes, and anchor badges
└── docs/                 # Diátaxis documentation hub, ADRs, architecture, and guides
```

```mermaid
graph TD
    subgraph Frontend ["Frontend Layer (React 19 + TypeScript)"]
        UI[Desktop Shell / Library & Reader UI]
        State[Zustand State Stores]
        UI --> State
    end

    subgraph Security_Boundary ["Tauri 2 Capability-Secured IPC"]
        IPC[Typed Command Handlers (33 Commands)]
        State --> IPC
    end

    subgraph Rust_Core ["Native Rust Core (crates/*)"]
        IPC --> Core[luma-core]
        IPC --> Anchor[luma-anchor]
        IPC --> Reader[luma-reader]
        IPC --> Storage[luma-storage]
        IPC --> Search[luma-search]
        IPC --> Security[luma-security]
    end

    subgraph Persistence ["Local Storage Layer"]
        Storage --> SQLite[(SQLite WAL + FTS5)]
        Security --> Disk[(Sandboxed Filesystem)]
    end
```

---

## 🚀 Quickstart

### Prerequisites

- **Rust 1.80+** & Cargo
- **Node.js 20+**
- **pnpm 9+** (`pnpm@11.20.0` pinned)
- Tauri 2 OS prerequisites ([Guide](docs/getting-started/GETTING-STARTED.md#1-prerequisites))

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/luma-reader/luma.git
cd luma

# 2. Install dependencies
pnpm install

# 3. Option A: Run web frontend dev server (Rapid UI iteration)
pnpm dev
# -> http://localhost:1420

# 4. Option B: Run full native desktop app (Tauri + SQLite)
pnpm --filter @luma/desktop exec tauri dev
```

---

## 🧪 Testing & Quality Assurance

Run the comprehensive quality gate suite:

```bash
# Rust test suite (domain entities, anchoring resilience, storage repos)
cargo test --workspace

# Frontend Vitest test suite
pnpm test

# TypeScript type checks
pnpm typecheck

# ESLint
pnpm lint

# Rust Clippy (zero warnings enforced)
cargo clippy --workspace -- -D warnings
```

---

## 📚 Documentation Index

Explore the complete documentation set in our **[Documentation Hub](docs/INDEX.md)**:

| Diátaxis Mode | Document | Description |
| :--- | :--- | :--- |
| **Tutorial** | [Getting Started](docs/getting-started/GETTING-STARTED.md) | Step-by-step first launch and document import |
| **How-To** | [Development Workflows](docs/guides/DEVELOPMENT.md) | Dev servers, compilation, formatting, and debugging |
| **How-To** | [Contributing Guide](CONTRIBUTING.md) | Contribution guidelines, branching, and PR standards |
| **How-To** | [Testing Strategy](docs/testing/TEST-STRATEGY.md) | Monorepo test matrices and validation procedures |
| **Reference** | [Tauri IPC API Reference](docs/reference/TAURI-IPC-API.md) | Complete signatures for all 33 IPC commands |
| **Reference** | [Crates & Packages Catalog](docs/reference/CRATES.md) | Architectural breakdown of all 8 crates & 6 packages |
| **Reference** | [Data Model & SQLite Schema](docs/architecture/DATA-MODEL.md) | Database entities, relationships, and indexes |
| **Explanation**| [System Architecture](docs/architecture/SYSTEM-ARCHITECTURE.md) | Layered architecture, security boundary, and data flow |
| **Explanation**| [Annotation Anchoring Engine](docs/architecture/ANNOTATION-INTEGRATION.md) | Multi-signal fuzzy anchor resolution algorithm |
| **Explanation**| [Threat Model & Security](docs/security/THREAT-MODEL.md) | Path sanitization, zip bombs, and IPC permissions |
| **Explanation**| [Architecture Decision Records (ADRs)](docs/adr/ADR-0001-Product-Architecture.md) | 22 recorded architectural decisions |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
