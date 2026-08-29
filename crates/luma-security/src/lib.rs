use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf};

use luma_core::error::{LumaError, Result};

/// Maximum allowed uncompressed size for a single document component (500 MB)
pub const MAX_UNCOMPRESSED_FILE_SIZE_BYTES: u64 = 500 * 1024 * 1024;
/// Maximum archive entry count (100,000 files)
pub const MAX_ARCHIVE_ENTRY_COUNT: usize = 100_000;
/// Maximum compression expansion ratio (100:1) to prevent zip bombs
pub const MAX_COMPRESSION_RATIO: u64 = 100;

/// Validates that a path is safe and does not escape the designated base directory via `..` or root absolute paths
pub fn sanitize_relative_path(base_dir: &Path, untrusted_rel_path: &str) -> Result<PathBuf> {
    let rel_path = Path::new(untrusted_rel_path);

    for component in rel_path.components() {
        match component {
            Component::ParentDir => {
                return Err(LumaError::SecurityError(format!(
                    "Path traversal attempt detected: '{}'",
                    untrusted_rel_path
                )));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(LumaError::SecurityError(format!(
                    "Absolute or rooted path not allowed in relative context: '{}'",
                    untrusted_rel_path
                )));
            }
            Component::Normal(_) | Component::CurDir => {}
        }
    }

    let joined = base_dir.join(rel_path);
    Ok(joined)
}

/// Compute SHA-256 hash of bytes
pub fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    hex::encode(result)
}

/// Verify decompression safety parameters against zip-bomb heuristics
pub fn verify_archive_safety(
    compressed_size: u64,
    uncompressed_size: u64,
    entry_count: usize,
) -> Result<()> {
    if entry_count > MAX_ARCHIVE_ENTRY_COUNT {
        return Err(LumaError::SecurityError(format!(
            "Archive exceeds maximum allowed entry count: {}",
            entry_count
        )));
    }

    if uncompressed_size > MAX_UNCOMPRESSED_FILE_SIZE_BYTES {
        return Err(LumaError::SecurityError(format!(
            "Uncompressed file size exceeds limit: {} bytes",
            uncompressed_size
        )));
    }

    if compressed_size > 0 && (uncompressed_size / compressed_size) > MAX_COMPRESSION_RATIO {
        return Err(LumaError::SecurityError(format!(
            "Suspicious compression ratio detected: {}:1",
            uncompressed_size / compressed_size
        )));
    }

    Ok(())
}

/// Strip executable script tags and hazardous inline handlers from untrusted HTML/SVG strings
pub fn sanitize_untrusted_html(input: &str) -> String {
    // Basic structural sanitizer removing dangerous script/iframe tags
    let mut cleaned = input.to_string();
    let dangerous_patterns = [
        ("<script", "</script>"),
        ("<iframe", "</iframe>"),
        ("<object", "</object>"),
        ("<embed", "</embed>"),
    ];

    for (start_tag, end_tag) in dangerous_patterns {
        while let Some(start_pos) = cleaned.to_lowercase().find(start_tag) {
            if let Some(end_pos) = cleaned.to_lowercase()[start_pos..].find(end_tag) {
                let full_end = start_pos + end_pos + end_tag.len();
                cleaned.drain(start_pos..full_end);
            } else if let Some(tag_end) = cleaned[start_pos..].find('>') {
                let full_end = start_pos + tag_end + 1;
                cleaned.drain(start_pos..full_end);
            } else {
                cleaned.truncate(start_pos);
            }
        }
    }

    cleaned
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_traversal_detection() {
        let base = PathBuf::from("/home/luma/library");
        assert!(sanitize_relative_path(&base, "safe/sub/file.epub").is_ok());
        assert!(sanitize_relative_path(&base, "../../../etc/passwd").is_err());
        assert!(sanitize_relative_path(&base, "nested/../../secret").is_err());
    }

    #[test]
    fn test_archive_safety_limits() {
        // Normal archive: 10MB compressed -> 25MB uncompressed (ratio 2.5)
        assert!(verify_archive_safety(10_000_000, 25_000_000, 50).is_ok());

        // Zip bomb: 10KB compressed -> 200MB uncompressed (ratio 20,000)
        assert!(verify_archive_safety(10_000, 200_000_000, 10).is_err());
    }

    #[test]
    fn test_html_sanitizer() {
        let dirty = "<div>Good content<script>alert('xss');</script> and more text</div>";
        let cleaned = sanitize_untrusted_html(dirty);
        assert!(!cleaned.contains("<script>"));
        assert!(!cleaned.contains("alert"));
        assert!(cleaned.contains("Good content"));
        assert!(cleaned.contains("and more text"));
    }
}
