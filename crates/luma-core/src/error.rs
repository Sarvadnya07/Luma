use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum LumaError {
    #[error("Invalid ID: {0}")]
    InvalidId(String),

    #[error("Document error: {0}")]
    DocumentError(String),

    #[error("Format not supported: {0}")]
    UnsupportedFormat(String),

    #[error("Corrupted document: {0}")]
    CorruptedDocument(String),

    #[error("Anchor resolution failed: {0}")]
    AnchorResolutionFailed(String),

    #[error("Ambiguous anchor resolution: score {score:.2}, threshold {threshold:.2}")]
    AmbiguousAnchor { score: u32, threshold: u32 },

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Entity not found: {entity_type} with ID {id}")]
    NotFound { entity_type: String, id: String },

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Security violation: {0}")]
    SecurityError(String),

    #[error("Sync conflict: {0}")]
    SyncConflict(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, LumaError>;
