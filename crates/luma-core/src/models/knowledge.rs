use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::ids::BookId;

// ============================================================================
// Notes
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub book_id: Option<BookId>,
    pub annotation_id: Option<String>,
    pub source_type: String,
    pub source_title: String,
    pub title: String,
    pub content: String,
    pub quote: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

// ============================================================================
// Flashcards & Spaced Repetition (SRS)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum FlashcardState {
    #[default]
    New,
    Learning,
    Review,
    Mastered,
}

impl std::fmt::Display for FlashcardState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::New => write!(f, "new"),
            Self::Learning => write!(f, "learning"),
            Self::Review => write!(f, "review"),
            Self::Mastered => write!(f, "mastered"),
        }
    }
}

impl std::str::FromStr for FlashcardState {
    type Err = ();

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "learning" => Ok(Self::Learning),
            "review" => Ok(Self::Review),
            "mastered" => Ok(Self::Mastered),
            _ => Ok(Self::New),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Flashcard {
    pub id: String,
    pub front: String,
    pub back: String,
    pub source_book_id: Option<BookId>,
    pub source_annotation_id: Option<String>,
    pub deck_id: String,
    pub state: FlashcardState,
    pub interval_days: u32,
    pub ease_factor: f32,
    pub repetitions: u32,
    pub due_at: DateTime<Utc>,
    pub last_reviewed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StudyReview {
    pub id: String,
    pub flashcard_id: String,
    pub rating: u8, // 1=Again, 2=Hard, 3=Good, 4=Easy
    pub interval_before: u32,
    pub interval_after: u32,
    pub ease_factor: f32,
    pub reviewed_at: DateTime<Utc>,
}

// ============================================================================
// Research Project Workspace
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResearchProject {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResearchQuestion {
    pub id: String,
    pub project_id: String,
    pub question: String,
    pub status: String, // "open", "resolved", "deferred"
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResearchEvidence {
    pub id: String,
    pub project_id: String,
    pub question_id: Option<String>,
    pub source_title: String,
    pub quote: String,
    pub notes: Option<String>,
    pub stance: String, // "supporting", "counter", "neutral"
    pub book_id: Option<BookId>,
    pub locator: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResearchDraft {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub updated_at: DateTime<Utc>,
}
