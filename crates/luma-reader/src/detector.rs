use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;

// ============================================================================
// Constants – magic bytes, extensions, and error messages
// ============================================================================

/// Magic bytes for PDF (ISO 32000‑1: appears in first 1024 bytes).
const PDF_MAGIC: &[u8] = b"%PDF-";

/// RAR/CBR magic header.
const RAR_MAGIC: &[u8] = b"Rar!\x1A\x07";

/// ZIP magic headers.
const ZIP_MAGIC_PK_0304: &[u8] = b"PK\x03\x04";
const ZIP_MAGIC_PK_0506: &[u8] = b"PK\x05\x06";
const ZIP_MAGIC_PK_0708: &[u8] = b"PK\x07\x08";

/// MIME type for EPUB.
const EPUB_MIME_TYPE: &str = "application/epub+zip";

/// Container file path for EPUB.
const EPUB_CONTAINER_PATH: &str = "META-INF/container.xml";

/// Max number of entries to scan in a ZIP archive for CBZ detection.
const ZIP_SCAN_LIMIT: usize = 30;

// ============================================================================
// Configuration
// ============================================================================

/// Configuration for format detection.
#[derive(Debug, Clone)]
pub struct FormatConfig {
    /// Custom extension → DocumentFormat mapping.
    pub extension_map: Option<std::collections::HashMap<String, DocumentFormat>>,
    /// Additional magic bytes to check (sequence → format).
    pub magic_map: Option<Vec<(Vec<u8>, DocumentFormat)>>,
    /// Whether to fall back to extension detection.
    pub fallback_to_extension: bool,
}

impl Default for FormatConfig {
    fn default() -> Self {
        Self {
            extension_map: None,
            magic_map: None,
            fallback_to_extension: true,
        }
    }
}

// ============================================================================
// FormatDetector
// ============================================================================

pub struct FormatDetector {
    config: FormatConfig,
}

impl FormatDetector {
    /// Creates a new detector with default configuration.
    pub fn new() -> Self {
        Self {
            config: FormatConfig::default(),
        }
    }

    /// Creates a detector with custom configuration.
    pub fn with_config(config: FormatConfig) -> Self {
        Self { config }
    }

    /// Detect format from a file path using default detector configuration.
    pub fn detect_from_file<P: AsRef<Path>>(path: P) -> Result<DocumentFormat> {
        Self::new().detect_file(path)
    }

    /// Detect format from a file path using this detector's configuration.
    pub fn detect_file<P: AsRef<Path>>(&self, path: P) -> Result<DocumentFormat> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref).map_err(|e| {
            LumaError::DocumentError(format!("Failed to open file for format detection: {}", e))
        })?;

        let mut header = [0u8; 1024];
        let bytes_read = file.read(&mut header).unwrap_or(0);
        let header_slice = &header[..bytes_read];

        // 1. Check built‑in magic bytes
        if let Some(fmt) = self.check_builtin_magic(header_slice) {
            return Ok(fmt);
        }

        // 2. Check custom magic bytes (if configured)
        if let Some(ref magic_map) = self.config.magic_map {
            for (magic, fmt) in magic_map {
                if header_slice.starts_with(magic) {
                    return Ok(*fmt);
                }
            }
        }

        // 3. Check ZIP‑based formats (EPUB, CBZ)
        if header_slice.starts_with(ZIP_MAGIC_PK_0304)
            || header_slice.starts_with(ZIP_MAGIC_PK_0506)
            || header_slice.starts_with(ZIP_MAGIC_PK_0708)
        {
            let _ = file.seek(SeekFrom::Start(0));
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                if let Some(fmt) = self.inspect_zip_container(&mut archive) {
                    return Ok(fmt);
                }
            }
        }

        // 4. Fallback: extension detection
        if self.config.fallback_to_extension {
            if let Some(ext) = path_ref.extension().and_then(|e| e.to_str()) {
                if let Some(fmt) = self.format_from_extension(ext) {
                    return Ok(fmt);
                }
            }
        }

        // 5. Heuristic: text / HTML / Markdown
        if let Some(fmt) = self.detect_text_format(header_slice) {
            return Ok(fmt);
        }

        Err(LumaError::UnsupportedFormat(format!(
            "Unable to detect document format: {}",
            path_ref.display()
        )))
    }

    // ------------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------------

    /// Checks built‑in magic bytes (PDF, RAR, ZIP).
    fn check_builtin_magic(&self, header: &[u8]) -> Option<DocumentFormat> {
        if header.windows(5).any(|w| w == PDF_MAGIC) {
            return Some(DocumentFormat::Pdf);
        }
        if header.starts_with(RAR_MAGIC) {
            return Some(DocumentFormat::Cbr);
        }
        None
    }

    /// Inspects a ZIP archive to detect EPUB or CBZ.
    fn inspect_zip_container<R: Read + Seek>(&self, archive: &mut zip::ZipArchive<R>) -> Option<DocumentFormat> {
        // Check for EPUB signature
        if let Ok(mut entry) = archive.by_name("mimetype") {
            let mut content = String::new();
            if entry.read_to_string(&mut content).is_ok()
                && content.trim().contains(EPUB_MIME_TYPE)
            {
                return Some(DocumentFormat::Epub);
            }
        }
        if archive.by_name(EPUB_CONTAINER_PATH).is_ok() {
            return Some(DocumentFormat::Epub);
        }

        // Check for CBZ (comic) – scan first N entries for image files
        let image_extensions = ["jpg", "jpeg", "png", "webp"];
        for i in 0..archive.len().min(ZIP_SCAN_LIMIT) {
            if let Ok(entry) = archive.by_index(i) {
                let name_lower = entry.name().to_lowercase();
                if image_extensions.iter().any(|ext| name_lower.ends_with(ext)) {
                    return Some(DocumentFormat::Cbz);
                }
            }
        }
        None
    }

    /// Maps a file extension to a `DocumentFormat` using the built‑in or custom mapping.
    fn format_from_extension(&self, ext: &str) -> Option<DocumentFormat> {
        let ext_lower = ext.to_lowercase();
        // Check custom map first
        if let Some(ref map) = self.config.extension_map {
            if let Some(&fmt) = map.get(&ext_lower) {
                return Some(fmt);
            }
        }
        // Built‑in mapping
        match ext_lower.as_str() {
            "epub" => Some(DocumentFormat::Epub),
            "pdf" => Some(DocumentFormat::Pdf),
            "cbz" => Some(DocumentFormat::Cbz),
            "cbr" => Some(DocumentFormat::Cbr),
            "md" | "markdown" => Some(DocumentFormat::Md),
            "txt" => Some(DocumentFormat::Txt),
            "html" | "htm" | "xhtml" => Some(DocumentFormat::Html),
            _ => None,
        }
    }

    /// Attempts to detect HTML, Markdown, or plain text from a content sample.
    fn detect_text_format(&self, header: &[u8]) -> Option<DocumentFormat> {
        if let Ok(sample) = std::str::from_utf8(header) {
            let lower = sample.to_lowercase();
            if lower.contains("<!doctype html") || lower.contains("<html") {
                return Some(DocumentFormat::Html);
            }
            // Markdown: starts with "# " or contains "\n# " or starts with "---" (frontmatter)
            if lower.starts_with("# ")
                || lower.contains("\n# ")
                || lower.starts_with("---")
                || lower.contains("\n---")
            {
                return Some(DocumentFormat::Md);
            }
            // If it's valid UTF‑8 and not binary, assume plain text
            return Some(DocumentFormat::Txt);
        }
        None
    }
}

impl Default for FormatDetector {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_detect_pdf_signature() {
        let mut file = NamedTempFile::new().unwrap();
        file.write_all(b"%PDF-1.7\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<<>>\nendobj")
            .unwrap();
        let detector = FormatDetector::new();
        let format = detector.detect_file(file.path()).unwrap();
        assert_eq!(format, DocumentFormat::Pdf);
    }

    #[test]
    fn test_detect_plain_text_and_markdown() {
        let detector = FormatDetector::new();

        let mut txt_file = NamedTempFile::new().unwrap();
        txt_file
            .write_all(b"Plain text content without markdown headers.")
            .unwrap();
        assert_eq!(
            detector.detect_file(txt_file.path()).unwrap(),
            DocumentFormat::Txt
        );

        let mut md_file = NamedTempFile::new().unwrap();
        md_file
            .write_all(b"# Chapter 1: Introduction\n\nThis is markdown text.")
            .unwrap();
        assert_eq!(
            detector.detect_file(md_file.path()).unwrap(),
            DocumentFormat::Md
        );
    }
}