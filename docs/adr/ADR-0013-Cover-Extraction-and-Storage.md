# ADR-0013: Cover Extraction and Storage Strategy

## Status
Accepted

## Context
Rendering thousands of full-size book covers directly from inside 50MB–500MB EPUB/PDF archive files causes severe memory and disk I/O bottlenecks.

## Decision
During ingestion, we extract embedded cover images (or first-page previews) and save them to a dedicated, sandboxed `library/covers/` directory under deterministic SHA-256 hash filenames. The database records a `CoverImage` reference and relative path.

## Consequences
- Fast, lazy thumbnail loading without opening container archives during library browsing.
- Automatic image deduplication (identical covers share the same cached file on disk).
