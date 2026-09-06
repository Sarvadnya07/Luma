# LUMA — CORE-03 BACKUP & RESTORE
## Complete SQLite Knowledge & Session State Preservation

**Status**: P1 RESOLVED & TESTED  
**Date**: 2026-09-06  

---

### 1. Problem Statement

In CORE-02, the backup system (`BackupService`) captured only:
- `books.json`
- `annotations.json`
- `bookmarks.json`
- `reading_progress.json`
- `settings.json`

Because user notes, flashcards, study reviews, research projects, research inquiries, evidence items, research drafts, and reading sessions were absent from the backup archive, creating a backup and restoring it on another computer or after database recovery caused complete loss of all knowledge workspaces and reading history.

---

### 2. Implementation

`crates/luma-storage/src/services/backup_service.rs` was updated to version 2 format with full forward and backward compatibility:

#### 2.1 BackupManifest (`v2`)
```rust
pub struct BackupManifest {
    pub version: u32,
    pub created_at: String,
    pub books_count: usize,
    pub annotations_count: usize,
    pub bookmarks_count: usize,
    pub settings_count: usize,
    #[serde(default)]
    pub notes_count: usize,
    #[serde(default)]
    pub flashcards_count: usize,
    #[serde(default)]
    pub research_projects_count: usize,
    #[serde(default)]
    pub reading_sessions_count: usize,
}
```

#### 2.2 Archive Contents
In addition to the core library tables, the `.luma-backup` archive now bundles:
- `notes.json`: All non-deleted user notes.
- `flashcards.json`: All flashcards with SM-2 interval and ease factor state.
- `study_reviews.json`: Historical log of all card reviews and grades.
- `research_projects.json`: All research project workspaces.
- `research_questions.json`: Research questions and status.
- `research_evidence.json`: All cited quotes, notes, stances, and book locators.
- `research_drafts.json`: Working project drafts and synthesis content.
- `reading_sessions.json`: Historical reading sessions with progress deltas and durations.

#### 2.3 Verified Restoration
`restore_backup` restores each JSON file if present in the ZIP archive into the target SQLite database, ensuring full round-trip preservation.

---

### 3. Verification & Test Coverage
- Automated integration test `crates/luma-storage/tests/test_backup_knowledge_state.rs` verifies that:
  1. A complete library containing books, notes, flashcards, reviews, research projects, questions, evidence, drafts, and reading sessions is backed up.
  2. The generated backup archive has SHA-256 integrity and manifest counts.
  3. Restoring the archive into an empty second database restores 100% of the knowledge entities and recovers the exact same analytics calculations.
