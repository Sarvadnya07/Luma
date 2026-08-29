# ADR-0006: Persistence Strategy
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Need durable, local-first embedded database for library metadata, reading state, annotations, and future sync change records.
- **Decision**: Standardize on SQLite via `rusqlite` (bundled engine) with WAL (Write-Ahead Logging) mode, strict foreign keys, versioned SQL migrations, and repository isolation.
- **Alternatives Considered**: RocksDB, Sled, DuckDB, pure JSON files on disk.
- **Consequences**: Atomic transactions, sub-millisecond queries up to 10k+ books, robust online backups, zero external server dependency.
