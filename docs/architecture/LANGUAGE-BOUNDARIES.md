# Luma — Language Responsibilities & Architectural Boundaries

## 1. Principle of Language Allocation

Luma adheres to a strict division of responsibility between **TypeScript** and **Rust**:

```text
TypeScript for the Experience.
Rust for the Difficult Parts.
```

---

## 2. TypeScript Responsibilities
The TypeScript layer (`apps/desktop/src` and `packages/*`) is responsible for:
1. **User Interface**: React 19 visual components, layout grids, sliding drawers, modals, responsive styling via Tailwind CSS.
2. **Reading Presentation**: Injecting live CSS overrides (font size, font family, line spacing, margins, themes) dynamically into chapter viewports without mutating source files.
3. **Frontend State & Ephemeral UI**: Managing active tabs, selected books, open drawers, active modals, text selection coordinates, and live search queries via Zustand.
4. **Input & Gesture Handling**: Mouse selection, touch events, keyboard shortcut listeners (`ArrowLeft`/`ArrowRight`, `T`, `A`, `B`, `F`, `Esc`).
5. **Typed IPC Bridge**: Centralized API clients (`LumaApi`) invoking native backend commands with full TypeScript interface typing.

---

## 3. Rust Responsibilities
The Rust layer (`crates/*` and `apps/desktop/src-tauri`) is responsible for:
1. **Domain Models & Identifiers**: Strongly typed UUID v7 IDs (`BookId`, `FileId`, `AnnotationId`), timestamping, and sync metadata.
2. **Document Extraction & Formats**: Safe ZIP archive decompression, Dublin Core OPF XML parsing, spine reading order resolution, PDF outline extraction, and layered format sniffing.
3. **Annotation Anchoring (`luma-anchor`)**: Text normalization (Unicode NFKD), multi-signal composite anchor generation, sliding-window fuzzy matching, confidence scoring, and ambiguity gating.
4. **Storage & Transactional Persistence (`luma-storage`)**: SQLite database connections in WAL mode with foreign keys, versioned schema migrations, and entity repositories.
5. **Full-Text Search (`luma-search`)**: SQLite FTS5 index maintenance, prefix query tokenization, and ranking.
6. **Security & Sandboxing (`luma-security`)**: Canonical path verification, directory traversal prevention, decompression bomb limits, and HTML markup sanitization.
7. **WASM-Compatible Shared Core**: Core models and anchor resolution logic compiled to `wasm32-unknown-unknown` for portable cross-platform execution.
