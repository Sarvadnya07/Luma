# ADR-0023: Database Concurrency & Read/Write Connection Separation

- **Status**: Approved
- **Date**: 2026-08-31
- **Context**: In local-first desktop reading workflows, long-running batch transactions (such as importing a 1,000-book library or generating full-text FTS indexes) must never block instant user reading activities (e.g. loading EPUB spine chapters, retrieving reading progress, searching annotations, or updating local UI settings). In ARCH-01, Finding ARCH-F01 noted that sharing a single locked Arc<Mutex<Connection>> could introduce read contention during batch write operations.
- **Decision**: Enhance Database in luma-storage with explicit separation between a dedicated primary writer connection (with_write_conn) and dedicated query-optimized reader connections (with_read_conn configured with PRAGMA query_only = ON and WAL concurrency).
- **Alternatives Considered**: 
  1. Full async connection pool (e.g. 2d2 / deadpool-sqlite): Adds unnecessary async runtime overhead and complexity for local embedded desktop storage.
  2. Single locked connection: Causes UI read latency spikes during large background imports.
- **Consequences**: Readers execute concurrently without lock contention against long-running transactions; query-only invariant is strictly enforced at the SQLite engine level on read paths; zero breaking API changes for existing service callers.
