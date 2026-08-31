# 📚 Luma Documentation Hub

> **Governing Standard**: Built in strict adherence to the **Diátaxis Documentation Framework** and the **Luma Documentation Kernel**.

Welcome to the central documentation index for **Luma**, the distraction-free, local-first reader application for **EPUB** and **PDF** with cryptographic annotation integrity.

---

## 🧭 Documentation Map (Diátaxis)

```text
                                  ┌────────────────────────┐
                                  │   LUMA DOCUMENTATION   │
                                  └───────────┬────────────┘
                                              │
         ┌───────────────────┬────────────────┴──────────────────┬───────────────────┐
         ▼                   ▼                                   ▼                   ▼
  ┌─────────────┐     ┌─────────────┐                     ┌─────────────┐     ┌─────────────┐
  │  TUTORIALS  │     │   HOW-TO    │                     │  REFERENCE  │     │ EXPLANATION │
  │  (Learning) │     │  (Guides)   │                     │   (Facts)   │     │  (Concepts) │
  └─────────────┘     └─────────────┘                     └─────────────┘     └─────────────┘
```

---

### 1. 🎓 Tutorials (Learning by Doing)
*Guided walkthroughs designed for first-time developers and evaluators to achieve success rapidly.*

- **[Getting Started & First Document Walkthrough](getting-started/GETTING-STARTED.md)**: Set up prerequisites, launch Luma in browser/desktop mode, import your first EPUB/PDF, and create a resilient annotation.

---

### 2. 🛠️ How-To Guides (Task-Oriented)
*Step-by-step operational instructions for completing specific tasks.*

- **[Contributing Guide](../CONTRIBUTING.md)**: Development workflow, pull request guidelines, coding standards, and commit conventions.
- **[Development & Quality Workflows](guides/DEVELOPMENT.md)**: Building, linting (`eslint`, `clippy`), formatting, and running tests.
- **[Testing Strategy & Execution](testing/TEST-STRATEGY.md)**: Workspace test matrices, Rust unit/integration suites, and frontend test suites.
- **[Library Test Matrix](testing/LIBRARY-TEST-MATRIX.md)**: Test scenarios for book ingestion, duplication detection, and trash lifecycle.
- **[Reader Test Matrix](testing/READER-TEST-MATRIX.md)**: Test scenarios for EPUB spine navigation, PDF text layer selection, and anchor recovery.

---

### 3. 📖 Reference (Authoritative Facts & Contracts)
*Technical specifications, schemas, IPC command definitions, and crate registries.*

- **[Tauri IPC Command Reference](reference/TAURI-IPC-API.md)**: Complete signature catalog for all 33 Tauri IPC commands across Library, Reader, Annotation, Search, and Collection domains.
- **[Data Model & SQLite Schema](architecture/DATA-MODEL.md)**: Domain entities (`Book`, `BookFile`, `Annotation`, `Bookmark`, `Collection`, `Tag`), primary keys, and relationships.
- **[Library Data Model](architecture/LIBRARY-DATA-MODEL.md)**: Separation of conceptual `Book` from physical `BookFile` and trash semantics.
- **[Workspace Crates & Packages Catalog](reference/CRATES.md)**: Detailed breakdown of the 8 Rust crates (`luma-core`, `luma-anchor`, `luma-reader`, etc.) and 6 TypeScript packages.
- **[Dependency Policy](architecture/DEPENDENCY-POLICY.md)**: Strict rules on external crates, bundle sizes, and WASM compatibility.

---

### 4. 🧠 Explanation & Architecture (Mental Models & Rationale)
*Deep architectural explanations, system designs, threat models, and architectural decisions.*

- **[System Architecture](architecture/SYSTEM-ARCHITECTURE.md)**: High-level overview of UI, Tauri IPC security boundary, Rust native core, and SQLite storage layer.
- **[Core Architecture](architecture/CORE-ARCHITECTURE.md)**: Rust domain modeling, error hierarchy (`LumaError`), typed IDs (`BookId`, `AnnotationId`), and WASM boundary.
- **[Annotation Integration & Anchoring Engine](architecture/ANNOTATION-INTEGRATION.md)**: Fuzzy multi-signal anchoring algorithm (`Exact`, `PrefixSuffix`, `FuzzySearch`, `StructureFallback`).
- **[EPUB Reader Architecture](architecture/EPUB-READER.md)**: Reflow rendering, spine navigation, and DOM selection context extraction.
- **[PDF Reader Architecture](architecture/PDF-READER.md)**: Canvas-based rendering, text-layer overlay, and normalized bounding box coordinates.
- **[Import Pipeline & Deduplication](architecture/IMPORT-PIPELINE.md)**: Ingestion validation, SHA-256 content hashing, cover image extraction, and metadata normalization.
- **[Threat Model & Security Architecture](security/THREAT-MODEL.md)**: Path traversal defenses, zip bomb protection, IPC permission guards, and content sanitization.
- **[Architectural Decision Records (ADRs)](adr/ADR-0001-Product-Architecture.md)**: Full catalog of 22 recorded architectural decisions (ADR-0001 through ADR-0022).

---

## 📊 Documentation Maintenance & Governance

| Category | Source of Truth | Verification Trigger | Review Frequency |
| :--- | :--- | :--- | :--- |
| **IPC API Reference** | `apps/desktop/src-tauri/src/commands/` | On any command signature change | Continuous via CI |
| **Data Models** | `crates/luma-core/`, `crates/luma-storage/` | On migration / struct changes | Continuous via CI |
| **Architecture** | Rust crate implementations & ADRs | On design modifications | Quarterly |
| **Getting Started** | `package.json`, `Cargo.toml` | On toolchain / dependency upgrade | Per release |
