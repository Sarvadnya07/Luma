# ADR-0015: Reader Document Session Architecture

## Status
Accepted

## Context
When reading a book, the application needs a unified session model that represents the active reading state (current locator, progress percentage, chapter title, page count) regardless of whether the document is an EPUB, PDF, CBZ, or Markdown file.

## Decision
We create a unified `DocumentSession` that tracks format-aware locators (`epubcfi` or `page=X`), progress percentage, and timestamps. Durable progress is persisted automatically to SQLite `reading_progress` table, while ephemeral UI states are managed via Zustand.

## Consequences
- Format-neutral reader shell.
- Automatic resume capability on reopening books.
