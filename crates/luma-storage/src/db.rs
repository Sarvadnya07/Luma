use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::error::{StorageError, StorageResult};
use crate::migrations::run_migrations;

#[derive(Clone)]
pub struct Database {
    writer_conn: Arc<Mutex<Connection>>,
    reader_conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Open or create an on-disk SQLite database with separated writer and reader connections
    pub fn open<P: AsRef<Path>>(path: P) -> StorageResult<Self> {
        let p = path.as_ref();
        let mut writer = Connection::open(p)?;
        Self::configure_pragmas(&mut writer)?;
        run_migrations(&mut writer)?;

        // Dedicated reader connection with query-only optimizations
        let mut reader = Connection::open(p)?;
        Self::configure_reader_pragmas(&mut reader)?;

        Ok(Self {
            writer_conn: Arc::new(Mutex::new(writer)),
            reader_conn: Arc::new(Mutex::new(reader)),
        })
    }

    /// Open an in-memory SQLite database (ideal for tests and temporary operations)
    pub fn open_in_memory() -> StorageResult<Self> {
        let mut writer = Connection::open_in_memory()?;
        Self::configure_pragmas(&mut writer)?;
        run_migrations(&mut writer)?;

        let shared = Arc::new(Mutex::new(writer));
        Ok(Self {
            writer_conn: shared.clone(),
            reader_conn: shared,
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

    fn configure_reader_pragmas(conn: &mut Connection) -> StorageResult<()> {
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA query_only = ON;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -64000; -- 64MB cache
            "#,
        )?;
        Ok(())
    }

    /// Execute a closure with access to the dedicated writer connection
    pub fn with_write_conn<F, R>(&self, f: F) -> StorageResult<R>
    where
        F: FnOnce(&mut Connection) -> StorageResult<R>,
    {
        let mut lock = self
            .writer_conn
            .lock()
            .map_err(|e| StorageError::LockError(e.to_string()))?;
        f(&mut lock)
    }

    /// Execute a closure with access to the dedicated reader connection
    pub fn with_read_conn<F, R>(&self, f: F) -> StorageResult<R>
    where
        F: FnOnce(&mut Connection) -> StorageResult<R>,
    {
        let mut lock = self
            .reader_conn
            .lock()
            .map_err(|e| StorageError::LockError(e.to_string()))?;
        f(&mut lock)
    }

    /// Primary access method (delegates to writer connection for transactional safety & backward compatibility)
    pub fn with_conn<F, R>(&self, f: F) -> StorageResult<R>
    where
        F: FnOnce(&mut Connection) -> StorageResult<R>,
    {
        self.with_write_conn(f)
    }
}
