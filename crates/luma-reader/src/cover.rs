use std::fs;
use std::path::{Path, PathBuf};

use luma_core::error::{LumaError, Result};
use luma_core::ids::{BookId, CoverImageId};
use luma_core::models::ingest::CoverImage;
use luma_security::compute_sha256;

pub struct CoverStore {
    base_dir: PathBuf,
}

impl CoverStore {
    pub fn new<P: AsRef<Path>>(base_dir: P) -> Self {
        let dir = base_dir.as_ref().to_path_buf();
        let _ = fs::create_dir_all(&dir);
        Self { base_dir: dir }
    }

    /// Save cover image bytes to local store and return CoverImage record
    pub fn save_cover(
        &self,
        book_id: Option<BookId>,
        data: &[u8],
        mime_type: &str,
    ) -> Result<CoverImage> {
        let hash = compute_sha256(data);
        let ext = match mime_type {
            "image/png" => "png",
            "image/webp" => "webp",
            _ => "jpg",
        };

        let filename = format!("{}.{}", hash, ext);
        let target_path = self.base_dir.join(&filename);

        fs::write(&target_path, data).map_err(|e| {
            LumaError::StorageError(format!("Failed to write cover image file: {}", e))
        })?;

        let relative_path = format!("covers/{}", filename);

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

    pub fn get_cover_path(&self, relative_path: &str) -> PathBuf {
        let filename = Path::new(relative_path).file_name().unwrap_or_default();
        self.base_dir.join(filename)
    }
}
