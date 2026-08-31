use luma_anchor::{AnchorEngine, ResolutionResult, TextQuoteAnchor};
use luma_core::error::{LumaError, Result};
use luma_core::ids::{AnnotationId, BookId};
use luma_core::models::annotation::Annotation;

use crate::cache::CacheManager;
use crate::db::Database;
use crate::events::{DomainEvent, EventBus};
use crate::repos::AnnotationRepository;

#[derive(Clone)]
pub struct AnnotationService {
    db: Database,
    event_bus: EventBus,
    cache: CacheManager,
}

impl AnnotationService {
    pub fn new(db: Database, event_bus: EventBus, cache: CacheManager) -> Self {
        Self {
            db,
            event_bus,
            cache,
        }
    }

    pub fn list_by_book(&self, book_id: &BookId) -> Result<Vec<Annotation>> {
        let repo = AnnotationRepository::new(self.db.clone());
        repo.list_by_book(book_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))
    }

    pub async fn save_annotation(&self, annotation: &Annotation) -> Result<()> {
        let repo = AnnotationRepository::new(self.db.clone());
        repo.insert(annotation)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        self.cache
            .invalidate_book(&annotation.book_id.to_string())
            .await;

        self.event_bus.publish(DomainEvent::AnnotationCreated {
            book_id: annotation.book_id,
            annotation_id: annotation.id,
        });

        Ok(())
    }

    pub async fn update_note(
        &self,
        annotation_id: &AnnotationId,
        note: Option<&str>,
        book_id: Option<BookId>,
    ) -> Result<()> {
        let repo = AnnotationRepository::new(self.db.clone());
        repo.update_note(annotation_id, note)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        if let Some(bid) = book_id {
            self.cache.invalidate_book(&bid.to_string()).await;
            self.event_bus.publish(DomainEvent::AnnotationUpdated {
                book_id: bid,
                annotation_id: *annotation_id,
            });
        }

        Ok(())
    }

    pub async fn delete_annotation(
        &self,
        annotation_id: &AnnotationId,
        book_id: Option<BookId>,
    ) -> Result<()> {
        let repo = AnnotationRepository::new(self.db.clone());
        repo.delete(annotation_id)
            .map_err(|e| LumaError::StorageError(e.to_string()))?;

        if let Some(bid) = book_id {
            self.cache.invalidate_book(&bid.to_string()).await;
            self.event_bus.publish(DomainEvent::AnnotationDeleted {
                book_id: bid,
                annotation_id: *annotation_id,
            });
        }

        Ok(())
    }

    pub fn resolve_anchor(
        &self,
        quote: String,
        prefix: Option<String>,
        suffix: Option<String>,
        document_text: &str,
    ) -> ResolutionResult {
        let anchor = TextQuoteAnchor::new(quote, prefix, suffix);
        AnchorEngine::resolve_quote(&anchor, document_text)
    }
}
