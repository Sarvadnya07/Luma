# ADR-0019: TypeScript-First Frontend Architecture

## Status
Accepted

## Context
A rich desktop reading experience requires responsive UI, instant layout feedback, and accessible controls. Writing application and presentation logic in untyped JavaScript introduces runtime errors, refactoring friction, and type drift against backend Rust models.

## Decision
All frontend code across `apps/desktop/src` and `packages/` is strictly written in TypeScript with full strictness (`noEmit: true`, strict typechecking in monorepo packages). JavaScript is restricted solely to build tooling configuration (`postcss.config.js`, `tailwind.config.js`). Zero application or domain logic is written in JavaScript.

## Consequences
- Guaranteed end-to-end type safety between Rust models, IPC contracts, and React UI.
- Immediate compile-time detection of data contract drift.
