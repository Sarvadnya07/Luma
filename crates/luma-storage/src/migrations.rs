use rusqlite::{Connection, Transaction};
use crate::error::StorageResult;

pub const V1_INITIAL_SCHEMA: &str = r#"
-- Schema version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
);

-- Books table
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    series_id TEXT,
    series_index REAL,
    description TEXT,
    publisher TEXT,
    published_date TEXT,
    language TEXT,
    isbn TEXT,
    cover_image_path TEXT,
    primary_file_id TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at);
CREATE INDEX IF NOT EXISTS idx_books_is_deleted ON books(is_deleted);

-- Book Files table
CREATE TABLE IF NOT EXISTS book_files (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    format TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    sha256_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_book_files_book_id ON book_files(book_id);
CREATE INDEX IF NOT EXISTS idx_book_files_hash ON book_files(sha256_hash);

-- Authors table
CREATE TABLE IF NOT EXISTS authors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_name TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS book_authors (
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (book_id, author_id)
);

-- Annotations table
CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    annotation_type TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    quote TEXT NOT NULL,
    note TEXT,
    anchor_payload_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_annotations_book_id ON annotations(book_id);
CREATE INDEX IF NOT EXISTS idx_annotations_updated_at ON annotations(updated_at);

-- Reading Progress table
CREATE TABLE IF NOT EXISTS reading_progress (
    book_id TEXT PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    progress_percentage REAL NOT NULL DEFAULT 0.0,
    current_locator TEXT NOT NULL,
    current_chapter_title TEXT,
    current_page_number INTEGER,
    total_pages INTEGER,
    last_read_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
);

-- Reading Sessions table
CREATE TABLE IF NOT EXISTS reading_sessions (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    start_progress_pct REAL NOT NULL,
    end_progress_pct REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    locator TEXT NOT NULL,
    title TEXT,
    chapter_title TEXT,
    page_number INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    device_id TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_book_id ON bookmarks(book_id);

-- Change Records table for future Sync causality tracking
CREATE TABLE IF NOT EXISTS change_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_change_records_entity ON change_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_records_occurred_at ON change_records(occurred_at);
"#;

pub fn run_migrations(conn: &mut Connection) -> StorageResult<()> {
    let tx = conn.transaction()?;

    // Create migration tracking table if not exists
    tx.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
        [],
    )?;

    let mut current_version = 0;
    let mut stmt = tx.prepare("SELECT MAX(version) FROM schema_migrations")?;
    let mut rows = stmt.query([])?;
    if let Some(row) = rows.next()? {
        if let Ok(v) = row.get::<_, i64>(0) {
            current_version = v;
        }
    }
    drop(rows);
    drop(stmt);

    if current_version < 1 {
        tx.execute_batch(V1_INITIAL_SCHEMA)?;
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'))",
            [],
        )?;
    }

    tx.commit()?;
    Ok(())
}
