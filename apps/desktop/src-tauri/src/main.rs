// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use luma_storage::Database;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,luma=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Initializing Luma Desktop Shell...");

    // Initialize local SQLite storage
    let db = Database::open_in_memory().expect("Failed to initialize database");

    tauri::Builder::default()
        .manage(db)
        .invoke_handler(tauri::generate_handler![
            commands::list_books,
            commands::get_book_details,
            commands::update_book_metadata,
            commands::set_reading_status,
            commands::trash_book,
            commands::restore_book,
            commands::delete_book_permanently,
            commands::get_reading_progress,
            commands::save_reading_progress,
            commands::import_files,
            commands::import_directory,
            commands::reconcile_library_files,
            commands::list_collections,
            commands::create_collection,
            commands::add_books_to_collection,
            commands::list_tags,
            commands::add_tag_to_book,
            commands::remove_tag_from_book,
            commands::list_authors,
            commands::list_series,
            commands::search_library,
            commands::open_reader_document,
            commands::get_reader_chapter,
            commands::get_reader_pdf_page,
            commands::search_document,
            commands::list_bookmarks,
            commands::create_bookmark,
            commands::delete_bookmark,
            commands::list_annotations,
            commands::save_annotation,
            commands::delete_annotation,
            commands::update_annotation_note,
            commands::resolve_anchor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running luma application");
}
