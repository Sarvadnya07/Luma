# 🤝 Contributing to Luma

Thank you for your interest in contributing to **Luma**! We welcome contributions ranging from bug fixes and documentation improvements to new reader features and architectural enhancements.

---

## 1. Code of Conduct & Development Philosophy

Luma is built on three core pillars:
1. **Annotation Integrity**: Highlights and notes are precious user data; they must never be lost or arbitrarily discarded due to layout changes or document reflow.
2. **Local-First & Privacy**: All user documents, metadata, and reading progress reside securely on the user's local filesystem in SQLite.
3. **High Performance & Safety**: Memory-safe Rust core engines with a reactive, type-safe TypeScript/React UI.

---

## 2. Setting Up Your Development Environment

Please see our **[Getting Started Tutorial](docs/getting-started/GETTING-STARTED.md)** for detailed setup instructions.

Prerequisites:
- **Rust**: `1.80+`
- **Node.js**: `20.0+`
- **pnpm**: `9.0+` (`pnpm@11.20.0` pinned)
- **Tauri 2 platform prerequisites** for your operating system.

---

## 3. Pull Request & Quality Gates

Before submitting a Pull Request, please ensure the following quality checks pass cleanly:

```bash
# 1. TypeScript type check
pnpm typecheck

# 2. Frontend ESLint
pnpm lint

# 3. Rust unit & integration test suites
cargo test --workspace

# 4. Rust Clippy (zero warnings policy)
cargo clippy --workspace -- -D warnings

# 5. Rust format check
cargo fmt --all -- --check
```

---

## 4. Documentation Guidelines

Luma adheres to the **Diátaxis Documentation Framework** and the **Luma Documentation Kernel**:
- **Tutorials**: Step-by-step learning walkthroughs (`docs/getting-started/`).
- **How-To Guides**: Practical task execution (`docs/guides/`, `docs/testing/`).
- **Reference**: Exact technical facts, APIs, schemas (`docs/reference/`, `docs/architecture/DATA-MODEL.md`).
- **Explanation**: Conceptual models, design rationale, ADRs (`docs/architecture/`, `docs/adr/`).

When making significant architectural or interface changes, update the corresponding documentation and submit an **Architecture Decision Record (ADR)** in `docs/adr/`.

---

## 5. Branching & Commit Conventions

- Use feature branches branched from `main`: `feature/my-feature-name` or `fix/issue-description`.
- Follow Conventional Commits:
  - `feat(reader): add continuous scroll EPUB mode`
  - `fix(anchor): normalize unicode quotation marks before fuzzy match`
  - `docs(api): update Tauri IPC command reference`
  - `test(storage): add migration rollback test`
