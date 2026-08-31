# ADR-0021: Typed Tauri IPC and Centralized API Client

## Status
Accepted

## Context
Scattering raw string-based `invoke("command_name", params)` across React components leads to typos, silent parameter mismatches, and difficult refactoring.

## Decision
All native interactions must pass through the centralized `LumaApi` client in `apps/desktop/src/lib/tauri.ts`. Every method explicitly returns typed TypeScript promises mapped 1:1 to serialized Rust DTOs.

## Consequences
- Single point of maintenance for IPC contracts.
- Automated fallback mock store enabling rapid frontend testing without requiring native webview runtime.
