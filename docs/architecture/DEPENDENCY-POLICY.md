# Luma — Dependency Policy & Ecosystem Criteria

## 1. Principles

To prevent bloat, security vulnerabilities, and platform lock-in, all dependencies in Luma are vetted against strict criteria:

1. **Permissive Licensing**: Dependencies must carry MIT, Apache-2.0, or BSD licenses. Strict AGPL/GPL dependencies are prohibited.
2. **WASM Compatibility**: Core crates (`luma-core`, `luma-anchor`) must only include dependencies that compile cleanly to `wasm32-unknown-unknown` with zero native OS syscall dependencies.
3. **Minimal Frontend Weight**: Avoid massive Node/JS ecosystems. Prefer lean, modular libraries (e.g. Zustand, Lucide-React).
4. **Rust First for Complex Parsing**: Heavy parsing (EPUB container unpacking, OPF XML, PDF layout) is handled in memory-safe Rust rather than heavy npm packages.

---

## 2. Audited Dependency Table

| Layer | Dependency | License | Purpose | WASM Clean |
| :--- | :--- | :--- | :--- | :--- |
| **Rust Core** | `serde` / `serde_json` | MIT / Apache-2.0 | Serialization | Yes |
| **Rust Core** | `uuid` (v7) | MIT / Apache-2.0 | Time-ordered IDs | Yes |
| **Rust Core** | `chrono` | MIT / Apache-2.0 | Timestamping | Yes |
| **Rust Anchor** | `unicode-normalization` | MIT / Apache-2.0 | NFKD Normalization | Yes |
| **Rust Storage** | `rusqlite` (bundled) | MIT | SQLite database | Native (host) |
| **Rust Reader** | `zip` (deflate) | MIT | EPUB unzipping | Native (host) |
| **Rust Reader** | `quick-xml` | MIT | OPF/NCX XML parsing | Native (host) |
| **Frontend** | `react` (v18.3.1) / `react-dom` | MIT | UI rendering | Web / Desktop |
| **Frontend** | `zustand` (v5.0.0) | MIT | State management | Web / Desktop |
| **Frontend** | `lucide-react` (v0.441.0) | ISC | Iconography | Web / Desktop |
| **Frontend** | `tailwindcss` (v3.4.11) | MIT | Utility styling | Web / Desktop |
| **Shell** | `tauri` (v2.0) | MIT / Apache-2.0 | Desktop shell | Native (host) |
