use serde::{Deserialize, Serialize};

use crate::ids::{AnnotationId, BookId, DeviceId};
use crate::version::SyncMetadata;

// ============================================================================
// Annotation Type Enum
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnnotationType {
    Highlight,
    Underline,
    Note,
    Bookmark,
}

// ============================================================================
// Annotation Struct with Builder
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Annotation {
    pub id: AnnotationId,
    pub book_id: BookId,
    pub annotation_type: AnnotationType,
    pub color_hex: String,
    pub quote: String,
    pub note: Option<String>,
    pub anchor_payload_json: String,
    pub sync: SyncMetadata,
}

impl Annotation {
    /// Creates a new annotation with minimal required fields.
    /// Optional fields (note, color) can be set via the builder.
    pub fn new(
        book_id: BookId,
        annotation_type: AnnotationType,
        quote: impl Into<String>,
        anchor_payload_json: impl Into<String>,
        device_id: DeviceId,
    ) -> Self {
        Self {
            id: AnnotationId::new(),
            book_id,
            annotation_type,
            color_hex: "#FFD700".to_string(), // default gold highlight
            quote: quote.into(),
            note: None,
            anchor_payload_json: anchor_payload_json.into(),
            sync: SyncMetadata::new(device_id),
        }
    }

    /// Sets the note for this annotation.
    pub fn with_note(mut self, note: impl Into<Option<String>>) -> Self {
        self.note = note.into();
        self
    }

    /// Sets the color hex for this annotation.
    pub fn with_color(mut self, color: impl Into<String>) -> Self {
        self.color_hex = color.into();
        self
    }

    /// Sets a custom ID (for testing or restoration).
    pub fn with_id(mut self, id: AnnotationId) -> Self {
        self.id = id;
        self
    }

    /// Sets custom sync metadata.
    pub fn with_sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = sync;
        self
    }

    /// Deserializes the anchor payload into a concrete type `T`.
    pub fn parse_anchor_payload<T: for<'de> Deserialize<'de>>(&self) -> serde_json::Result<T> {
        serde_json::from_str(&self.anchor_payload_json)
    }
}

// ============================================================================
// Annotation Builder
// ============================================================================

#[derive(Debug, Clone, Default)]
pub struct AnnotationBuilder {
    book_id: Option<BookId>,
    annotation_type: Option<AnnotationType>,
    color_hex: Option<String>,
    quote: Option<String>,
    note: Option<String>,
    anchor_payload_json: Option<String>,
    device_id: Option<DeviceId>,
    id: Option<AnnotationId>,
    sync: Option<SyncMetadata>,
}

impl AnnotationBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn book_id(mut self, book_id: BookId) -> Self {
        self.book_id = Some(book_id);
        self
    }

    pub fn annotation_type(mut self, at: AnnotationType) -> Self {
        self.annotation_type = Some(at);
        self
    }

    pub fn color_hex(mut self, color: impl Into<String>) -> Self {
        self.color_hex = Some(color.into());
        self
    }

    pub fn quote(mut self, quote: impl Into<String>) -> Self {
        self.quote = Some(quote.into());
        self
    }

    pub fn note(mut self, note: impl Into<Option<String>>) -> Self {
        self.note = note.into();
        self
    }

    pub fn anchor_payload_json(mut self, payload: impl Into<String>) -> Self {
        self.anchor_payload_json = Some(payload.into());
        self
    }

    pub fn device_id(mut self, device_id: DeviceId) -> Self {
        self.device_id = Some(device_id);
        self
    }

    pub fn id(mut self, id: AnnotationId) -> Self {
        self.id = Some(id);
        self
    }

    pub fn sync(mut self, sync: SyncMetadata) -> Self {
        self.sync = Some(sync);
        self
    }

    pub fn build(self) -> Result<Annotation, String> {
        let book_id = self.book_id.ok_or("book_id is required")?;
        let annotation_type = self.annotation_type.ok_or("annotation_type is required")?;
        let quote = self.quote.ok_or("quote is required")?;
        let anchor_payload_json = self.anchor_payload_json.ok_or("anchor_payload_json is required")?;
        let device_id = self.device_id.unwrap_or_default();

        let mut ann = Annotation::new(book_id, annotation_type, quote, anchor_payload_json, device_id);
        if let Some(color) = self.color_hex {
            ann.color_hex = color;
        }
        if let Some(note) = self.note {
            ann.note = Some(note);
        }
        if let Some(id) = self.id {
            ann.id = id;
        }
        if let Some(sync) = self.sync {
            ann.sync = sync;
        }
        Ok(ann)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ids::{BookId, DeviceId};

    #[test]
    fn test_annotation_new_with_default_color() {
        let book_id = BookId::new();
        let device_id = DeviceId::new();
        let ann = Annotation::new(
            book_id,
            AnnotationType::Highlight,
            "Sample quote",
            r#"{"cfi":"epubcfi(/6/2[ch01]!/4/2/1:0)"}"#,
            device_id,
        );

        assert_eq!(ann.book_id, book_id);
        assert_eq!(ann.annotation_type, AnnotationType::Highlight);
        assert_eq!(ann.quote, "Sample quote");
        assert_eq!(ann.color_hex, "#FFD700");
        assert_eq!(ann.note, None);
        assert_eq!(ann.sync.device_id, device_id);
    }

    #[test]
    fn test_annotation_builder_success() {
        let book_id = BookId::new();
        let device_id = DeviceId::new();
        let ann = AnnotationBuilder::new()
            .book_id(book_id)
            .annotation_type(AnnotationType::Note)
            .quote("Important passage")
            .anchor_payload_json(r#"{"page":42}"#)
            .device_id(device_id)
            .color_hex("#00FF00")
            .note(Some("Remember this".to_string()))
            .build()
            .expect("Build should succeed");

        assert_eq!(ann.book_id, book_id);
        assert_eq!(ann.annotation_type, AnnotationType::Note);
        assert_eq!(ann.quote, "Important passage");
        assert_eq!(ann.color_hex, "#00FF00");
        assert_eq!(ann.note.as_deref(), Some("Remember this"));
    }

    #[test]
    fn test_annotation_builder_missing_fields() {
        let res = AnnotationBuilder::new().build();
        assert!(res.is_err());
    }
}