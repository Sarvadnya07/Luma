# Luma — System Architecture

## 1. High-Level Architecture Overview

Luma employs a layered, local-first desktop architecture combining high-performance native Rust core engines with a modern, responsive React/TypeScript UI connected via Tauri v2's capability-secured IPC.

```mermaid
graph TD
    subgraph UI_Layer ["Frontend / UI Layer (React 19 + TypeScript)"]
        UI_Shell[Desktop Shell & Window Manager]
        UI_Reader[Reader Engine Viewport]
        UI_Library[Library & Metadata View]
        UI_Annotations[Annotation & Highlights Inspector]
        UI_State[Zustand State Store]
    end

    subgraph IPC_Layer ["Tauri 2 IPC Security Boundary"]
        IPC_Bridge[Typed Tauri Command Handlers]
        Cap_Policy[Capability & Permission Policy]
    end

    subgraph Native_Core ["Rust Native / WASM Core Crates"]
        Core[luma-core: Domain & IDs]
        Anchor[luma-anchor: Fuzzy Multi-Signal Anchor Engine]
        Reader[luma-reader: Document & Spine Abstractions]
        Storage[luma-storage: SQLite Repositories & Migrations]
        Search[luma-search: Search & Index Engine]
        Sync[luma-sync: Causality & Change Records]
        Security[luma-security: Path Guards & Sanitizers]
    end

    subgraph Storage_Layer ["Persistent Local Storage"]
        DB[(SQLite Embedded Database)]
        FS[(Local Sandboxed Document Store)]
    end

    UI_Reader --> UI_State
    UI_Library --> UI_State
    UI_Annotations --> UI_State
    UI_State --> IPC_Bridge
    IPC_Bridge --> Cap_Policy
    Cap_Policy --> Core
    Cap_Policy --> Anchor
    Cap_Policy --> Storage
    Cap_Policy --> Reader
    Storage --> DB
    Security --> FS
```

---

## 2. Layer Responsibilities

### 2.1 UI Layer (`apps/desktop/src`, `packages/*`)
- **Rendering**: DOM-based EPUB reflow viewport, canvas-based high-DPI PDF renderer.
- **Selection Handling**: Intercepts user text selection and extracts surrounding text contexts (prefix/suffix).
- **State**: Ephemeral viewport state, active typography settings, and UI modals via Zustand.

### 2.2 IPC & Security Boundary (`src-tauri`)
- Minimalist command gateway.
- Capability-based security: No arbitrary filesystem read/write or raw shell execution allowed from the frontend.
- Deserialization and validation of all payloads before touching core business logic.

### 2.3 Rust Core Workspace (`crates/*`)
- **Zero UI Assumptions**: All domain logic, anchor calculations, schema queries, and document parsing are pure Rust.
- **Dual Compilation**: `luma-core` and `luma-anchor` are decoupled from OS-specific APIs and can compile to `wasm32-unknown-unknown` for web workers or browser contexts.
- **Persistence**: Managed via `rusqlite` with Write-Ahead Logging (WAL) and migrations.

---

## 3. Data Flow

1. **Document Ingestion**: User imports a file $\rightarrow$ `luma-security` validates path and runs archive bomb check $\rightarrow$ SHA-256 hash computed $\rightarrow$ `luma-reader` extracts metadata $\rightarrow$ `luma-storage` persists `Book` and `BookFile` in SQLite.
2. **Annotation Creation**: User highlights text in Reader $\rightarrow$ UI extracts quote, prefix, suffix, and CFI/PDF rect $\rightarrow$ IPC sends `save_annotation` $\rightarrow$ `luma-storage` records annotation $\rightarrow$ `luma-sync` logs `ChangeRecord`.
3. **Anchor Resolution**: When reading with modified font size/line spacing or document revision $\rightarrow$ `luma-anchor` evaluates candidates across normalized text $\rightarrow$ calculates confidence score $\rightarrow$ returns verified highlight coordinates or flags ambiguity.
