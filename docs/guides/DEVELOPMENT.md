# 🛠️ Development & Quality Workflows

> **Diátaxis Mode**: How-to Guide  
> **Audience**: Contributors and engineers maintaining or extending Luma.  
> **Prerequisites**: Node.js 20+, pnpm 9+, Rust 1.80+, Tauri 2 platform dependencies.

This guide outlines common development commands, compilation steps, linting, testing, and debugging workflows across the Luma monorepo.

---

## 1. Development Servers

### Browser / Frontend Only (Fast UI Iteration)
```bash
pnpm dev
```
Starts the Vite dev server for `apps/desktop` at `http://localhost:1420`. Perfect for styling, UI component design, and unit testing mock stores.

### Full Tauri Desktop Shell
```bash
pnpm --filter @luma/desktop exec tauri dev
```
Launches the native application window with active IPC handlers and local SQLite database connection.

---

## 2. Monorepo Build Workflows

### Build all TypeScript Workspace Packages
```bash
pnpm build
```
Executes `pnpm --recursive run build`, compiling all 6 packages in `packages/*` and the desktop frontend into `dist/` folders.

### Compile Rust Crates
```bash
cargo build --workspace
```
Compiles all 8 native crates in debug mode.

### Production Desktop App Binary Bundle
```bash
pnpm --filter @luma/desktop exec tauri build
```
Generates release installer bundles under `apps/desktop/src-tauri/target/release/bundle/`.

---

## 3. Testing Workflows

### Run All Rust Tests
```bash
cargo test --workspace
```
Runs unit and integration test suites for `luma-core`, `luma-anchor`, `luma-reader`, `luma-storage`, `luma-security`, and `luma-search`.

### Run Frontend Tests
```bash
pnpm test
```
Runs Vitest suites across workspace packages.

### Run Single Rust Test
```bash
# Test fuzzy anchoring resilience specifically:
cargo test -p luma-anchor --test test_anchor_resilience

# Test storage repository transactions:
cargo test -p luma-storage --test test_library_service
```

---

## 4. Code Quality & Linting

Before opening a pull request, run the following verification checks:

```bash
# 1. Type check all TypeScript packages
pnpm typecheck

# 2. ESLint across all TypeScript packages
pnpm lint

# 3. Rust Clippy with warnings treated as errors
cargo clippy --workspace -- -D warnings

# 4. Format check Rust code
cargo fmt --all -- --check
```

To auto-format Rust code:
```bash
cargo fmt --all
```

---

## 5. Environment Variables & Debugging

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `RUST_LOG` | `info,luma=debug` | Adjusts `tracing` log verbosity for Rust backend. |
| `LUMA_DATA_DIR` | `./data` | Overrides the storage directory for `luma.db` and extracted cover assets. |
| `VITE_DEV_SERVER_PORT` | `1420` | Port for the Vite development server. |
