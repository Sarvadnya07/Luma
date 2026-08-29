# LUMA — PHASE 00: PRODUCT FOUNDATION
**Status: APPROVED & LOCKED**  
**Document Version: 1.0.0**  
**Classification: Source of Truth**

---

## 1. Product Identity & Philosophy

### 1.1 Name
**Luma**

### 1.2 Tagline & Mission
> **Read beautifully. Annotate reliably. Keep your knowledge. Own your data.**

Luma is a modern, distraction-free, local-first reader application engineered for deep reading, scholarly research, and lifelong knowledge retention.

### 1.3 Core Tenets
1. **Local-First & Privacy-First**: All data, highlights, notes, metadata, and reading telemetry reside on the user's physical machine. No compulsory cloud accounts, no third-party tracking, zero vendor lock-in.
2. **First-Class Formats**: Equal, uncompromising support for both reflowable **EPUB** (EPUB 2 / EPUB 3) and fixed-layout **PDF**.
3. **Annotation Integrity (P0 Differentiator)**: Annotations (highlights, notes, underlines, tags) are durable entities anchored across layout mutations, window resizing, font scaling, reflow, and document revisions. A highlight must never silently drift or misattach.
4. **Clean Craft & Distraction-Free UI**: The user interface disappears during active reading, giving uninterrupted focus to the text.
5. **Standards-Compliant & Extensible**: Uses standard formats, portable schemas (JSON/SQLite), open locators (EPUB CFI, W3C Web Annotation Data Model, PDF rects), and clean architecture boundaries.

---

## 2. Target Users & Personas

- **The Deep Reader / Bibliophile**: Reads long-form literature, essays, and non-fiction; values visual elegance, custom typography, and zero distractions.
- **The Scholar / Researcher**: Analyzes dense academic papers, monographs, and textbooks; requires multi-color highlights, precise quotes, footnote navigation, and fast search.
- **The Technical Professional**: Reads technical documentation and engineering specifications; requires monospace support, code block legibility, and exportable notes.

---

## 3. Scope Boundaries & Out of Scope (Phase 1 Baseline)

| In Scope (Phase 0/1 Foundation) | Explicitly Out of Scope (Premature for Phase 1) |
| :--- | :--- |
| Core domain models & strongly typed IDs | Cloud sync server or centralized accounts |
| Robust multi-signal annotation anchoring engine | Production AI / LLM summary integrations |
| SQLite persistence, migrations & repository layer | Community plugins / marketplace ecosystem |
| Desktop shell via Tauri 2 & React 19 / TypeScript | Social reading feeds or collaborative sharing |
| Architecture validation spikes (EPUB, PDF, Search, Storage, Anchor) | Mobile apps (iOS/Android native builds) |
| Security threat model for untrusted documents | DRM decryption or proprietary book store integration |

---

## 4. Architectural Baseline

- **Application Shell**: Tauri 2 desktop shell providing native windowing, secure isolated IPC, and OS integration with minimal memory footprint.
- **Core Domain & Engines**: Rust workspace (`luma-core`, `luma-anchor`, `luma-reader`, `luma-storage`, `luma-search`, `luma-sync`, `luma-ai`, `luma-security`).
- **WASM Support**: Core logic (normalization, fuzzy anchoring, serialization) compiles to `wasm32-unknown-unknown` for web/isolated worker execution.
- **Frontend Architecture**: React 19 + TypeScript + Vite + Tailwind CSS with strict typing and feature-oriented modules.
- **Storage**: Embedded SQLite with WAL mode, strict foreign keys, schema versioning, and repository isolation.
