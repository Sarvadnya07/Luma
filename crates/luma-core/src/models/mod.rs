//! Core data models for the Luma application.
//!
//! This module defines the fundamental data structures used across all Luma crates.
//! Each submodule groups related domain models:
//!
//! - `annotation`: Models for user highlights, notes, and anchor data.
//! - `book`: Core publication models (`Book`, `BookFile`, formats, reading status, etc.).
//! - `ingest`: Import job models, duplicate detection, and cover image storage.
//! - `metadata`: Author, Series, Tag, Collection – the library’s organisational entities.
//! - `reading`: Reading progress and bookmark models.
//! - `search`: Search result models and relevant payloads.
//!
//! All models are designed to be serializable (`serde`) and work across the entire
//! application stack (backend, frontend, and database).

pub mod annotation;
pub mod book;
pub mod ingest;
pub mod metadata;
pub mod reading;
pub mod search;

// Re‑export all public items from each submodule to flatten the API.
pub use annotation::*;
pub use book::*;
pub use ingest::*;
pub use metadata::*;
pub use reading::*;
pub use search::*;