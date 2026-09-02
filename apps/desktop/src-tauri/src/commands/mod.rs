//! Tauri command handlers for the Luma application.
//!
//! This module organises all backend commands exposed to the frontend via Tauri.
//! Each submodule groups related functionality:
//! - `annotation`: CRUD for highlights and notes.
//! - `backup`: Create, list, inspect, and restore backups.
//! - `bookmark`: Create, list, and delete bookmarks.
//! - `books`: Metadata updates, reading status, trash/restore/delete.
//! - `collection`: Manage collections and add books.
//! - `diagnostics`: Run system health checks.
//! - `import`: File/directory import and drag‑and‑drop handling.
//! - `jobs`: Query and cancel long‑running background jobs.
//! - `library`: List books with filtering/sorting, get details, bulk operations.
//! - `maintenance`: Reconcile files, rebuild search index, vacuum DB, etc.
//! - `progress`: Save and retrieve reading progress (if separate).
//! - `reader`: Open documents, fetch chapters/pages, search within document.
//! - `search`: Full‑text search across the library.
//! - `settings`: Get and update user preferences.

pub mod annotation;
pub mod backup;
pub mod bookmark;
pub mod books;
pub mod collection;
pub mod diagnostics;
pub mod import;
pub mod jobs;
pub mod library;
pub mod maintenance;
pub mod progress;
pub mod reader;
pub mod search;
pub mod settings;

// Re‑export all command functions for easier use by Tauri.
pub use annotation::*;
pub use backup::*;
pub use bookmark::*;
pub use books::*;
pub use collection::*;
pub use diagnostics::*;
pub use import::*;
pub use jobs::*;
pub use library::*;
pub use maintenance::*;
pub use progress::*;
pub use reader::*;
pub use search::*;
pub use settings::*;