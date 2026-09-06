use tauri::State;
use tracing::{debug, error, info, instrument};

use luma_core::error::BackendError;
use luma_core::models::knowledge::{
    Flashcard, Note, ResearchDraft, ResearchEvidence, ResearchProject, ResearchQuestion,
    StudyReview,
};
use luma_storage::repos::{
    FlashcardRepository, NoteRepository, ResearchRepository, StudyReviewRepository,
};

use crate::context::LumaAppContext;

// ============================================================================
// Notes Commands
// ============================================================================

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_notes(ctx: State<'_, LumaAppContext>) -> Result<Vec<Note>, BackendError> {
    debug!("Listing notes");
    let repo = NoteRepository::new(ctx.db.clone());
    repo.list_all().map_err(|e| {
        error!(error = %e, "Failed to list notes");
        BackendError::storage(e.to_string())
    })
}

#[instrument(skip(ctx, note), fields(note_id = %note.id))]
#[tauri::command]
pub fn create_note(ctx: State<'_, LumaAppContext>, note: Note) -> Result<Note, BackendError> {
    debug!(?note, "Creating note");
    let repo = NoteRepository::new(ctx.db.clone());
    repo.insert(&note).map_err(|e| {
        error!(error = %e, "Failed to insert note");
        BackendError::storage(e.to_string())
    })?;
    info!(note_id = %note.id, "Note created successfully");
    Ok(note)
}

#[instrument(skip(ctx, note), fields(note_id = %note.id))]
#[tauri::command]
pub fn update_note(ctx: State<'_, LumaAppContext>, note: Note) -> Result<Note, BackendError> {
    debug!(?note, "Updating note");
    let repo = NoteRepository::new(ctx.db.clone());
    repo.insert(&note).map_err(|e| {
        error!(error = %e, "Failed to update note");
        BackendError::storage(e.to_string())
    })?;
    info!(note_id = %note.id, "Note updated successfully");
    Ok(note)
}

#[instrument(skip(ctx), fields(note_id = %id))]
#[tauri::command]
pub fn delete_note(ctx: State<'_, LumaAppContext>, id: String) -> Result<(), BackendError> {
    debug!(note_id = %id, "Deleting note");
    let repo = NoteRepository::new(ctx.db.clone());
    repo.delete(&id).map_err(|e| {
        error!(error = %e, "Failed to delete note");
        BackendError::storage(e.to_string())
    })?;
    info!(note_id = %id, "Note deleted successfully");
    Ok(())
}

// ============================================================================
// Flashcards Commands
// ============================================================================

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_flashcards(ctx: State<'_, LumaAppContext>) -> Result<Vec<Flashcard>, BackendError> {
    debug!("Listing flashcards");
    let repo = FlashcardRepository::new(ctx.db.clone());
    repo.list_all().map_err(|e| {
        error!(error = %e, "Failed to list flashcards");
        BackendError::storage(e.to_string())
    })
}

#[instrument(skip(ctx, flashcard), fields(card_id = %flashcard.id))]
#[tauri::command]
pub fn create_flashcard(
    ctx: State<'_, LumaAppContext>,
    flashcard: Flashcard,
) -> Result<Flashcard, BackendError> {
    debug!(?flashcard, "Creating flashcard");
    let repo = FlashcardRepository::new(ctx.db.clone());
    repo.insert(&flashcard).map_err(|e| {
        error!(error = %e, "Failed to insert flashcard");
        BackendError::storage(e.to_string())
    })?;
    info!(card_id = %flashcard.id, "Flashcard created successfully");
    Ok(flashcard)
}

#[instrument(skip(ctx, review), fields(review_id = %review.id, card_id = %review.flashcard_id))]
#[tauri::command]
pub fn record_study_review(
    ctx: State<'_, LumaAppContext>,
    review: StudyReview,
) -> Result<StudyReview, BackendError> {
    debug!(?review, "Recording study review");
    let repo = StudyReviewRepository::new(ctx.db.clone());
    repo.insert(&review).map_err(|e| {
        error!(error = %e, "Failed to insert study review");
        BackendError::storage(e.to_string())
    })?;
    info!(review_id = %review.id, "Study review recorded successfully");
    Ok(review)
}

#[instrument(skip(ctx), fields(card_id = %id))]
#[tauri::command]
pub fn delete_flashcard(ctx: State<'_, LumaAppContext>, id: String) -> Result<(), BackendError> {
    debug!(card_id = %id, "Deleting flashcard");
    let repo = FlashcardRepository::new(ctx.db.clone());
    repo.delete(&id).map_err(|e| {
        error!(error = %e, "Failed to delete flashcard");
        BackendError::storage(e.to_string())
    })?;
    info!(card_id = %id, "Flashcard deleted successfully");
    Ok(())
}

// ============================================================================
// Research Commands
// ============================================================================

#[instrument(skip(ctx))]
#[tauri::command]
pub fn list_research_projects(
    ctx: State<'_, LumaAppContext>,
) -> Result<Vec<ResearchProject>, BackendError> {
    debug!("Listing research projects");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.list_projects().map_err(|e| {
        error!(error = %e, "Failed to list research projects");
        BackendError::storage(e.to_string())
    })
}

#[instrument(skip(ctx, project), fields(project_id = %project.id))]
#[tauri::command]
pub fn create_research_project(
    ctx: State<'_, LumaAppContext>,
    project: ResearchProject,
) -> Result<ResearchProject, BackendError> {
    debug!(?project, "Creating research project");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.insert_project(&project).map_err(|e| {
        error!(error = %e, "Failed to insert research project");
        BackendError::storage(e.to_string())
    })?;
    info!(project_id = %project.id, "Research project created successfully");
    Ok(project)
}

#[instrument(skip(ctx), fields(project_id = %id))]
#[tauri::command]
pub fn delete_research_project(
    ctx: State<'_, LumaAppContext>,
    id: String,
) -> Result<(), BackendError> {
    debug!(project_id = %id, "Deleting research project");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.delete_project(&id).map_err(|e| {
        error!(error = %e, "Failed to delete research project");
        BackendError::storage(e.to_string())
    })?;
    info!(project_id = %id, "Research project deleted successfully");
    Ok(())
}

#[instrument(skip(ctx), fields(project_id = %project_id))]
#[tauri::command]
pub fn list_research_questions(
    ctx: State<'_, LumaAppContext>,
    project_id: String,
) -> Result<Vec<ResearchQuestion>, BackendError> {
    debug!(project_id = %project_id, "Listing research questions");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.list_questions_by_project(&project_id).map_err(|e| {
        error!(error = %e, "Failed to list research questions");
        BackendError::storage(e.to_string())
    })
}

#[instrument(skip(ctx, question), fields(question_id = %question.id))]
#[tauri::command]
pub fn create_research_question(
    ctx: State<'_, LumaAppContext>,
    question: ResearchQuestion,
) -> Result<ResearchQuestion, BackendError> {
    debug!(?question, "Creating research question");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.insert_question(&question).map_err(|e| {
        error!(error = %e, "Failed to insert research question");
        BackendError::storage(e.to_string())
    })?;
    info!(question_id = %question.id, "Research question created successfully");
    Ok(question)
}

#[instrument(skip(ctx), fields(project_id = %project_id))]
#[tauri::command]
pub fn list_research_evidence(
    ctx: State<'_, LumaAppContext>,
    project_id: String,
) -> Result<Vec<ResearchEvidence>, BackendError> {
    debug!(project_id = %project_id, "Listing research evidence");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.list_evidence_by_project(&project_id).map_err(|e| {
        error!(error = %e, "Failed to list research evidence");
        BackendError::storage(e.to_string())
    })
}

#[instrument(skip(ctx, evidence), fields(evidence_id = %evidence.id))]
#[tauri::command]
pub fn create_research_evidence(
    ctx: State<'_, LumaAppContext>,
    evidence: ResearchEvidence,
) -> Result<ResearchEvidence, BackendError> {
    debug!(?evidence, "Creating research evidence");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.insert_evidence(&evidence).map_err(|e| {
        error!(error = %e, "Failed to insert research evidence");
        BackendError::storage(e.to_string())
    })?;
    info!(evidence_id = %evidence.id, "Research evidence created successfully");
    Ok(evidence)
}

#[instrument(skip(ctx), fields(evidence_id = %id))]
#[tauri::command]
pub fn delete_research_evidence(
    ctx: State<'_, LumaAppContext>,
    id: String,
) -> Result<(), BackendError> {
    debug!(evidence_id = %id, "Deleting research evidence");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.delete_evidence(&id).map_err(|e| {
        error!(error = %e, "Failed to delete research evidence");
        BackendError::storage(e.to_string())
    })?;
    info!(evidence_id = %id, "Research evidence deleted successfully");
    Ok(())
}

#[instrument(skip(ctx, draft), fields(draft_id = %draft.id, project_id = %draft.project_id))]
#[tauri::command]
pub fn save_research_draft(
    ctx: State<'_, LumaAppContext>,
    draft: ResearchDraft,
) -> Result<ResearchDraft, BackendError> {
    debug!(?draft, "Saving research draft");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.save_draft(&draft).map_err(|e| {
        error!(error = %e, "Failed to save research draft");
        BackendError::storage(e.to_string())
    })?;
    info!(draft_id = %draft.id, "Research draft saved successfully");
    Ok(draft)
}

#[instrument(skip(ctx), fields(project_id = %project_id))]
#[tauri::command]
pub fn get_research_draft(
    ctx: State<'_, LumaAppContext>,
    project_id: String,
) -> Result<Option<ResearchDraft>, BackendError> {
    debug!(project_id = %project_id, "Getting research draft");
    let repo = ResearchRepository::new(ctx.db.clone());
    repo.get_draft_by_project(&project_id).map_err(|e| {
        error!(error = %e, "Failed to get research draft");
        BackendError::storage(e.to_string())
    })
}
