# LUMA — CORE-03 KNOWLEDGE PERSISTENCE
## Local SQLite Data Model & Typed IPC Migration for Notes, Flashcards & Research Workspace

**Status**: P1 RESOLVED & TESTED  
**Date**: 2026-09-06  

---

### 1. Problem Statement & Architecture Defect

In CORE-02, the feature audit revealed that user knowledge constructs were detached from Luma's local-first SQLite persistence:
- `NotesWorkspace.tsx` read and wrote exclusively to browser `localStorage` under `"luma_notes_workspace"`.
- `StudyFlashcards.tsx` read and wrote exclusively to browser `localStorage` under `"luma_flashcards"`.
- `ResearchProjectWorkspace.tsx` used volatile in-memory React component state.
- Creating a backup via `BackupService` did not capture notes, flashcards, study reviews, or research projects because they were not part of the database schema.

This violated the core architectural guarantee of desktop local-first storage, durability against webview cache clears, and backup completeness.

---

### 2. Implementation & Domain Model

#### 2.1 Domain Models (`crates/luma-core/src/models/knowledge.rs`)
- `Note`: Unique ID, book association, source type, title, content, quote, timestamps, deletion flag.
- `Flashcard`: Front, back, deck ID, FSRS/SuperMemo SM-2 interval days, ease factor, repetition count, due date, last reviewed date.
- `StudyReview`: Log of individual card reviews with rating (1-4), interval delta, ease factor, and timestamp.
- `ResearchProject`: Research project container with abstract/description, timestamps.
- `ResearchQuestion`: Guided research inquiries per project with resolution status.
- `ResearchEvidence`: Quotes, citations, stance (`supporting` | `counter`), and book locator references.
- `ResearchDraft`: Project synthesis working draft with auto-save capability.

#### 2.2 Database Schema (`crates/luma-storage/src/migrations.rs`)
Migration V4 adds relational tables with foreign key cascades and indexes:
- `notes` (indexed by `book_id`, `updated_at`)
- `flashcards` (indexed by `due_at`, `deck_id`)
- `study_reviews` (indexed by `flashcard_id`, `reviewed_at`)
- `research_projects` (indexed by `updated_at`)
- `research_questions` (indexed by `project_id`)
- `research_evidence` (indexed by `project_id`)
- `research_drafts` (indexed by `project_id`)

#### 2.3 Repositories (`crates/luma-storage/src/repos/knowledge_repo.rs`)
- `NoteRepository`: `insert`, `get_by_id`, `list_all`, `delete`.
- `FlashcardRepository`: `insert`, `get_by_id`, `list_all`, `delete`.
- `StudyReviewRepository`: `insert`, `count_total`, `list_all`.
- `ResearchRepository`: CRUD for projects, questions, evidence, and drafts.

#### 2.4 Typed Tauri IPC Commands (`apps/desktop/src-tauri/src/commands/knowledge.rs`)
Registered in `main.rs`:
- Notes: `list_notes`, `create_note`, `update_note`, `delete_note`
- Flashcards: `list_flashcards`, `create_flashcard`, `record_study_review`, `delete_flashcard`
- Research: `list_research_projects`, `create_research_project`, `delete_research_project`, `list_research_questions`, `create_research_question`, `list_research_evidence`, `create_research_evidence`, `delete_research_evidence`, `save_research_draft`, `get_research_draft`

#### 2.5 Frontend Integration & Zero Data Loss Migration
- `apps/desktop/src/lib/tauri.ts`: Fully typed client methods on `LumaApi`.
- `migrateLegacyKnowledge()`: An idempotent migration executes on application startup. If legacy data exists in `localStorage`, it parses, validates, and inserts every note and flashcard into the SQLite database before marking `"luma_knowledge_migrated_v1" = "true"`.
- `NotesWorkspace.tsx`, `StudyFlashcards.tsx`, and `ResearchProjectWorkspace.tsx` now read directly from `LumaApi` and write every creation, update, review rating, and draft modification into SQLite.
