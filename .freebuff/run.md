# Luma — Dev Server Run Doc

## Reproduce artifacts (fresh checkout)

1. Install dependencies with the project's package manager:
   - `pnpm install` (pnpm ≥ 9, Node ≥ 20; `packageManager` pin: pnpm@11.20.0)
2. No `.env*` files are required — the project has none checked in and the frontend runs without them.
3. Rust/Tauri backend is NOT needed for the web preview: `pnpm dev` runs the Vite dev server only. Without the Tauri backend the UI falls back to its error/empty states by design (no fake data — see DYNAMIC-DATA-01).

## Run the server

- Command: `pnpm dev` from the repo root (= `pnpm --filter @luma/desktop dev` = `vite` in `apps/desktop`).
- Port: **1420** (Tauri's Vite default; `strictPort: true` in `apps/desktop/vite.config.ts` — if occupied, pick a free port and override with `--port` or change the config).
- URL: http://localhost:1420

Detached start (Windows, from repo root):

```
powershell -NoProfile -Command "(Start-Process -FilePath 'pnpm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```
