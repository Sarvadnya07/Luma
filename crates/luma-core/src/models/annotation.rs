use serde::{Deserialize, Serialize};

use crate::ids::{AnnotationId, BookId, DeviceId};
use crate::version::SyncMetadata;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AnnotationType {
    Highlight,
    Underline,
    Note,
    Bookmark,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Annotation {
    pub id: AnnotationId,
    pub book_id: BookId,
    pub annotation_type: AnnotationType,
    pub color_hex: String,
    /// Exact quote text that was originally highlighted
    pub quote: String,
    /// User's attached note or commentary (markdown)
    pub note: Option<String>,
    /// Serialized anchor payload (containing text quote, prefix/suffix context, CFI/PDF coords)
    pub anchor_payload_json: String,
    pub sync: SyncMetadata,
}

impl Annotation {
    pub fn new(
        book_id: BookId,
        annotation_type: AnnotationType,
        color_hex: impl Into<String>,
        quote: impl Into<String>,
        anchor_payload_json: impl Into<String>,
        device_id: DeviceId,
    ) -> Self {
        Self {
            id: AnnotationId::new(),
            book_id,
            annotation_type,
            color_hex: color_hex.into(),
            quote: quote.into(),
            note: None,
            anchor_payload_json: anchor_payload_json.into(),
            sync: SyncMetadata::new(device_id),
        }
    }
}
