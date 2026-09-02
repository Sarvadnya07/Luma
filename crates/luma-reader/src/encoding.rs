use std::borrow::Cow;
use std::collections::HashMap;

// ============================================================================
// Constants – BOM Markers
// ============================================================================

const UTF8_BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];
const UTF16_LE_BOM: [u8; 2] = [0xFF, 0xFE];
const UTF16_BE_BOM: [u8; 2] = [0xFE, 0xFF];

// ============================================================================
// Constants – Encoding Declarations (for fallback detection)
// ============================================================================

const ENCODING_PATTERNS: [(&str, &str); 6] = [
    ("encoding=\"iso-8859-1\"", "iso-8859-1"),
    ("encoding='iso-8859-1'", "iso-8859-1"),
    ("charset=iso-8859-1", "iso-8859-1"),
    ("encoding=\"windows-1252\"", "windows-1252"),
    ("encoding='windows-1252'", "windows-1252"),
    ("charset=windows-1252", "windows-1252"),
];

// ============================================================================
// Constants – XML/HTML Entity Mapping
// ============================================================================

/// Predefined mapping of entity names to their character representation.
/// This covers XML built‑ins and common HTML5 named entities.
pub const ENTITY_MAP: &[(&str, &str)] = &[
    ("amp", "&"),
    ("lt", "<"),
    ("gt", ">"),
    ("quot", "\""),
    ("apos", "'"),
    ("nbsp", "\u{00A0}"),
    ("mdash", "—"),
    ("ndash", "–"),
    ("lsquo", "‘"),
    ("rsquo", "’"),
    ("ldquo", "“"),
    ("rdquo", "”"),
    ("hellip", "…"),
    ("bull", "•"),
    ("copy", "©"),
    ("reg", "®"),
    ("trade", "™"),
    ("deg", "°"),
    ("plusmn", "±"),
    ("times", "×"),
    ("divide", "÷"),
    ("laquo", "«"),
    ("raquo", "»"),
    ("cent", "¢"),
    ("pound", "£"),
    ("yen", "¥"),
    ("euro", "€"),
    ("sect", "§"),
    ("para", "¶"),
    ("eacute", "é"),
    ("Eacute", "É"),
    ("egrave", "è"),
    ("agrave", "à"),
    ("ccedil", "ç"),
    ("uuml", "ü"),
    ("ouml", "ö"),
    ("auml", "ä"),
];

// ============================================================================
// Constants – Binary Resource Rules
// ============================================================================

/// MIME types that are considered binary (prefix matching).
pub const BINARY_MIME_PREFIXES: &[&str] = &[
    "image/", "font/", "audio/", "video/",
];

/// Exact MIME types considered binary.
pub const BINARY_MIME_EXACT: &[&str] = &[
    "application/font-woff",
    "application/font-woff2",
    "application/x-font-ttf",
    "application/x-font-otf",
    "application/vnd.ms-opentype",
    "application/octet-stream",
];

/// File extensions considered binary (case‑insensitive, without dot).
pub const BINARY_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "gif", "webp", "svg",
    "woff", "woff2", "ttf", "otf",
    "mp3", "mp4",
];

// ============================================================================
// Text Decoder Configuration
// ============================================================================

#[derive(Debug, Clone)]
pub struct TextDecoderConfig {
    /// Whether to attempt UTF‑16 decoding.
    pub try_utf16: bool,
    /// Whether to check for encoding declarations in the first 1KB.
    pub check_encoding_declaration: bool,
    /// Whether to use lossy UTF‑8 fallback when strict decoding fails.
    pub fallback_to_lossy_utf8: bool,
    /// Additional MIME types or extensions to treat as binary (for classification).
    pub binary_rules: BinaryClassifierConfig,
}

impl Default for TextDecoderConfig {
    fn default() -> Self {
        Self {
            try_utf16: true,
            check_encoding_declaration: true,
            fallback_to_lossy_utf8: true,
            binary_rules: BinaryClassifierConfig::default(),
        }
    }
}

// ============================================================================
// Binary Classifier Configuration
// ============================================================================

#[derive(Debug, Clone)]
pub struct BinaryClassifierConfig {
    pub mime_prefixes: Vec<String>,
    pub mime_exact: Vec<String>,
    pub extensions: Vec<String>,
}

impl Default for BinaryClassifierConfig {
    fn default() -> Self {
        Self {
            mime_prefixes: BINARY_MIME_PREFIXES.iter().map(|s| s.to_string()).collect(),
            mime_exact: BINARY_MIME_EXACT.iter().map(|s| s.to_string()).collect(),
            extensions: BINARY_EXTENSIONS.iter().map(|s| s.to_string()).collect(),
        }
    }
}

// ============================================================================
// Text Decoder Core Functions
// ============================================================================

/// Safely decode byte slices into a valid UTF-8 String, handling BOM, XML declarations, and standard legacy fallbacks.
/// Uses the default configuration.
pub fn decode_text_bytes(bytes: &[u8]) -> String {
    decode_text_bytes_with_config(bytes, &TextDecoderConfig::default())
}

/// Decode bytes with a custom configuration.
pub fn decode_text_bytes_with_config(bytes: &[u8], config: &TextDecoderConfig) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    // 1. Check BOMs
    if bytes.len() >= 3 && bytes[0..3] == UTF8_BOM {
        return String::from_utf8_lossy(&bytes[3..]).into_owned();
    }

    if config.try_utf16 {
        if bytes.len() >= 2 && bytes[0..2] == UTF16_LE_BOM {
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                .collect();
            return String::from_utf16_lossy(&u16_slice);
        }
        if bytes.len() >= 2 && bytes[0..2] == UTF16_BE_BOM {
            let u16_slice: Vec<u16> = bytes[2..]
                .chunks_exact(2)
                .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
                .collect();
            return String::from_utf16_lossy(&u16_slice);
        }
    }

    // 2. Try standard UTF-8
    if let Ok(utf8_str) = std::str::from_utf8(bytes) {
        return utf8_str.to_string();
    }

    // 3. Check encoding declaration in header preview
    if config.check_encoding_declaration {
        let header = &bytes[..bytes.len().min(1024)];
        if let Ok(header_str) = std::str::from_utf8(header) {
            let lower = header_str.to_lowercase();
            for (pattern, encoding) in ENCODING_PATTERNS {
                if lower.contains(pattern) && (encoding == "iso-8859-1" || encoding == "windows-1252") {
                    // Map each byte directly to Unicode char
                    return bytes.iter().map(|&b| b as char).collect();
                }
            }
        }
    }

    // 4. Lossy UTF-8 fallback if allowed
    if config.fallback_to_lossy_utf8 {
        String::from_utf8_lossy(bytes).into_owned()
    } else {
        // If no fallback, return empty or error? We'll return lossy anyway for robustness.
        String::from_utf8_lossy(bytes).into_owned()
    }
}

// ============================================================================
// Entity Decoder
// ============================================================================

/// Comprehensive XML & HTML entity decoder supporting standard XML, named HTML5, and numeric entities.
/// Uses the built‑in entity map.
pub fn decode_xml_and_html_entities(input: &str) -> String {
    decode_entities_with_map(input, ENTITY_MAP)
}

/// Decode entities using a custom entity map (as a slice of (name, replacement) tuples).
pub fn decode_entities_with_map(input: &str, entity_map: &[(&str, &str)]) -> String {
    if !input.contains('&') {
        return input.to_string();
    }

    // Build a fast lookup map for named entities (optional, but good for repeated calls)
    // For simplicity, we'll use a HashMap for O(1) lookups.
    let map: HashMap<&str, &str> = entity_map.iter().cloned().collect();

    let mut result = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '&' {
            let mut entity_name = String::with_capacity(12);
            let mut is_closed = false;

            while let Some(&next_ch) = chars.peek() {
                if next_ch == ';' {
                    chars.next();
                    is_closed = true;
                    break;
                } else if next_ch.is_alphanumeric() || next_ch == '#' {
                    entity_name.push(chars.next().unwrap());
                    if entity_name.len() > 16 {
                        break;
                    }
                } else {
                    break;
                }
            }

            if is_closed {
                if let Some(decoded) = resolve_entity_generic(&entity_name, &map) {
                    result.push_str(&decoded);
                    continue;
                }
                // Entity not found: preserve as-is
                result.push('&');
                result.push_str(&entity_name);
                result.push(';');
            } else {
                result.push('&');
                result.push_str(&entity_name);
            }
        } else {
            result.push(ch);
        }
    }

    result
}

/// Resolve a single entity (named or numeric) using a provided map.
fn resolve_entity_generic<'a>(name: &str, map: &HashMap<&str, &'a str>) -> Option<Cow<'a, str>> {
    // Numeric Hexadecimal
    if let Some(stripped) = name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
        if let Ok(code) = u32::from_str_radix(stripped, 16) {
            return char::from_u32(code).map(|c| Cow::Owned(c.to_string()));
        }
    }

    // Numeric Decimal
    if let Some(stripped) = name.strip_prefix('#') {
        if let Ok(code) = stripped.parse::<u32>() {
            return char::from_u32(code).map(|c| Cow::Owned(c.to_string()));
        }
    }

    // Named entity lookup
    map.get(name).map(|&s| Cow::Borrowed(s))
}

// ============================================================================
// Binary Resource Classification
// ============================================================================

/// Identifies whether a given MIME type or file extension is a binary asset (images, fonts, media).
/// Uses the default classification rules.
pub fn is_binary_resource(mime_type: &str, file_path: &str) -> bool {
    is_binary_resource_with_config(mime_type, file_path, &BinaryClassifierConfig::default())
}

/// Classify using a custom configuration.
pub fn is_binary_resource_with_config(
    mime_type: &str,
    file_path: &str,
    config: &BinaryClassifierConfig,
) -> bool {
    let lower_mime = mime_type.to_lowercase();
    let lower_path = file_path.to_lowercase();

    // Check exact MIME matches
    if config.mime_exact.contains(&lower_mime) {
        return true;
    }

    // Check MIME prefixes
    if config.mime_prefixes.iter().any(|prefix| lower_mime.starts_with(prefix)) {
        return true;
    }

    // Check file extensions
    if let Some(ext) = lower_path.rsplit('.').next() {
        if config.extensions.contains(&ext.to_string()) {
            return true;
        }
    }

    false
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_utf8_with_bom_decoding() {
        let mut bytes = vec![0xEF, 0xBB, 0xBF];
        bytes.extend_from_slice("Hello Unicode World".as_bytes());
        let decoded = decode_text_bytes(&bytes);
        assert_eq!(decoded, "Hello Unicode World");
    }

    #[test]
    fn test_entity_decoding() {
        let raw = "Chapter 1 &mdash; The Beginning &ldquo;Quotes&rdquo; &amp; &#8212; &#x2014; &#160; &#x2019;";
        let decoded = decode_xml_and_html_entities(raw);
        assert_eq!(
            decoded,
            "Chapter 1 — The Beginning “Quotes” & — — \u{00A0} ’"
        );
    }

    #[test]
    fn test_binary_classification() {
        assert!(is_binary_resource("image/jpeg", "cover.jpg"));
        assert!(is_binary_resource("font/woff2", "font.woff2"));
        assert!(!is_binary_resource("application/xhtml+xml", "chapter.xhtml"));
        assert!(!is_binary_resource("application/x-dtbncx+xml", "toc.ncx"));
    }

    #[test]
    fn test_custom_binary_rules() {
        let mut config = BinaryClassifierConfig::default();
        config.extensions.push("custom".to_string());
        assert!(is_binary_resource_with_config("text/plain", "file.custom", &config));
    }
}