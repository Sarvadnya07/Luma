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
    let mut cleaned = input.to_string();

    let dangerous_tag_pairs = [
        ("<script", "</script>"),
        ("<iframe", "</iframe>"),
        ("<object", "</object>"),
        ("<embed", "</embed>"),
        ("<applet", "</applet>"),
        ("<form", "</form>"),
    ];

    // 1. Recursive removal of dangerous tag pairs until fixed-point (prevents <scr<script>ipt> evasion)
    let mut changed = true;
    while changed {
        let before_len = cleaned.len();
        for (start_tag, end_tag) in dangerous_tag_pairs {
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
        changed = cleaned.len() != before_len;
    }

    // 2. Neutralize inline event handlers (e.g. `onload=`, `onerror=`, `onclick=`)
    if let Ok(event_regex) = regex::Regex::new(r#"(?i)\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)"#) {
        cleaned = event_regex.replace_all(&cleaned, " ").to_string();
    }

    // 3. Neutralize `javascript:` pseudo-protocol URIs in attributes
    if let Ok(js_proto_regex) = regex::Regex::new(r#"(?i)javascript:\s*"#) {
        cleaned = js_proto_regex.replace_all(&cleaned, "blocked-javascript:").to_string();
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

    #[test]
    fn test_html_sanitizer_nested_bypass_prevention() {
        let nested = "<div><scr<script>ipt>alert(1)</script>Safe Text</div>";
        let cleaned = sanitize_untrusted_html(nested);
        assert!(!cleaned.contains("<script"));
        assert!(cleaned.contains("Safe Text"));
    }

    #[test]
    fn test_html_sanitizer_event_handler_stripping() {
        let dirty_img = r#"<img src="valid.jpg" onerror="alert('pwned')" onload="steal()" alt="Cover" />"#;
        let cleaned = sanitize_untrusted_html(dirty_img);
        assert!(!cleaned.contains("onerror"));
        assert!(!cleaned.contains("onload"));
        assert!(cleaned.contains("src=\"valid.jpg\""));
        assert!(cleaned.contains("alt=\"Cover\""));
    }

    #[test]
    fn test_html_sanitizer_javascript_protocol() {
        let dirty_link = r#"<a href="javascript:alert('xss')">Click Here</a>"#;
        let cleaned = sanitize_untrusted_html(dirty_link);
        assert!(!cleaned.contains("href=\"javascript:"));
        assert!(cleaned.contains("Click Here"));
    }
}
