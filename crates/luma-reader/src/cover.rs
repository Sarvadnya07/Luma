use std::fs;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_core::ids::{BookId, CoverImageId};
use luma_core::models::ingest::CoverImage;
use luma_security::compute_sha256;

// ============================================================================
// Constants – configuration
// ============================================================================

/// Default subdirectory for cover images within the store.
const COVERS_DIR_NAME: &str = "covers";

/// Default fallback file extension when mime type is unknown.
const DEFAULT_IMAGE_EXT: &str = "jpg";

// ============================================================================
// CoverStore
// ============================================================================

#[derive(Clone, Debug)]
pub struct CoverStore {
    base_dir: PathBuf,
    /// Optional mapping of mime types to file extensions (without dot).
    /// If not provided, uses a built‑in mapping.
    ext_map: Option<std::collections::HashMap<String, String>>,
}

impl CoverStore {
    /// Creates a new cover store at the given base directory.
    /// The directory will be created if it does not exist.
    pub fn new<P: AsRef<Path>>(base_dir: P) -> Self {
        let dir = base_dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        Self {
            base_dir: dir,
            ext_map: None,
        }
    }

    /// Creates a new cover store with a custom extension mapping.
    /// The map should map mime types (e.g., "image/png") to file extensions (e.g., "png").
    pub fn with_extension_map<P: AsRef<Path>>(
        base_dir: P,
        ext_map: std::collections::HashMap<String, String>,
    ) -> Self {
        let dir = base_dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        Self {
            base_dir: dir,
            ext_map: Some(ext_map),
        }
    }

    /// Saves cover image bytes to the store and returns a `CoverImage` record.
    pub fn save_cover(
        &self,
        book_id: Option<BookId>,
        data: &[u8],
        mime_type: &str,
    ) -> Result<CoverImage> {
        let hash = compute_sha256(data);
        let ext = self.extension_for_mime(mime_type);
        let filename = format!("{}.{}", hash, ext);
        let relative_path = format!("{}/{}", COVERS_DIR_NAME, filename);
        let target_path = self.base_dir.join(&filename);

        fs::write(&target_path, data).map_err(|e| {
            LumaError::StorageError(format!(
                "Failed to write cover image file '{}': {}",
                target_path.display(),
                e
            ))
        })?;

        Ok(CoverImage {
            id: CoverImageId::new(),
            book_id,
            file_size_bytes: data.len() as u64,
            sha256_hash: hash,
            mime_type: mime_type.to_string(),
            relative_path,
            width: None,
            height: None,
            created_at: chrono::Utc::now(),
        })
    }

    /// Returns the absolute filesystem path for a cover given its relative path.
    /// The path is constructed using only the filename component of the relative path.
    pub fn get_cover_path(&self, relative_path: &str) -> PathBuf {
        let filename = Path::new(relative_path).file_name().unwrap_or_default();
        self.base_dir.join(filename)
    }

    /// Deletes a cover file from the store.
    pub fn delete_cover(&self, relative_path: &str) -> Result<()> {
        let path = self.get_cover_path(relative_path);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| {
                LumaError::StorageError(format!(
                    "Failed to delete cover file '{}': {}",
                    path.display(),
                    e
                ))
            })?;
        }
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------------

    /// Determines the file extension for a given mime type.
    /// Uses a built‑in mapping if no custom map is provided, falling back to `DEFAULT_IMAGE_EXT`.
    fn extension_for_mime(&self, mime_type: &str) -> &str {
        if let Some(map) = &self.ext_map {
            if let Some(ext) = map.get(mime_type) {
                return ext;
            }
        }

        // Built‑in fallback
        match mime_type {
            "image/png" => "png",
            "image/webp" => "webp",
            "image/jpeg" | "image/jpg" => "jpg",
            _ => DEFAULT_IMAGE_EXT,
        }
    }
}