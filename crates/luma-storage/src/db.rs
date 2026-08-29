use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::error::{StorageError, StorageResult};
use crate::migrations::run_migrations;

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Open or create an on-disk SQLite database with recommended pragmas
    pub fn open<P: AsRef<Path>>(path: P) -> StorageResult<Self> {
        let mut conn = Connection::open(path)?;
        Self::configure_pragmas(&mut conn)?;
        run_migrations(&mut conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Open an in-memory SQLite database (ideal for tests and temporary operations)
    pub fn open_in_memory() -> StorageResult<Self> {
        let mut conn = Connection::open_in_memory()?;
        Self::configure_pragmas(&mut conn)?;
        run_migrations(&mut conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    fn configure_pragmas(conn: &mut Connection) -> StorageResult<()> {
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -64000; -- 64MB cache
            "#,
        )?;
        Ok(())
    }

    /// Execute a closure with exclusive access to the underlying connection
    pub fn with_conn<F, R>(&self, f: F) -> StorageResult<R>
    where
        F: FnOnce(&mut Connection) -> StorageResult<R>,
    {
        let mut lock = self
            .conn
            .lock()
            .map_err(|e| StorageError::LockError(e.to_string()))?;
        f(&mut *lock)
    }
}
