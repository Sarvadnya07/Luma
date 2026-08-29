# ADR-0014: Library State and Non-Destructive Trash Model

## Status
Accepted

## Context
Accidental deletion of books or annotations is a critical failure mode in reader software. Users expect a safe undo and trash bin workflow.

## Decision
We model library status across three lifecycle states:
1. `Active`: Normal library visibility.
2. `Archived`: Hidden from main views but preserved.
3. `Trashed`: Moved to the Trash recovery bin with a `trashed_at` timestamp.

Removing a book from the library transitions its state to `Trashed`. Restoring returns it to `Active`. Permanent deletion requires explicit confirmation and offers an option to keep or delete the physical file on disk.

## Consequences
- Zero accidental user data loss.
- Full parity with standard modern filesystem trash mechanics.
