use std::fs;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_security::compute_sha256_reader;

// ============================================================================
// Constants – default directory names
// ============================================================================

/// Default name for the library directory (inside data root).
pub const DEFAULT_LIBRARY_DIR_NAME: &str = "library";

/// Default name for the staging directory (temporary files).
pub const DEFAULT_STAGING_DIR_NAME: &str = "staging";

/// Default name for the covers directory (inside library).
pub const DEFAULT_COVERS_DIR_NAME: &str = "covers";

/// Default name for the backups directory.
pub const DEFAULT_BACKUPS_DIR_NAME: &str = "backups";

/// Fallback filename for staged files when the original name cannot be determined.
pub const DEFAULT_STAGED_FILENAME: &str = "staged_doc";

const ERR_NOT_FOUND_ENTITY: &str = "File";

// ============================================================================
// Configuration
// ============================================================================

/// Configuration for the file service.
#[derive(Debug, Clone)]
pub struct FileServiceConfig {
    /// Root data directory (absolute or relative).
    pub data_dir: PathBuf,
    /// Name of the library subdirectory (default: "library").
    pub library_dir_name: String,
    /// Name of the staging subdirectory (default: "staging").
    pub staging_dir_name: String,
    /// Name of the covers subdirectory inside library (default: "covers").
    pub covers_dir_name: String,
    /// Name of the backups subdirectory (default: "backups").
    pub backups_dir_name: String,
}

impl FileServiceConfig {
    /// Creates a new config with default directory names, rooted at `data_dir`.
    pub fn new(data_dir: impl AsRef<Path>) -> Self {
        Self {
            data_dir: data_dir.as_ref().to_path_buf(),
            library_dir_name: DEFAULT_LIBRARY_DIR_NAME.to_string(),
            staging_dir_name: DEFAULT_STAGING_DIR_NAME.to_string(),
            covers_dir_name: DEFAULT_COVERS_DIR_NAME.to_string(),
            backups_dir_name: DEFAULT_BACKUPS_DIR_NAME.to_string(),
        }
    }

    /// Returns the full path for the library directory.
    pub fn library_dir(&self) -> PathBuf {
        self.data_dir.join(&self.library_dir_name)
    }

    /// Returns the full path for the staging directory.
    pub fn staging_dir(&self) -> PathBuf {
        self.data_dir.join(&self.staging_dir_name)
    }

    /// Returns the full path for the covers directory.
    pub fn covers_dir(&self) -> PathBuf {
        self.library_dir().join(&self.covers_dir_name)
    }

    /// Returns the full path for the backups directory.
    pub fn backups_dir(&self) -> PathBuf {
        self.data_dir.join(&self.backups_dir_name)
    }

    /// Ensures all required directories exist.
    pub fn ensure_dirs(&self) -> Result<()> {
        fs::create_dir_all(self.library_dir())
            .map_err(|e| LumaError::StorageError(format!("Failed to create library dir: {}", e)))?;
        fs::create_dir_all(self.staging_dir())
            .map_err(|e| LumaError::StorageError(format!("Failed to create staging dir: {}", e)))?;
        fs::create_dir_all(self.covers_dir())
            .map_err(|e| LumaError::StorageError(format!("Failed to create covers dir: {}", e)))?;
        fs::create_dir_all(self.backups_dir())
            .map_err(|e| LumaError::StorageError(format!("Failed to create backups dir: {}", e)))?;
        Ok(())
    }
}

// ============================================================================
// StagedFile
// ============================================================================

pub struct StagedFile {
    pub staging_path: PathBuf,
    pub original_filename: String,
    committed: bool,
}

impl Drop for StagedFile {
    fn drop(&mut self) {
        if !self.committed && self.staging_path.exists() {
            let _ = fs::remove_file(&self.staging_path);
        }
    }
}

impl StagedFile {
    /// Commits the staged file to the final target path.
    pub fn commit(mut self, target_path: &Path) -> Result<()> {
        if let Some(parent) = target_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        fs::rename(&self.staging_path, target_path)
            .or_else(|_| {
                fs::copy(&self.staging_path, target_path)
                    .map(|_| ())
                    .and_then(|_| fs::remove_file(&self.staging_path))
            })
            .map_err(|e| {
                LumaError::StorageError(format!(
                    "Failed to commit staged file to {}: {}",
                    target_path.display(),
                    e
                ))
            })?;

        self.committed = true;
        Ok(())
    }
}

// ============================================================================
// FileService
// ============================================================================

#[derive(Clone)]
pub struct FileService {
    config: FileServiceConfig,
}

impl FileService {
    /// Creates a new file service using the default configuration (all directories under `data_dir`).
    pub fn new<P: AsRef<Path>>(data_dir: P) -> Self {
        let config = FileServiceConfig::new(data_dir);
        Self::with_config(config)
    }

    /// Creates a new file service with a custom configuration.
    pub fn with_config(config: FileServiceConfig) -> Self {
        // Ensure directories exist
        if let Err(e) = config.ensure_dirs() {
            tracing::warn!("Failed to create file service directories: {}", e);
        }
        Self { config }
    }

    // ------------------------------------------------------------------------
    // Directory accessors
    // ------------------------------------------------------------------------

    pub fn library_dir(&self) -> PathBuf {
        self.config.library_dir()
    }

    pub fn staging_dir(&self) -> PathBuf {
        self.config.staging_dir()
    }

    pub fn covers_dir(&self) -> PathBuf {
        self.config.covers_dir()
    }

    pub fn backups_dir(&self) -> PathBuf {
        self.config.backups_dir()
    }

    /// Cleans up any leftover temporary files in staging.
    pub fn cleanup_staging(&self) -> Result<usize> {
        let mut count = 0usize;
        let staging = self.config.staging_dir();
        if staging.exists() {
            if let Ok(entries) = fs::read_dir(&staging) {
                for entry in entries.flatten() {
                    if let Ok(file_type) = entry.file_type() {
                        if file_type.is_file() && fs::remove_file(entry.path()).is_ok() {
                            count += 1;
                        }
                    }
                }
            }
        }
        Ok(count)
    }

    // ------------------------------------------------------------------------
    // File operations
    // ------------------------------------------------------------------------

    /// Validates that a path exists and returns its canonicalized form.
    pub fn validate_path<P: AsRef<Path>>(&self, path: P) -> Result<PathBuf> {
        let p = path.as_ref();
        if !p.exists() {
            return Err(LumaError::NotFound {
                entity_type: ERR_NOT_FOUND_ENTITY.to_string(),
                id: p.to_string_lossy().to_string(),
            });
        }

        p.canonicalize().map_err(|e| {
            LumaError::StorageError(format!(
                "Failed to canonicalize path {}: {}",
                p.display(),
                e
            ))
        })
    }

    /// Reads the entire file content into memory as bytes.
    pub fn read_bytes<P: AsRef<Path>>(&self, path: P) -> Result<Vec<u8>> {
        let p = path.as_ref();
        fs::read(p).map_err(|e| {
            LumaError::StorageError(format!("Failed to read file {}: {}", p.display(), e))
        })
    }

    /// Computes the SHA‑256 hash and file size using a streaming reader.
    pub fn hash_file<P: AsRef<Path>>(&self, path: P) -> Result<(String, u64)> {
        let p = path.as_ref();
        let file = fs::File::open(p).map_err(|e| {
            LumaError::StorageError(format!(
                "Failed to open file for hashing {}: {}",
                p.display(),
                e
            ))
        })?;
        compute_sha256_reader(std::io::BufReader::new(file))
    }

    /// Copies a source file into the staging directory, returning a `StagedFile` handle.
    pub fn stage_file<P: AsRef<Path>>(&self, source_path: P) -> Result<StagedFile> {
        let src = source_path.as_ref();
        let orig_name = src
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(DEFAULT_STAGED_FILENAME)
            .to_string();

        let stage_name = format!("{}_{}", uuid::Uuid::new_v4(), orig_name);
        let stage_path = self.config.staging_dir().join(stage_name);

        fs::copy(src, &stage_path).map_err(|e| {
            LumaError::StorageError(format!(
                "Failed to stage file {} to {}: {}",
                src.display(),
                stage_path.display(),
                e
            ))
        })?;

        Ok(StagedFile {
            staging_path: stage_path,
            original_filename: orig_name,
            committed: false,
        })
    }
}