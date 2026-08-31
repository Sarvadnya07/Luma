use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use luma_core::error::{LumaError, Result};
use luma_core::models::book::DocumentFormat;

pub struct FormatDetector;

impl FormatDetector {
    /// Detect format from a file path using layered detection (magic bytes -> container inspection -> extension)
    pub fn detect_from_file<P: AsRef<Path>>(path: P) -> Result<DocumentFormat> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref).map_err(|e| {
            LumaError::DocumentError(format!("Failed to open file for format detection: {}", e))
        })?;

        let mut header = [0u8; 1024];
        let bytes_read = file.read(&mut header).unwrap_or(0);
        let header_slice = &header[..bytes_read];

        // 1. Check PDF Magic Header (%PDF-)
        if header_slice.starts_with(b"%PDF-") {
            return Ok(DocumentFormat::Pdf);
        }

        // 2. Check RAR/CBR Magic Header (Rar!\x1A\x07)
        if header_slice.starts_with(b"Rar!\x1A\x07")
            || header_slice.starts_with(b"Rar!\x1A\x07\x01\x00")
        {
            return Ok(DocumentFormat::Cbr);
        }

        // 3. Check ZIP Magic Header (PK\x03\x04 or PK\x05\x06 or PK\x07\x08)
        if header_slice.starts_with(b"PK\x03\x04") || header_slice.starts_with(b"PK\x05\x06") {
            let _ = file.seek(SeekFrom::Start(0));
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                // If it contains "mimetype" entry with "application/epub+zip", it's EPUB
                if let Ok(mut mimetype_entry) = archive.by_name("mimetype") {
                    let mut content = String::new();
                    if mimetype_entry.read_to_string(&mut content).is_ok()
                        && content.trim().contains("application/epub+zip")
                    {
                        return Ok(DocumentFormat::Epub);
                    }
                }

                // If it contains META-INF/container.xml, it is definitely EPUB
                if archive.by_name("META-INF/container.xml").is_ok() {
                    return Ok(DocumentFormat::Epub);
                }

                // Otherwise, if it has image files (.jpg, .png, .webp), treat as CBZ comic
                for i in 0..archive.len().min(30) {
                    if let Ok(entry) = archive.by_index(i) {
                        let name_lower = entry.name().to_lowercase();
                        if name_lower.ends_with(".jpg")
                            || name_lower.ends_with(".jpeg")
                            || name_lower.ends_with(".png")
                            || name_lower.ends_with(".webp")
                        {
                            return Ok(DocumentFormat::Cbz);
                        }
                    }
                }
            }

            // Fallback by extension for Zip containers
            if let Some(ext) = path_ref.extension().and_then(|e| e.to_str()) {
                if ext.eq_ignore_ascii_case("epub") {
                    return Ok(DocumentFormat::Epub);
                }
                if ext.eq_ignore_ascii_case("cbz") {
                    return Ok(DocumentFormat::Cbz);
                }
            }
        }

        // 4. Check Text / Markdown / HTML heuristics
        if let Some(ext) = path_ref.extension().and_then(|e| e.to_str()) {
            match ext.to_lowercase().as_str() {
                "epub" => return Ok(DocumentFormat::Epub),
                "pdf" => return Ok(DocumentFormat::Pdf),
                "cbz" => return Ok(DocumentFormat::Cbz),
                "cbr" => return Ok(DocumentFormat::Cbr),
                "md" | "markdown" => return Ok(DocumentFormat::Md),
                "txt" => return Ok(DocumentFormat::Txt),
                "html" | "htm" | "xhtml" => return Ok(DocumentFormat::Html),
                _ => {}
            }
        }

        // Check if plain UTF-8 text with HTML tags or plain text
        if std::str::from_utf8(header_slice).is_ok() {
            let sample = String::from_utf8_lossy(header_slice).to_lowercase();
            if sample.contains("<!doctype html") || sample.contains("<html") {
                return Ok(DocumentFormat::Html);
            }
            if sample.starts_with("# ") || sample.contains("\n# ") || sample.starts_with("---") {
                return Ok(DocumentFormat::Md);
            }
            return Ok(DocumentFormat::Txt);
        }

        Err(LumaError::UnsupportedFormat(format!(
            "Unrecognized format for file: {}",
            path_ref.display()
        )))
    }
}

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
        let format = FormatDetector::detect_from_file(file.path()).unwrap();
        assert_eq!(format, DocumentFormat::Pdf);
    }

    #[test]
    fn test_detect_plain_text_and_markdown() {
        let mut txt_file = NamedTempFile::new().unwrap();
        txt_file
            .write_all(b"Plain text content without markdown headers.")
            .unwrap();
        assert_eq!(
            FormatDetector::detect_from_file(txt_file.path()).unwrap(),
            DocumentFormat::Txt
        );

        let mut md_file = NamedTempFile::new().unwrap();
        md_file
            .write_all(b"# Chapter 1: Introduction\n\nThis is markdown text.")
            .unwrap();
        assert_eq!(
            FormatDetector::detect_from_file(md_file.path()).unwrap(),
            DocumentFormat::Md
        );
    }
}
