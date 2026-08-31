use luma_core::error::{LumaError, Result};
use luma_core::ids::BookId;
use luma_core::models::reading::ReadingProgress;

use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::repos::ReadingProgressRepository;

#[derive(Clone)]
pub struct ReadingProgressService {
    db: Database,
    event_bus: EventBus,
}

impl ReadingProgressService {
    pub fn new(db: Database, event_bus: EventBus) -> Self {
        Self { db, event_bus }
    }

    pub fn get_progress(&self, book_id: &BookId) -> Result<Option<ReadingProgress>> {
        let repo = ReadingProgressRepository::new(self.db.clone());
        repo.get(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub fn save_progress(&self, progress: &ReadingProgress) -> Result<()> {
        let repo = ReadingProgressRepository::new(self.db.clone());
        repo.save(progress)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.event_bus.publish(DomainEvent::ReadingProgressChanged {
            book_id: progress.book_id,
            progress_percentage: progress.progress_percentage as f64,
        });

        Ok(())
    }
}
