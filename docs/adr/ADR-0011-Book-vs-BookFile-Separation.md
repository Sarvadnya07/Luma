# ADR-0011: Book vs BookFile Separation

## Status
Accepted

## Context
A digital publication may exist in multiple formats (e.g. EPUB for reflow reading on phone/tablet, PDF for fixed-layout reference on desktop). Tying logical publication metadata (title, author, annotations, reading progress) directly to a single physical file path creates severe duplication, data loss, and migration issues.

## Decision
We separate:
1. `Book`: Logical publication holding title, authors, series, description, publisher, ISBN, reading status, and library state.
2. `BookFile`: Physical document on disk holding path, format, MIME type, file size, SHA-256 hash, and availability status.

A `Book` has one primary file (`primary_file_id`) and can contain multiple secondary `BookFile` instances.

## Consequences
- Supports multi-format libraries seamlessly.
- Allows moving, renaming, or upgrading files without losing annotations or reading history.
- Prepares Phase 3 reader engine to open any specific format instance while linking progress to the parent publication.
