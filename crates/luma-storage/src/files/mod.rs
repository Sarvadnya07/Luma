use std::fs;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_security::compute_sha256_reader;

#[derive(Clone)]
pub struct FileService {
    library_dir: PathBuf,
    staging_dir: PathBuf,
    covers_dir: PathBuf,
    backups_dir: PathBuf,
}

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

impl FileService {
    pub fn new<P: AsRef<Path>>(data_dir: P) -> Self {
        let root = data_dir.as_ref().to_path_buf();
        let library_dir = root.join("library");
        let staging_dir = root.join("staging");
        let covers_dir = library_dir.join("covers");
        let backups_dir = root.join("backups");

        let _ = fs::create_dir_all(&library_dir);
        let _ = fs::create_dir_all(&staging_dir);
        let _ = fs::create_dir_all(&covers_dir);
        let _ = fs::create_dir_all(&backups_dir);

        Self {
            library_dir,
            staging_dir,
            covers_dir,
            backups_dir,
        }
    }

    pub fn library_dir(&self) -> &Path {
        &self.library_dir
    }

    pub fn staging_dir(&self) -> &Path {
        &self.staging_dir
    }

    pub fn covers_dir(&self) -> &Path {
        &self.covers_dir
    }

    pub fn backups_dir(&self) -> &Path {
        &self.backups_dir
    }

    /// Check if path is safe and canonicalize
    pub fn validate_path<P: AsRef<Path>>(&self, path: P) -> Result<PathBuf> {
        let p = path.as_ref();
        if !p.exists() {
            return Err(LumaError::NotFound {
                entity_type: "File".to_string(),
                id: p.to_string_lossy().to_string(),
            });
        }

        // Canonicalize if possible
        p.canonicalize().map_err(|e| {
            LumaError::StorageError(format!(
                "Failed to canonicalize path {}: {}",
                p.display(),
                e
            ))
        })
    }

    /// Read file bytes with security validation
    pub fn read_bytes<P: AsRef<Path>>(&self, path: P) -> Result<Vec<u8>> {
        let p = path.as_ref();
        fs::read(p).map_err(|e| {
            LumaError::StorageError(format!("Failed to read file {}: {}", p.display(), e))
        })
    }

    /// Compute SHA256 of file using streaming reader in constant O(1) memory
    pub fn hash_file<P: AsRef<Path>>(&self, path: P) -> Result<(String, u64)> {
        let p = path.as_ref();
        let file = fs::File::open(p).map_err(|e| {
            LumaError::StorageError(format!("Failed to open file for hashing {}: {}", p.display(), e))
        })?;
        compute_sha256_reader(std::io::BufReader::new(file))
    }

    /// Stage a source file into the temporary staging directory
    pub fn stage_file<P: AsRef<Path>>(&self, source_path: P) -> Result<StagedFile> {
        let src = source_path.as_ref();
        let orig_name = src
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("staged_doc")
            .to_string();

        let stage_name = format!("{}_{}", uuid::Uuid::new_v4().simple(), orig_name);
        let stage_path = self.staging_dir.join(stage_name);

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

    /// Clean up any orphaned files in the staging directory (e.g., from crashes)
    pub fn cleanup_staging(&self) -> Result<usize> {
        let mut count = 0;
        if let Ok(entries) = fs::read_dir(&self.staging_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && fs::remove_file(&p).is_ok() {
                    count += 1;
                }
            }
        }
        Ok(count)
    }
}
