// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod context;

use context::LumaAppContext;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,luma=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Resolve persistent local data directory for SQLite, library, staging, and backups
    let data_dir = std::env::var("LUMA_DATA_DIR")
        .ok()
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| std::env::current_dir().unwrap_or_default().join("data"));

    tracing::info!("Initializing LumaAppContext at: {}", data_dir.display());
    let context = LumaAppContext::new(&data_dir);
    let app_ctx = context.clone();

    tauri::Builder::default()
        .manage(context)
        .setup(move |app| {
            app_ctx.spawn_event_bridge(app.handle().clone());
            tracing::info!("Luma Backend-01 Application Services and Event Bridge active");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Library & Bulk
            commands::list_books,
            commands::get_book_details,
            commands::bulk_add_tags,
            commands::bulk_add_to_collection,
            commands::bulk_trash_books,
            commands::bulk_set_reading_status,
            // Books
            commands::update_book_metadata,
            commands::set_reading_status,
            commands::trash_book,
            commands::restore_book,
            commands::delete_book_permanently,
            // Import & File Picker
            commands::pick_import_files,
            commands::pick_import_directory,
            commands::import_files,
            commands::import_directory,
            commands::import_file_bytes,
            commands::reconcile_library_files,
            // Collections, Tags, Authors, Series
            commands::list_collections,
            commands::create_collection,
            commands::add_books_to_collection,
            commands::list_tags,
            commands::add_tag_to_book,
            commands::remove_tag_from_book,
            commands::list_authors,
            commands::list_series,
            // Search
            commands::search_library,
            // Reader
            commands::open_reader_document,
            commands::get_reader_chapter,
            commands::get_reader_pdf_page,
            commands::get_book_file_bytes,
            commands::search_document,
            // Reading Progress
            commands::get_reading_progress,
            commands::save_reading_progress,
            // Bookmarks
            commands::list_bookmarks,
            commands::create_bookmark,
            commands::delete_bookmark,
            // Annotations & Anchor
            commands::list_annotations,
            commands::save_annotation,
            commands::update_annotation_note,
            commands::delete_annotation,
            commands::resolve_anchor,
            // Settings
            commands::get_setting,
            commands::set_setting,
            commands::get_all_settings,
            // Backup
            commands::create_backup,
            commands::list_backups,
            commands::inspect_backup,
            commands::restore_backup,
            // Maintenance
            commands::maintenance_reconcile_files,
            commands::maintenance_rebuild_search_index,
            commands::maintenance_cleanup_caches,
            commands::maintenance_vacuum_database,
            // Diagnostics
            commands::run_diagnostics,
            // Background Jobs
            commands::get_job_progress,
            commands::cancel_job,
            commands::list_recent_jobs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running luma application");
}
