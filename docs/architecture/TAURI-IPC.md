# Luma — Tauri IPC Contract & Native Boundary Specification

## 1. IPC Architecture & Security Model

Tauri 2 serves as the native platform boundary between the React 19 webview and the Rust systems core.

```text
[React Feature Component]
       ↓
[Typed LumaApi Service (apps/desktop/src/lib/tauri.ts)]
       ↓
[Tauri IPC Bridge: invoke("command_name", { ... })]
       ↓
[Tauri Command Handlers (apps/desktop/src-tauri/src/commands/)]
       ↓
[Rust Service & Storage Layers (luma-storage / luma-reader / luma-anchor)]
```

---

## 2. Invariants & Rules
1. **Centralized Invocation**: React components never call raw `invoke()` directly in JSX. All invocations go through the strongly typed `LumaApi` client in `apps/desktop/src/lib/tauri.ts`.
2. **No Arbitrary Filesystem Access**: The frontend cannot pass arbitrary OS filesystem paths to execute commands. All file access passes through validated repository and `luma-security` boundaries.
3. **No Unrestricted Execution**: No shell or system command execution APIs are exposed to the webview.
4. **Mock Fallback for Web/Testing**: In browser environments where Tauri internals are absent, `LumaApi` provides an in-memory mock store allowing UI development and testing.
