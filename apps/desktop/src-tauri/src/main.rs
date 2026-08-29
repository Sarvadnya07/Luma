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
            commands::get_book,
            commands::get_reading_progress,
            commands::save_reading_progress,
            commands::list_annotations,
            commands::save_annotation,
            commands::resolve_anchor,
        ])
        .run(tauri::generate_context!())
        .expect("error while running luma application");
}
