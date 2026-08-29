use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Database SQLite error: {0}")]
    Sqlite(#[from] rusqlite::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Migration failed: {0}")]
    MigrationFailed(String),

    #[error("Connection lock or pool error: {0}")]
    LockError(String),
}

pub type StorageResult<T> = Result<T, StorageError>;
