use chrono::{DateTime, Utc};
use rusqlite::params;
use std::str::FromStr;

use luma_core::models::knowledge::{
    Flashcard, FlashcardState, Note, ResearchDraft, ResearchEvidence, ResearchProject,
    ResearchQuestion, StudyReview,
};

use crate::db::Database;
use crate::error::StorageResult;

// ============================================================================
// Note Repository
// ============================================================================

pub struct NoteRepository {
    db: Database,
}

impl NoteRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, note: &Note) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO notes (
                    id, book_id, annotation_id, source_type, source_title,
                    title, content, quote, created_at, updated_at, is_deleted
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    quote = excluded.quote,
                    source_title = excluded.source_title,
                    updated_at = excluded.updated_at,
                    is_deleted = excluded.is_deleted
                "#,
                params![
                    note.id,
                    note.book_id.map(|b| b.to_string()),
                    note.annotation_id,
                    note.source_type,
                    note.source_title,
                    note.title,
                    note.content,
                    note.quote,
                    note.created_at.to_rfc3339(),
                    note.updated_at.to_rfc3339(),
                    if note.is_deleted { 1 } else { 0 },
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_by_id(&self, id: &str) -> StorageResult<Option<Note>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, annotation_id, source_type, source_title,
                       title, content, quote, created_at, updated_at, is_deleted
                FROM notes
                WHERE id = ?1 AND is_deleted = 0
                "#,
            )?;

            let mut rows = stmt.query(params![id])?;
            if let Some(row) = rows.next()? {
                let book_id_str: Option<String> = row.get(1)?;
                let book_id = book_id_str.and_then(|s| s.parse().ok());
                let created_str: String = row.get(8)?;
                let updated_str: String = row.get(9)?;
                let is_deleted: i32 = row.get(10)?;

                Ok(Some(Note {
                    id: row.get(0)?,
                    book_id,
                    annotation_id: row.get(2)?,
                    source_type: row.get(3)?,
                    source_title: row.get(4)?,
                    title: row.get(5)?,
                    content: row.get(6)?,
                    quote: row.get(7)?,
                    created_at: DateTime::parse_from_rfc3339(&created_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    updated_at: DateTime::parse_from_rfc3339(&updated_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    is_deleted: is_deleted != 0,
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Note>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, book_id, annotation_id, source_type, source_title,
                       title, content, quote, created_at, updated_at, is_deleted
                FROM notes
                WHERE is_deleted = 0
                ORDER BY updated_at DESC
                "#,
            )?;

            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let book_id_str: Option<String> = row.get(1)?;
                let annotation_id: Option<String> = row.get(2)?;
                let source_type: String = row.get(3)?;
                let source_title: String = row.get(4)?;
                let title: String = row.get(5)?;
                let content: String = row.get(6)?;
                let quote: Option<String> = row.get(7)?;
                let created_str: String = row.get(8)?;
                let updated_str: String = row.get(9)?;
                let is_deleted: i32 = row.get(10)?;

                Ok((
                    id,
                    book_id_str,
                    annotation_id,
                    source_type,
                    source_title,
                    title,
                    content,
                    quote,
                    created_str,
                    updated_str,
                    is_deleted,
                ))
            })?;

            let mut notes = Vec::new();
            for item in rows {
                let (id, b_str, ann, st, stitle, t, c, q, cr, up, del) = item?;
                notes.push(Note {
                    id,
                    book_id: b_str.and_then(|s| s.parse().ok()),
                    annotation_id: ann,
                    source_type: st,
                    source_title: stitle,
                    title: t,
                    content: c,
                    quote: q,
                    created_at: DateTime::parse_from_rfc3339(&cr)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    updated_at: DateTime::parse_from_rfc3339(&up)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    is_deleted: del != 0,
                });
            }

            Ok(notes)
        })
    }

    pub fn delete(&self, id: &str) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE notes SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }
}

// ============================================================================
// Flashcard Repository
// ============================================================================

pub struct FlashcardRepository {
    db: Database,
}

impl FlashcardRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, card: &Flashcard) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO flashcards (
                    id, front, back, source_book_id, source_annotation_id,
                    deck_id, state, interval_days, ease_factor, repetitions,
                    due_at, last_reviewed_at, created_at, updated_at, is_deleted
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                ON CONFLICT(id) DO UPDATE SET
                    front = excluded.front,
                    back = excluded.back,
                    deck_id = excluded.deck_id,
                    state = excluded.state,
                    interval_days = excluded.interval_days,
                    ease_factor = excluded.ease_factor,
                    repetitions = excluded.repetitions,
                    due_at = excluded.due_at,
                    last_reviewed_at = excluded.last_reviewed_at,
                    updated_at = excluded.updated_at,
                    is_deleted = excluded.is_deleted
                "#,
                params![
                    card.id,
                    card.front,
                    card.back,
                    card.source_book_id.map(|b| b.to_string()),
                    card.source_annotation_id,
                    card.deck_id,
                    card.state.to_string(),
                    card.interval_days,
                    card.ease_factor,
                    card.repetitions,
                    card.due_at.to_rfc3339(),
                    card.last_reviewed_at.map(|d| d.to_rfc3339()),
                    card.created_at.to_rfc3339(),
                    card.updated_at.to_rfc3339(),
                    if card.is_deleted { 1 } else { 0 },
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<Flashcard>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                r#"
                SELECT id, front, back, source_book_id, source_annotation_id,
                       deck_id, state, interval_days, ease_factor, repetitions,
                       due_at, last_reviewed_at, created_at, updated_at, is_deleted
                FROM flashcards
                WHERE is_deleted = 0
                ORDER BY due_at ASC
                "#,
            )?;

            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let front: String = row.get(1)?;
                let back: String = row.get(2)?;
                let b_str: Option<String> = row.get(3)?;
                let ann_id: Option<String> = row.get(4)?;
                let deck: String = row.get(5)?;
                let state_str: String = row.get(6)?;
                let interval: u32 = row.get(7)?;
                let ease: f32 = row.get(8)?;
                let reps: u32 = row.get(9)?;
                let due_str: String = row.get(10)?;
                let last_rev_str: Option<String> = row.get(11)?;
                let cr_str: String = row.get(12)?;
                let up_str: String = row.get(13)?;
                let is_del: i32 = row.get(14)?;

                Ok((
                    id,
                    front,
                    back,
                    b_str,
                    ann_id,
                    deck,
                    state_str,
                    interval,
                    ease,
                    reps,
                    due_str,
                    last_rev_str,
                    cr_str,
                    up_str,
                    is_del,
                ))
            })?;

            let mut cards = Vec::new();
            for item in rows {
                let (
                    id,
                    f,
                    bk,
                    b_str,
                    ann_id,
                    deck,
                    st_str,
                    intv,
                    ease,
                    reps,
                    due,
                    last_rev,
                    cr,
                    up,
                    del,
                ) = item?;
                cards.push(Flashcard {
                    id,
                    front: f,
                    back: bk,
                    source_book_id: b_str.and_then(|s| s.parse().ok()),
                    source_annotation_id: ann_id,
                    deck_id: deck,
                    state: FlashcardState::from_str(&st_str).unwrap_or(FlashcardState::New),
                    interval_days: intv,
                    ease_factor: ease,
                    repetitions: reps,
                    due_at: DateTime::parse_from_rfc3339(&due)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    last_reviewed_at: last_rev.and_then(|d| {
                        DateTime::parse_from_rfc3339(&d)
                            .ok()
                            .map(|dt| dt.with_timezone(&Utc))
                    }),
                    created_at: DateTime::parse_from_rfc3339(&cr)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    updated_at: DateTime::parse_from_rfc3339(&up)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                    is_deleted: del != 0,
                });
            }

            Ok(cards)
        })
    }

    pub fn delete(&self, id: &str) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE flashcards SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }
}

// ============================================================================
// Study Review Repository
// ============================================================================

pub struct StudyReviewRepository {
    db: Database,
}

impl StudyReviewRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    pub fn insert(&self, review: &StudyReview) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO study_reviews (
                    id, flashcard_id, rating, interval_before, interval_after, ease_factor, reviewed_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                "#,
                params![
                    review.id,
                    review.flashcard_id,
                    review.rating,
                    review.interval_before,
                    review.interval_after,
                    review.ease_factor,
                    review.reviewed_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })
    }

    pub fn count_total(&self) -> StorageResult<u64> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM study_reviews")?;
            let count: i64 = stmt.query_row([], |r| r.get(0))?;
            Ok(count as u64)
        })
    }

    pub fn list_all(&self) -> StorageResult<Vec<StudyReview>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, flashcard_id, rating, interval_before, interval_after, ease_factor, reviewed_at FROM study_reviews ORDER BY reviewed_at ASC"
            )?;
            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let flashcard_id: String = row.get(1)?;
                let rating: u8 = row.get(2)?;
                let interval_before: u32 = row.get(3)?;
                let interval_after: u32 = row.get(4)?;
                let ease_factor: f32 = row.get(5)?;
                let reviewed_at_str: String = row.get(6)?;
                Ok((id, flashcard_id, rating, interval_before, interval_after, ease_factor, reviewed_at_str))
            })?;

            let mut reviews = Vec::new();
            for r in rows {
                let (id, flashcard_id, rating, interval_before, interval_after, ease_factor, reviewed_at_str) = r?;
                reviews.push(StudyReview {
                    id,
                    flashcard_id,
                    rating,
                    interval_before,
                    interval_after,
                    ease_factor,
                    reviewed_at: DateTime::parse_from_rfc3339(&reviewed_at_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now()),
                });
            }
            Ok(reviews)
        })
    }
}

// ============================================================================
// Research Repository
// ============================================================================

pub struct ResearchRepository {
    db: Database,
}

impl ResearchRepository {
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    // Projects
    pub fn insert_project(&self, proj: &ResearchProject) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO research_projects (id, title, description, created_at, updated_at, is_deleted)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    updated_at = excluded.updated_at,
                    is_deleted = excluded.is_deleted
                "#,
                params![
                    proj.id,
                    proj.title,
                    proj.description,
                    proj.created_at.to_rfc3339(),
                    proj.updated_at.to_rfc3339(),
                    if proj.is_deleted { 1 } else { 0 },
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_projects(&self) -> StorageResult<Vec<ResearchProject>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, title, description, created_at, updated_at, is_deleted FROM research_projects WHERE is_deleted = 0 ORDER BY updated_at DESC"
            )?;
            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let description: Option<String> = row.get(2)?;
                let cr_str: String = row.get(3)?;
                let up_str: String = row.get(4)?;
                let is_del: i32 = row.get(5)?;

                Ok((id, title, description, cr_str, up_str, is_del))
            })?;

            let mut projects = Vec::new();
            for item in rows {
                let (id, t, desc, cr, up, del) = item?;
                projects.push(ResearchProject {
                    id,
                    title: t,
                    description: desc,
                    created_at: DateTime::parse_from_rfc3339(&cr).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                    updated_at: DateTime::parse_from_rfc3339(&up).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                    is_deleted: del != 0,
                });
            }
            Ok(projects)
        })
    }

    pub fn delete_project(&self, id: &str) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                "UPDATE research_projects SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?1",
                params![id],
            )?;
            Ok(())
        })
    }

    // Questions
    pub fn insert_question(&self, q: &ResearchQuestion) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO research_questions (id, project_id, question, status, created_at)
                VALUES (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT(id) DO UPDATE SET
                    question = excluded.question,
                    status = excluded.status
                "#,
                params![
                    q.id,
                    q.project_id,
                    q.question,
                    q.status,
                    q.created_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_questions_by_project(
        &self,
        project_id: &str,
    ) -> StorageResult<Vec<ResearchQuestion>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, question, status, created_at FROM research_questions WHERE project_id = ?1 ORDER BY created_at ASC"
            )?;
            let rows = stmt.query_map(params![project_id], |row| {
                let id: String = row.get(0)?;
                let pid: String = row.get(1)?;
                let q: String = row.get(2)?;
                let status: String = row.get(3)?;
                let cr_str: String = row.get(4)?;
                Ok((id, pid, q, status, cr_str))
            })?;

            let mut questions = Vec::new();
            for item in rows {
                let (id, pid, q, st, cr) = item?;
                questions.push(ResearchQuestion {
                    id,
                    project_id: pid,
                    question: q,
                    status: st,
                    created_at: DateTime::parse_from_rfc3339(&cr).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                });
            }
            Ok(questions)
        })
    }

    // Evidence
    pub fn insert_evidence(&self, ev: &ResearchEvidence) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO research_evidence (
                    id, project_id, question_id, source_title, quote, notes, stance, book_id, locator, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                ON CONFLICT(id) DO UPDATE SET
                    quote = excluded.quote,
                    notes = excluded.notes,
                    stance = excluded.stance
                "#,
                params![
                    ev.id,
                    ev.project_id,
                    ev.question_id,
                    ev.source_title,
                    ev.quote,
                    ev.notes,
                    ev.stance,
                    ev.book_id.map(|b| b.to_string()),
                    ev.locator,
                    ev.created_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_evidence_by_project(
        &self,
        project_id: &str,
    ) -> StorageResult<Vec<ResearchEvidence>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, question_id, source_title, quote, notes, stance, book_id, locator, created_at FROM research_evidence WHERE project_id = ?1 ORDER BY created_at ASC"
            )?;
            let rows = stmt.query_map(params![project_id], |row| {
                let id: String = row.get(0)?;
                let pid: String = row.get(1)?;
                let qid: Option<String> = row.get(2)?;
                let st: String = row.get(3)?;
                let quote: String = row.get(4)?;
                let notes: Option<String> = row.get(5)?;
                let stance: String = row.get(6)?;
                let b_str: Option<String> = row.get(7)?;
                let loc: Option<String> = row.get(8)?;
                let cr_str: String = row.get(9)?;

                Ok((id, pid, qid, st, quote, notes, stance, b_str, loc, cr_str))
            })?;

            let mut evidence_items = Vec::new();
            for item in rows {
                let (id, pid, qid, st, q, n, stance, b_str, loc, cr) = item?;
                evidence_items.push(ResearchEvidence {
                    id,
                    project_id: pid,
                    question_id: qid,
                    source_title: st,
                    quote: q,
                    notes: n,
                    stance,
                    book_id: b_str.and_then(|s| s.parse().ok()),
                    locator: loc,
                    created_at: DateTime::parse_from_rfc3339(&cr).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                });
            }
            Ok(evidence_items)
        })
    }

    pub fn delete_evidence(&self, id: &str) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute("DELETE FROM research_evidence WHERE id = ?1", params![id])?;
            Ok(())
        })
    }

    // Drafts
    pub fn save_draft(&self, draft: &ResearchDraft) -> StorageResult<()> {
        self.db.with_conn(|conn| {
            conn.execute(
                r#"
                INSERT INTO research_drafts (id, project_id, title, content, updated_at)
                VALUES (?1, ?2, ?3, ?4, ?5)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    content = excluded.content,
                    updated_at = excluded.updated_at
                "#,
                params![
                    draft.id,
                    draft.project_id,
                    draft.title,
                    draft.content,
                    draft.updated_at.to_rfc3339(),
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_draft_by_project(&self, project_id: &str) -> StorageResult<Option<ResearchDraft>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, title, content, updated_at FROM research_drafts WHERE project_id = ?1 LIMIT 1"
            )?;
            let mut rows = stmt.query(params![project_id])?;
            if let Some(row) = rows.next()? {
                let id: String = row.get(0)?;
                let pid: String = row.get(1)?;
                let title: String = row.get(2)?;
                let content: String = row.get(3)?;
                let up_str: String = row.get(4)?;
                Ok(Some(ResearchDraft {
                    id,
                    project_id: pid,
                    title,
                    content,
                    updated_at: DateTime::parse_from_rfc3339(&up_str).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                }))
            } else {
                Ok(None)
            }
        })
    }

    pub fn list_all_questions(&self) -> StorageResult<Vec<ResearchQuestion>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, question, status, created_at FROM research_questions ORDER BY created_at ASC"
            )?;
            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let pid: String = row.get(1)?;
                let q: String = row.get(2)?;
                let status: String = row.get(3)?;
                let cr_str: String = row.get(4)?;
                Ok((id, pid, q, status, cr_str))
            })?;

            let mut questions = Vec::new();
            for item in rows {
                let (id, pid, q, st, cr) = item?;
                questions.push(ResearchQuestion {
                    id,
                    project_id: pid,
                    question: q,
                    status: st,
                    created_at: DateTime::parse_from_rfc3339(&cr).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                });
            }
            Ok(questions)
        })
    }

    pub fn list_all_evidence(&self) -> StorageResult<Vec<ResearchEvidence>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, question_id, source_title, quote, notes, stance, book_id, locator, created_at FROM research_evidence ORDER BY created_at ASC"
            )?;
            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let pid: String = row.get(1)?;
                let qid: Option<String> = row.get(2)?;
                let st: String = row.get(3)?;
                let quote: String = row.get(4)?;
                let notes: Option<String> = row.get(5)?;
                let stance: String = row.get(6)?;
                let b_str: Option<String> = row.get(7)?;
                let loc: Option<String> = row.get(8)?;
                let cr_str: String = row.get(9)?;

                Ok((id, pid, qid, st, quote, notes, stance, b_str, loc, cr_str))
            })?;

            let mut evidence_items = Vec::new();
            for item in rows {
                let (id, pid, qid, st, q, n, stance, b_str, loc, cr) = item?;
                evidence_items.push(ResearchEvidence {
                    id,
                    project_id: pid,
                    question_id: qid,
                    source_title: st,
                    quote: q,
                    notes: n,
                    stance,
                    book_id: b_str.and_then(|s| s.parse().ok()),
                    locator: loc,
                    created_at: DateTime::parse_from_rfc3339(&cr).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                });
            }
            Ok(evidence_items)
        })
    }

    pub fn list_all_drafts(&self) -> StorageResult<Vec<ResearchDraft>> {
        self.db.with_read_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, project_id, title, content, updated_at FROM research_drafts ORDER BY updated_at DESC"
            )?;
            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let pid: String = row.get(1)?;
                let title: String = row.get(2)?;
                let content: String = row.get(3)?;
                let up_str: String = row.get(4)?;
                Ok((id, pid, title, content, up_str))
            })?;

            let mut drafts = Vec::new();
            for item in rows {
                let (id, pid, t, c, up) = item?;
                drafts.push(ResearchDraft {
                    id,
                    project_id: pid,
                    title: t,
                    content: c,
                    updated_at: DateTime::parse_from_rfc3339(&up).map(|dt| dt.with_timezone(&Utc)).unwrap_or_else(|_| Utc::now()),
                });
            }
            Ok(drafts)
        })
    }
}
