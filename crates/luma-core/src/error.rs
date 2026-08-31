use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
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

    #[error("Operation cancelled: {0}")]
    Cancelled(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, LumaError>;

/// Standardized API and IPC error payload returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BackendError {
    pub code: String,
    pub category: String,
    pub message: String,
    pub retryable: bool,
    pub details: Option<String>,
}

impl std::fmt::Display for BackendError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}:{}] {}", self.category, self.code, self.message)
    }
}

impl std::error::Error for BackendError {}

impl BackendError {
    pub fn new<S: Into<String>>(code: &str, category: &str, message: S, retryable: bool) -> Self {
        Self {
            code: code.to_string(),
            category: category.to_string(),
            message: message.into(),
            retryable,
            details: None,
        }
    }

    pub fn with_details<S: Into<String>>(mut self, details: S) -> Self {
        self.details = Some(details.into());
        self
    }

    pub fn not_found(entity_type: &str, id: &str) -> Self {
        Self::new(
            "NOT_FOUND",
            "NotFound",
            format!("{} with id '{}' was not found", entity_type, id),
            false,
        )
    }

    pub fn validation<S: Into<String>>(message: S) -> Self {
        Self::new("VALIDATION_FAILED", "Validation", message, false)
    }

    pub fn conflict<S: Into<String>>(message: S) -> Self {
        Self::new("CONFLICT", "Conflict", message, false)
    }

    pub fn permission_denied<S: Into<String>>(message: S) -> Self {
        Self::new("PERMISSION_DENIED", "PermissionDenied", message, false)
    }

    pub fn unsupported_format<S: Into<String>>(message: S) -> Self {
        Self::new("UNSUPPORTED_FORMAT", "UnsupportedFormat", message, false)
    }

    pub fn storage<S: Into<String>>(message: S) -> Self {
        Self::new("STORAGE_ERROR", "Storage", message, true)
    }

    pub fn internal<S: Into<String>>(message: S) -> Self {
        Self::new("INTERNAL_ERROR", "Internal", message, false)
    }

    pub fn cancelled<S: Into<String>>(message: S) -> Self {
        Self::new("CANCELLED", "Cancelled", message, false)
    }
}

impl From<LumaError> for BackendError {
    fn from(err: LumaError) -> Self {
        match err {
            LumaError::InvalidId(msg) => {
                BackendError::validation(format!("Invalid identifier: {}", msg))
            }
            LumaError::NotFound { entity_type, id } => BackendError::not_found(&entity_type, &id),
            LumaError::ValidationError(msg) => BackendError::validation(msg),
            LumaError::UnsupportedFormat(fmt) => BackendError::unsupported_format(format!(
                "Document format '{}' is not supported",
                fmt
            )),
            LumaError::CorruptedDocument(msg) => BackendError::new(
                "CORRUPTED_DOCUMENT",
                "InvalidDocument",
                format!("Document file is corrupted: {}", msg),
                false,
            ),
            LumaError::DocumentError(msg) => {
                BackendError::new("DOCUMENT_PROCESSING_ERROR", "Reader", msg, false)
            }
            LumaError::AnchorResolutionFailed(msg) => {
                BackendError::new("ANCHOR_RESOLUTION_FAILED", "Annotation", msg, false)
            }
            LumaError::AmbiguousAnchor { score, threshold } => BackendError::new(
                "AMBIGUOUS_ANCHOR",
                "Annotation",
                format!(
                    "Anchor resolution is ambiguous (score {} < threshold {})",
                    score, threshold
                ),
                false,
            ),
            LumaError::StorageError(msg) => BackendError::storage(msg),
            LumaError::SecurityError(msg) => {
                BackendError::new("SECURITY_VIOLATION", "Security", msg, false)
            }
            LumaError::SyncConflict(msg) => BackendError::conflict(msg),
            LumaError::Cancelled(msg) => BackendError::cancelled(msg),
            LumaError::Internal(msg) => BackendError::internal(msg),
        }
    }
}
