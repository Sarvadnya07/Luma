use serde::{Deserialize, Serialize};
use thiserror::Error;

// ============================================================================
// Constants – centralised error codes, categories, and messages
// ============================================================================

// ---- Error Codes ----
pub const ERR_CODE_NOT_FOUND: &str = "NOT_FOUND";
pub const ERR_CODE_VALIDATION: &str = "VALIDATION_FAILED";
pub const ERR_CODE_CONFLICT: &str = "CONFLICT";
pub const ERR_CODE_PERMISSION_DENIED: &str = "PERMISSION_DENIED";
pub const ERR_CODE_UNSUPPORTED_FORMAT: &str = "UNSUPPORTED_FORMAT";
pub const ERR_CODE_STORAGE: &str = "STORAGE_ERROR";
pub const ERR_CODE_INTERNAL: &str = "INTERNAL_ERROR";
pub const ERR_CODE_CANCELLED: &str = "CANCELLED";
pub const ERR_CODE_CORRUPTED: &str = "CORRUPTED_DOCUMENT";
pub const ERR_CODE_DOCUMENT: &str = "DOCUMENT_PROCESSING_ERROR";
pub const ERR_CODE_ANCHOR_FAILED: &str = "ANCHOR_RESOLUTION_FAILED";
pub const ERR_CODE_AMBIGUOUS_ANCHOR: &str = "AMBIGUOUS_ANCHOR";
pub const ERR_CODE_SECURITY: &str = "SECURITY_VIOLATION";

// ---- Categories ----
pub const CATEGORY_NOT_FOUND: &str = "NotFound";
pub const CATEGORY_VALIDATION: &str = "Validation";
pub const CATEGORY_CONFLICT: &str = "Conflict";
pub const CATEGORY_PERMISSION: &str = "PermissionDenied";
pub const CATEGORY_UNSUPPORTED: &str = "UnsupportedFormat";
pub const CATEGORY_STORAGE: &str = "Storage";
pub const CATEGORY_INTERNAL: &str = "Internal";
pub const CATEGORY_CANCELLED: &str = "Cancelled";
pub const CATEGORY_INVALID: &str = "InvalidDocument";
pub const CATEGORY_READER: &str = "Reader";
pub const CATEGORY_ANNOTATION: &str = "Annotation";
pub const CATEGORY_SECURITY: &str = "Security";



// ============================================================================
// LumaError Enum
// ============================================================================

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

// ============================================================================
// BackendError
// ============================================================================

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
            ERR_CODE_NOT_FOUND,
            CATEGORY_NOT_FOUND,
            format!("{} with id '{}' was not found", entity_type, id),
            false,
        )
    }

    pub fn validation<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_VALIDATION, CATEGORY_VALIDATION, message, false)
    }

    pub fn conflict<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_CONFLICT, CATEGORY_CONFLICT, message, false)
    }

    pub fn permission_denied<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_PERMISSION_DENIED, CATEGORY_PERMISSION, message, false)
    }

    pub fn unsupported_format<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_UNSUPPORTED_FORMAT, CATEGORY_UNSUPPORTED, message, false)
    }

    pub fn storage<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_STORAGE, CATEGORY_STORAGE, message, true)
    }

    pub fn internal<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_INTERNAL, CATEGORY_INTERNAL, message, false)
    }

    pub fn cancelled<S: Into<String>>(message: S) -> Self {
        Self::new(ERR_CODE_CANCELLED, CATEGORY_CANCELLED, message, false)
    }
}

// ============================================================================
// From<LumaError> impl using constants
// ============================================================================

impl From<LumaError> for BackendError {
    fn from(err: LumaError) -> Self {
        match err {
            LumaError::InvalidId(msg) => {
                BackendError::validation(format!("Invalid identifier: {}", msg))
            }
            LumaError::NotFound { entity_type, id } => BackendError::not_found(&entity_type, &id),
            LumaError::ValidationError(msg) => BackendError::validation(msg),
            LumaError::UnsupportedFormat(fmt) => BackendError::unsupported_format(
                format!("Document format '{}' is not supported", fmt)
            ),
            LumaError::CorruptedDocument(msg) => {
                BackendError::new(
                    ERR_CODE_CORRUPTED,
                    CATEGORY_INVALID,
                    format!("Document file is corrupted: {}", msg),
                    false,
                )
            }
            LumaError::DocumentError(msg) => {
                BackendError::new(ERR_CODE_DOCUMENT, CATEGORY_READER, msg, false)
            }
            LumaError::AnchorResolutionFailed(msg) => {
                BackendError::new(ERR_CODE_ANCHOR_FAILED, CATEGORY_ANNOTATION, msg, false)
            }
            LumaError::AmbiguousAnchor { score, threshold } => {
                BackendError::new(
                    ERR_CODE_AMBIGUOUS_ANCHOR,
                    CATEGORY_ANNOTATION,
                    format!("Anchor resolution is ambiguous (score {} < threshold {})", score, threshold),
                    false,
                )
            }
            LumaError::StorageError(msg) => BackendError::storage(msg),
            LumaError::SecurityError(msg) => {
                BackendError::new(ERR_CODE_SECURITY, CATEGORY_SECURITY, msg, false)
            }
            LumaError::SyncConflict(msg) => BackendError::conflict(msg),
            LumaError::Cancelled(msg) => BackendError::cancelled(msg),
            LumaError::Internal(msg) => BackendError::internal(msg),
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_luma_error_to_backend_error_conversion() {
        let err = LumaError::NotFound {
            entity_type: "Book".to_string(),
            id: "123".to_string(),
        };
        let be = BackendError::from(err);
        assert_eq!(be.code, ERR_CODE_NOT_FOUND);
        assert_eq!(be.category, CATEGORY_NOT_FOUND);
        assert_eq!(be.message, "Book with id '123' was not found");
        assert!(!be.retryable);

        let storage_err = LumaError::StorageError("Disk full".to_string());
        let be2 = BackendError::from(storage_err);
        assert_eq!(be2.code, ERR_CODE_STORAGE);
        assert_eq!(be2.category, CATEGORY_STORAGE);
        assert!(be2.retryable);
    }
}
   