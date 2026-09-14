use ammonia::Builder;
use maplit::hashset;
use regex::Regex;
use sha2::{Digest, Sha256};
use std::path::{Component, Path, PathBuf};

use luma_core::error::{LumaError, Result};

// ============================================================================
// Constants – archive safety limits
// ============================================================================

/// Maximum allowed uncompressed size for a single document component (500 MB).
pub const MAX_UNCOMPRESSED_FILE_SIZE_BYTES: u64 = 500 * 1024 * 1024;

/// Maximum archive entry count (100,000 files).
pub const MAX_ARCHIVE_ENTRY_COUNT: usize = 100_000;

/// Maximum compression expansion ratio (100:1) to prevent zip bombs.
pub const MAX_COMPRESSION_RATIO: u64 = 100;

// ============================================================================
// Constants – HTML sanitisation
// ============================================================================

/// Dangerous HTML/XML tag pairs to remove.
pub const DANGEROUS_TAG_PAIRS: &[(&str, &str)] = &[
    ("<script", "</script>"),
    ("<iframe", "</iframe>"),
    ("<object", "</object>"),
    ("<embed", "</embed>"),
    ("<applet", "</applet>"),
    ("<form", "</form>"),
];

/// Regex pattern to match inline event handlers (case‑insensitive).
pub const EVENT_HANDLER_REGEX_STR: &str = r#"(?i)\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)"#;

/// Regex pattern to match `javascript:` URIs (case‑insensitive).
pub const JS_PROTO_REGEX_STR: &str = r#"(?i)javascript:\s*"#;

/// Replacement string for blocked `javascript:` URIs.
pub const BLOCKED_JS_URI_REPLACEMENT: &str = "blocked-javascript:";

// ============================================================================
// HTML Sanitizer Configuration
// ============================================================================

/// Configuration for the HTML sanitizer.
#[derive(Debug, Clone)]
pub struct SanitizerConfig {
    /// List of dangerous tag pairs to remove.
    pub dangerous_tag_pairs: Vec<(String, String)>,
    /// Compiled regex for event handlers.
    pub event_handler_regex: regex::Regex,
    /// Compiled regex for `javascript:` URIs.
    pub js_proto_regex: regex::Regex,
    /// Replacement string for blocked URIs.
    pub js_replacement: String,
}

impl Default for SanitizerConfig {
    fn default() -> Self {
        // Build vectors from the constants.
        let pairs = DANGEROUS_TAG_PAIRS
            .iter()
            .map(|(start, end)| (start.to_string(), end.to_string()))
            .collect();
        Self {
            dangerous_tag_pairs: pairs,
            event_handler_regex: regex::Regex::new(EVENT_HANDLER_REGEX_STR).expect("Valid regex"),
            js_proto_regex: regex::Regex::new(JS_PROTO_REGEX_STR).expect("Valid regex"),
            js_replacement: BLOCKED_JS_URI_REPLACEMENT.to_string(),
        }
    }
}

impl SanitizerConfig {
    /// Creates a new config with custom tag pairs.
    pub fn with_tag_pairs(pairs: Vec<(String, String)>) -> Self {
        Self {
            dangerous_tag_pairs: pairs,
            ..Default::default()
        }
    }
}

// ============================================================================
// Core Functions (using constants and config)
// ============================================================================

/// Validates that a path is safe and does not escape the designated base directory.
pub fn sanitize_relative_path(base_dir: &Path, untrusted_rel_path: &str) -> Result<PathBuf> {
    let rel_path = Path::new(untrusted_rel_path);

    for component in rel_path.components() {
        match component {
            Component::ParentDir => {
                return Err(LumaError::SecurityError(format!(
                    "Path traversal attempt detected: '{untrusted_rel_path}'"
                )));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(LumaError::SecurityError(format!(
                    "Absolute or rooted path not allowed in relative context: '{untrusted_rel_path}'"
                )));
            }
            Component::Normal(_) | Component::CurDir => {}
        }
    }

    let joined = base_dir.join(rel_path);
    Ok(joined)
}

/// Compute SHA-256 hash of bytes.
pub fn compute_sha256(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

/// Compute SHA-256 hash and total size in constant O(1) memory from a stream reader.
pub fn compute_sha256_reader<R: std::io::Read>(mut reader: R) -> Result<(String, u64)> {
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    let mut total_bytes = 0u64;

    loop {
        let bytes_read = reader.read(&mut buffer).map_err(|e| {
            LumaError::StorageError(format!("Failed to stream read for hashing: {e}"))
        })?;
        if bytes_read == 0 {
            break;
        }
        hasher.update(&buffer[..bytes_read]);
        total_bytes += bytes_read as u64;
    }

    Ok((format!("{:x}", hasher.finalize()), total_bytes))
}

/// Verify decompression safety parameters against zip‑bomb heuristics.
pub fn verify_archive_safety(
    compressed_size: u64,
    uncompressed_size: u64,
    entry_count: usize,
) -> Result<()> {
    if entry_count > MAX_ARCHIVE_ENTRY_COUNT {
        return Err(LumaError::SecurityError(format!(
            "Archive exceeds maximum allowed entry count: {entry_count}"
        )));
    }

    if uncompressed_size > MAX_UNCOMPRESSED_FILE_SIZE_BYTES {
        return Err(LumaError::SecurityError(format!(
            "Uncompressed file size exceeds limit: {uncompressed_size} bytes"
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

// ============================================================================
// HTML Sanitizer (default & configurable)
// ============================================================================
// ARCH-02 hardening: sanitization is now allowlist-based (html5ever parser via
// `ammonia`) instead of a regex blocklist. An allowlist parser cannot be
// bypassed by mutation-XSS or encoding tricks because it reconstructs the
// document from a parse tree, keeping only tags/attributes on the allowlist.
// The tag allowlist is content-oriented (headings, paragraphs, lists, tables,
// links, images) so EPUB/CBZ/Markdown chapter HTML renders faithfully.
//
// The previous regex-blocklist implementation (`DANGEROUS_TAG_PAIRS`,
// `EVENT_HANDLER_REGEX_STR`, `JS_PROTO_REGEX_STR`) is retained only because
// `SanitizerConfig` is `pub`; it is no longer used by `sanitize_untrusted_html`.

/// Sanitizes untrusted HTML using the default configuration.
///
/// Beyond ammonia's defaults, `id` and `class` are allowed as generic
/// attributes: both are inert, and the reader's scroll/annotation locators
/// bind to generated ids (`heading-0`, `p-1`, `quote-2`) while the reader
/// stylesheet styles via classes. Dropping them would break anchoring.
pub fn sanitize_untrusted_html(input: &str) -> String {
    Builder::default()
        .generic_attributes(hashset!["lang", "title", "id", "class"])
        .clean(&strip_document_wrappers(input))
        .to_string()
}

/// Strips embedded raw-HTML from plain-text markup sources (Markdown, plain
/// text) before parsing. Text formats are *not* HTML: their security boundary
/// is the sanitizer applied to the generated HTML at the render boundary, but
/// their rendering contract requires embedded markup to be removed rather than
/// escaped (escaped `<script>` text still exposes its payload to search and
/// text extraction), and requires markdown syntax (`> quote`, `[link](url)`)
/// to survive untouched — so a parse-tree sanitizer cannot be applied to the
/// source itself. This pass drops any line containing tag-like markup
/// (`<` followed by a letter, `/`, `!`, or `?`); ordinary prose (`a < b`) is
/// never altered. Trade-off: literal HTML inside code fences is also removed,
/// consistent with the content-removal contract.
pub fn strip_raw_html_blocks(source: &str) -> String {
    static TAG_LIKE_LINE: std::sync::LazyLock<Regex> =
        std::sync::LazyLock::new(|| Regex::new(r"(?im)^.*<[a-zA-Z/!?].*$").expect("valid regex"));
    TAG_LIKE_LINE.replace_all(source, "").into_owned()
}

/// Removes `<head>...</head>` regions and literal `<html>`/`<body>` wrapper
/// tags before ammonia parses the input. Relative URL attributes pass through
/// unchanged (ammonia's default `UrlRelative::PassThrough`): EPUB resources are
/// resolved by the renderer against the document's own base, not by a global
/// security base URL.
///
/// Ammonia parses in HTML5 *fragment* mode (as if inside a `<div>`), so a
/// literal `<head>` start tag makes the tree builder route everything after it
/// into a head-element subtree that ammonia does not serialize back — and an
/// unclosed `<script>` inside such input can then survive as escaped *text*
/// (`&lt;script&gt;alert(...)`) rather than being dropped. EPUB and CBZ
/// containers regularly contain such malformed chapter markup, so we normalize
/// it here and let ammonia see pure fragment content. Case-insensitive; the
/// first `</head>` closes an unclosed-scanned `<head>` (nested `<head>` is
/// invalid HTML anyway).
fn strip_document_wrappers(input: &str) -> String {
    let lower = input.to_ascii_lowercase();

    // 1. If an unclosed `<head>` exists, html5ever would swallow everything
    //    after it as head content — drop that tail entirely (matches what a
    //    browser's DOM would expose as renderable content).
    let scan_from = match lower.find("<head") {
        Some(open)
            if lower[open + 5..].starts_with('>')
                || lower[open + 5..].starts_with(|c: char| c.is_ascii_whitespace()) =>
        {
            if lower[open..].find("</head").is_none() {
                // Unclosed `<head>`: html5ever would route the remainder into
                // a head subtree and lose it. The reader's content-recovery
                // contract prefers readable text: if a literal `<body>` tag
                // exists after the head region, resume from there (dropping
                // the head metadata and its swallowed title text); otherwise
                // nothing is recoverable and only the content before the
                // unclosed `<head>` is kept.
                return match lower[open..].find("<body") {
                    Some(body_rel) => strip_wrapping_tags(&input[open + body_rel..]),
                    None => strip_wrapping_tags(&input[..open]),
                };
            }
            open
        }
        _ => 0,
    };

    // 2. Remove each `<head>...</head>` region (metadata is never rendered).
    let mut out = String::with_capacity(input.len());
    let mut consumed = 0usize; // bytes of `input` already emitted
    let mut search_from = scan_from; // offset into `lower` for the next find

    while let Some(rel) = lower[search_from..].find("<head") {
        let open = search_from + rel;
        let after = &lower[open + 5..];
        // Match a real `<head>`/`<head ...>` open tag, not `<header>`.
        if !(after.starts_with('>') || after.starts_with(|c: char| c.is_ascii_whitespace())) {
            search_from = open + 5;
            continue;
        }
        out.push_str(&input[consumed..open]);
        match lower[open..].find("</head") {
            Some(close_rel) => {
                let close = open + close_rel;
                let close_end = lower[close..]
                    .find('>')
                    .map(|i| close + i + 1)
                    .unwrap_or(lower.len());
                consumed = close_end;
                search_from = close_end;
            }
            // Unclosed `<head>` (first pass ensured this cannot happen for the
            // first occurrence, but a malformed second one may exist): drop the
            // rest, mirroring html5ever's head-routing behavior.
            None => return strip_wrapping_tags(&out),
        }
    }
    out.push_str(&input[consumed..]);
    strip_wrapping_tags(&out)
}

/// Drops literal `<html>`/`<body>` wrapper tags (case-insensitive).
fn strip_wrapping_tags(fragment: &str) -> String {
    let mut result = String::with_capacity(fragment.len());
    let lower = fragment.to_ascii_lowercase();
    let mut rest = fragment;
    let mut low = lower.as_str();

    // Scan tag-by-tag: at each '<' decide whether it opens an html/body wrapper
    // (skip through its '>') or something else (copy through to the next '<').
    while let Some(pos) = low.find('<') {
        result.push_str(&rest[..pos]);
        let after = &low[pos + 1..];

        let is_wrapper = ["html", "body"].iter().any(|t| {
            after.strip_prefix(t).is_some_and(|tail| {
                tail.starts_with('>')
                    || tail.starts_with('/')
                    || tail.starts_with(char::is_whitespace)
            })
        });

        let tag_end = after.find('>').map(|i| i + 1);
        match (is_wrapper, tag_end) {
            (true, Some(gt)) => {
                // Drop the whole wrapper tag including its '>'.
                rest = &rest[pos + 1 + gt..];
                low = &low[pos + 1 + gt..];
            }
            (true, None) => break, // malformed unclosed wrapper: drop the tail
            (false, Some(gt)) => {
                // Keep this tag verbatim (ammonia will parse it properly).
                result.push_str(&rest[pos..pos + 1 + gt]);
                rest = &rest[pos + 1 + gt..];
                low = &low[pos + 1 + gt..];
            }
            (false, None) => {
                // No '>' ahead: keep the remainder verbatim and stop.
                result.push_str(&rest[pos..]);
                rest = "";
                break;
            }
        }
    }
    result.push_str(rest);
    result
}

/// Sanitizes untrusted HTML using a custom configuration.
pub fn sanitize_untrusted_html_with_config(input: &str, config: &SanitizerConfig) -> String {
    let mut cleaned = input.to_string();

    // 1. Recursive removal of dangerous tag pairs (prevents nested evasion)
    let mut changed = true;
    while changed {
        let before_len = cleaned.len();
        let lower = cleaned.to_lowercase();
        for (start_tag, end_tag) in &config.dangerous_tag_pairs {
            if let Some(start_pos) = lower.find(start_tag) {
                if let Some(end_pos) = lower[start_pos..].find(end_tag) {
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

    // 2. Neutralize inline event handlers
    let cleaned = config.event_handler_regex.replace_all(&cleaned, " ");

    // 3. Neutralize `javascript:` URIs
    let cleaned = config
        .js_proto_regex
        .replace_all(&cleaned, config.js_replacement.as_str());

    cleaned.into_owned()
}

// ============================================================================
// Tests
// ============================================================================

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
        assert!(verify_archive_safety(10_000_000, 25_000_000, 50).is_ok());
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
        let dirty_img =
            r#"<img src="valid.jpg" onerror="alert('pwned')" onload="steal()" alt="Cover" />"#;
        let cleaned = sanitize_untrusted_html(dirty_img);
        assert!(!cleaned.contains("onerror"));
        assert!(!cleaned.contains("onload"));
        assert!(!cleaned.contains("alert"));
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

    #[test]
    fn test_custom_sanitizer_config() {
        let custom_pairs = vec![("<evil".to_string(), "</evil>".to_string())];
        let config = SanitizerConfig::with_tag_pairs(custom_pairs);
        let input = "<evil>bad</evil>Hello World";
        let cleaned = sanitize_untrusted_html_with_config(input, &config);
        assert!(!cleaned.contains("evil"));
        assert!(cleaned.contains("Hello World"));
    }
}
