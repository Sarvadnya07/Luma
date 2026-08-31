# ADR-0020: Rust-First Systems Core

## Status
Accepted

## Context
High-performance document ingestion, safe ZIP decompression, Dublin Core XML parsing, cryptographic hashing, SQLite WAL transaction management, and multi-signal fuzzy annotation anchor resolution require memory safety, speed, and concurrency.

## Decision
All systems, storage, document ingestion, and anchor resolution capabilities reside in modular Rust crates (`luma-core`, `luma-anchor`, `luma-reader`, `luma-storage`, `luma-search`, `luma-security`).

## Consequences
- Total memory safety without a garbage collector.
- Portability to WASM targets for cross-platform and web use.
- Secure, sandboxed document processing.
