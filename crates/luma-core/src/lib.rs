//! # Luma Core
//!
//! Core types, models, and error handling for the Luma application.
//! This crate defines the foundational data structures and interfaces used
//! across all other Luma crates.
//!
//! ## Modules
//!
//! - [`error`] – Error types and unified result handling (`LumaError`, `BackendError`).
//! - [`ids`] – Strongly‑typed ID wrappers (`BookId`, `AnnotationId`, etc.).
//! - [`models`] – Domain models for books, annotations, metadata, reading progress, etc.
//! - [`version`] – Sync metadata and versioning utilities.
//!
//! ## Prelude
//!
//! For convenience, you can import the most common types via the prelude:
//!
//! ```
//! use luma_core::prelude::*;
//! ```

pub mod error;
pub mod ids;
pub mod models;
pub mod version;

// Re‑export core types for easy access.
pub use error::{BackendError, LumaError, Result};
pub use ids::*;
pub use models::*;
pub use version::*;

/// Convenience prelude module: imports the most frequently used types.
pub mod prelude {
    pub use super::error::{BackendError, LumaError, Result};
    pub use super::ids::{
        AnnotationId, AuthorId, BookId, BookmarkId, CollectionId, CoverImageId, DeviceId, FileId,
        ImportJobId, SessionId, TagId,
    };
    pub use super::models::{
        Annotation, Book, BookFile, Collection, Series, Tag,
        reading::{Bookmark, ReadingProgress, ReadingSession},
        ingest::{ImportJob, ImportJobStatus},
    };
    pub use super::version::SyncMetadata;
}