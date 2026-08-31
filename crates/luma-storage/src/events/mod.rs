use luma_core::ids::{AnnotationId, BookId, BookmarkId, FileId};
use luma_core::models::book::DocumentFormat;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "payload")]
pub enum DomainEvent {
    BookImported {
        book_id: BookId,
        title: String,
        format: DocumentFormat,
    },
    BookUpdated {
        book_id: BookId,
    },
    BookTrashed {
        book_id: BookId,
    },
    BookRestored {
        book_id: BookId,
    },
    BookDeleted {
        book_id: BookId,
    },
    BookFileChanged {
        book_id: BookId,
        file_id: FileId,
    },
    AnnotationCreated {
        book_id: BookId,
        annotation_id: AnnotationId,
    },
    AnnotationUpdated {
        book_id: BookId,
        annotation_id: AnnotationId,
    },
    AnnotationDeleted {
        book_id: BookId,
        annotation_id: AnnotationId,
    },
    BookmarkCreated {
        book_id: BookId,
        bookmark_id: BookmarkId,
    },
    BookmarkDeleted {
        book_id: BookId,
        bookmark_id: BookmarkId,
    },
    ReadingProgressChanged {
        book_id: BookId,
        progress_percentage: f64,
    },
    JobProgressUpdated {
        job_id: String,
        job_type: String,
        status: String,
        completed: u32,
        total: u32,
        message: Option<String>,
    },
    JobCompleted {
        job_id: String,
        job_type: String,
    },
    JobFailed {
        job_id: String,
        job_type: String,
        error: String,
    },
    SearchIndexUpdated {
        book_id: Option<BookId>,
    },
    LibraryReconciled {
        reconciled_count: usize,
    },
    BackupCompleted {
        backup_id: String,
    },
    SettingsChanged {
        key: String,
    },
}

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<DomainEvent>,
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new(256)
    }
}

impl EventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    pub fn publish(&self, event: DomainEvent) {
        // broadcast sends to all active subscribers. If there are no receivers, Ok is ignored.
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<DomainEvent> {
        self.sender.subscribe()
    }
}
