# ADR-0004: Frontend Framework
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Need a responsive, accessible, component-based UI framework for reading viewports, library catalogs, and annotation management.
- **Decision**: Select React 19 + TypeScript + Vite + Tailwind CSS with strict TypeScript settings (`noImplicitAny`, `strictNullChecks`).
- **Alternatives Considered**: Svelte, Vue 3, Vanilla Web Components.
- **Consequences**: Broad component ecosystem, high developer ergonomics, fast Vite HMR, and type safety across UI and IPC layers.
