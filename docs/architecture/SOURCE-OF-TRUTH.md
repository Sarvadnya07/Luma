# Source of Truth Architecture & Persistence Invariant

## 1. Architectural Truth Matrix

Luma enforces a strict three-tier separation of truth:

| Tier | Layer | Scope | Storage Mechanism | Lifetime |
|---|---|---|---|---|
| **Durable User Knowledge** | SQLite Database | Books, Annotations, Notes, Flashcards, Study Reviews, Research Projects, Reading Sessions, Settings | Local SQLite DB with WAL mode & Foreign Keys | Permanent / Backed Up |
| **Derived Document Truth** | Canonical Document Model | Node tree, Headings, Bounding Boxes, Unicode Offsets, Embedded Resources | On-demand parsing via Rust `CanonicalDocument` | Cached in LRU (`Arc<CanonicalDocument>`) |
| **Transient Presentation State** | Frontend Memory | Active viewport scroll, zoom level, canvas element references, uncommitted form inputs | Zustand stores / React state hooks | Lost on reload / unmount |

---

## 2. Zero-Durable-LocalStorage Invariant

**Absolute Guarantee**: Browser `localStorage` is **never** used as a primary or durable store for user knowledge, reading progress, notes, flashcards, or research data.

### Forensic Verification:
1. **Notes**: Stored in SQLite `notes` table via `NoteRepository` and Tauri commands (`get_notes_for_book`, `create_note`, `update_note`, `delete_note`).
2. **Flashcards**: Stored in SQLite `flashcards` and `review_logs` tables via `FlashcardRepository` (`get_flashcards_for_book`, `create_flashcard`, `record_review`).
3. **Research Workspace**: Stored in SQLite `research_projects`, `research_sources`, and `research_notes` tables via `ResearchProjectRepository`.
4. **Reading Sessions & Progress**: Stored in SQLite `reading_progress` and `reading_sessions` tables via `ReadingProgressRepository` and `ReadingSessionRepository`.
5. **Allowed `localStorage` Usage**: Limited exclusively to ephemeral client UI theme preferences (`luma-theme: "dark" | "light"`) and dev mocks when running outside the Tauri container.

---

## 3. SQLite Concurrency & Integrity Architecture

1. **Write-Ahead Logging (WAL)**: Enabled on all SQLite connections (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`). Readers never block writers, and writers never block readers.
2. **Foreign Key Enforcement**: Enforced on every connection (`PRAGMA foreign_keys = ON;`). Deleting a book cascades cleanly to annotations, bookmarks, reading progress, sessions, and notes.
3. **Transactional Isolation**: All multi-entity mutations (e.g., book deletion with associated artifacts, backup restoration) are wrapped in atomic SQLite transactions.
4. **Backup Completeness**: The SQLite backup engine (`BackupService`) exports the full unified database file (`luma.db`), guaranteeing that a single backup contains 100% of user knowledge without disjoint browser storage exports.
