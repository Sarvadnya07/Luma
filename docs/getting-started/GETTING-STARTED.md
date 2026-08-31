# 🚀 Getting Started with Luma

> **Diátaxis Mode**: Tutorial  
> **Audience**: Developers, evaluators, and contributors setting up Luma for the first time.  
> **Goal**: By the end of this tutorial, you will have built Luma, run both the web dev server and the desktop shell, imported an EPUB or PDF document, and inspected annotation persistence.

---

## 1. Prerequisites

Ensure your development environment meets the following requirements:

- **Rust**: `1.80+` with `cargo` installed ([rustup.rs](https://rustup.rs))
- **Node.js**: `20.0.0+` ([nodejs.org](https://nodejs.org))
- **pnpm**: `9.0.0+` (Repository pinned at `pnpm@11.20.0`)
- **Platform Dependencies (Tauri 2)**:
  - **Windows**: Microsoft WebView2 Runtime + Visual Studio C++ Build Tools.
  - **macOS**: Xcode Command Line Tools.
  - **Linux**: `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

Verify versions via your terminal:

```bash
rustc --version
node --version
pnpm --version
```

---

## 2. Step 1: Clone and Install Dependencies

Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/luma-reader/luma.git
cd luma
pnpm install
```

This populates dependencies across the root, all 6 TypeScript packages in `packages/*`, and the desktop app in `apps/desktop`.

---

## 3. Step 2: Running in Web Development Mode

To rapidly iterate on UI components, styling, and client-side reader views without compiling native Rust binaries on every reload:

```bash
pnpm dev
```

The Vite development server will start at:
👉 **`http://localhost:1420`**

Open this URL in any modern browser to view the Luma user interface.

---

## 4. Step 3: Running the Full Tauri Desktop App

To test native file system dialogs, SQLite storage, and the complete Rust IPC bridge:

```bash
pnpm --filter @luma/desktop exec tauri dev
```

During initialization:
1. Tauri compiles the native backend crate (`apps/desktop/src-tauri`).
2. SQLite creates or opens the persistent local database at `./data/luma.db` (configurable via `LUMA_DATA_DIR`).
3. The native application window launches with hardware-accelerated WebView2 / WebKit.

---

## 5. Step 4: Import and Read a Document

1. **Import**: Click the **"Import Books"** button or drag-and-drop an `.epub` or `.pdf` file into the library viewport.
   - `luma-security` validates path bounds and runs an archive bomb check.
   - `luma-reader` extracts document metadata and cover art.
   - `luma-storage` creates a `Book` record and `BookFile` SHA-256 hash entry.
2. **Read**: Double-click any book card to open the **Reader Viewport**.
3. **Annotate**: Highlight any section of text. Click **"Add Highlight"** or **"Add Note"**.
   - Luma extracts the selected quote alongside surrounding prefix and suffix context strings.
   - The multi-signal anchor is securely recorded in the local SQLite database.

---

## 6. Step 5: Verification & Quality Checks

Run the complete verification suite to confirm everything is operational:

```bash
# 1. Run Rust workspace tests (domain entities, anchoring engine, storage repos)
cargo test --workspace

# 2. Run TypeScript type checks across all packages and apps
pnpm typecheck

# 3. Run ESLint across frontend packages
pnpm lint

# 4. Run Rust Clippy linter
cargo clippy --workspace -- -D warnings
```

---

## 7. Next Steps

- Explore the **[Architecture Principles](../architecture/ARCHITECTURE-PRINCIPLES.md)**.
- Read about the **[Fuzzy Multi-Signal Anchoring Engine](../architecture/ANNOTATION-INTEGRATION.md)**.
- Review the **[Tauri IPC Command Reference](../reference/TAURI-IPC-API.md)**.
