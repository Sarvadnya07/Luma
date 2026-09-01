use regex::Regex;
use std::borrow::Cow;

/// Safely decode byte slices into a valid UTF-8 String, handling BOM, XML declarations, and standard legacy fallbacks
pub fn decode_text_bytes(bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }

    // 1. Check for UTF-8 BOM (\xEF\xBB\xBF)
    if bytes.len() >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF {
        return String::from_utf8_lossy(&bytes[3..]).into_owned();
    }

    // 2. Check for UTF-16 LE BOM (\xFF\xFE)
    if bytes.len() >= 2 && bytes[0] == 0xFF && bytes[1] == 0xFE {
        let u16_slice: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
            .collect();
        return String::from_utf16_lossy(&u16_slice);
    }

    // 3. Check for UTF-16 BE BOM (\xFE\xFF)
    if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
        let u16_slice: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|chunk| u16::from_be_bytes([chunk[0], chunk[1]]))
            .collect();
        return String::from_utf16_lossy(&u16_slice);
    }

    // 4. Try standard UTF-8 parsing first
    if let Ok(utf8_str) = std::str::from_utf8(bytes) {
        return utf8_str.to_string();
    }

    // 5. Inspect XML / HTML encoding declaration in ASCII header preview
    let header_preview = String::from_utf8_lossy(&bytes[..bytes.len().min(1024)]).to_lowercase();
    if header_preview.contains("encoding=\"iso-8859-1\"")
        || header_preview.contains("encoding='iso-8859-1'")
        || header_preview.contains("charset=iso-8859-1")
        || header_preview.contains("encoding=\"windows-1252\"")
        || header_preview.contains("encoding='windows-1252'")
        || header_preview.contains("charset=windows-1252")
    {
        // ISO-8859-1 / Windows-1252: map each byte 1:1 to Unicode char
        return bytes.iter().map(|&b| b as char).collect();
    }

    // 6. Lossy UTF-8 fallback
    String::from_utf8_lossy(bytes).into_owned()
}

/// Comprehensive XML & HTML entity decoder supporting standard XML, named HTML5, and numeric entities
pub fn decode_xml_and_html_entities(input: &str) -> String {
    if !input.contains('&') {
        return input.to_string();
    }

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
                if let Some(decoded_char) = resolve_entity(&entity_name) {
                    result.push_str(&decoded_char);
                } else {
                    result.push('&');
                    result.push_str(&entity_name);
                    result.push(';');
                }
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

fn resolve_entity(name: &str) -> Option<Cow<'static, str>> {
    // 1. Numeric Hexadecimal (e.g. #x2014, #x2019)
    if let Some(stripped) = name.strip_prefix("#x").or_else(|| name.strip_prefix("#X")) {
        if let Ok(code) = u32::from_str_radix(stripped, 16) {
            if let Some(c) = char::from_u32(code) {
                return Some(Cow::Owned(c.to_string()));
            }
        }
    }

    // 2. Numeric Decimal (e.g. #8212, #8217, #160)
    if let Some(stripped) = name.strip_prefix('#') {
        if let Ok(code) = stripped.parse::<u32>() {
            if let Some(c) = char::from_u32(code) {
                return Some(Cow::Owned(c.to_string()));
            }
        }
    }

    // 3. Common XML and HTML5 named entities
    match name {
        "amp" => Some(Cow::Borrowed("&")),
        "lt" => Some(Cow::Borrowed("<")),
        "gt" => Some(Cow::Borrowed(">")),
        "quot" => Some(Cow::Borrowed("\"")),
        "apos" => Some(Cow::Borrowed("'")),
        "nbsp" => Some(Cow::Borrowed("\u{00A0}")),
        "mdash" => Some(Cow::Borrowed("—")),
        "ndash" => Some(Cow::Borrowed("–")),
        "lsquo" => Some(Cow::Borrowed("‘")),
        "rsquo" => Some(Cow::Borrowed("’")),
        "ldquo" => Some(Cow::Borrowed("“")),
        "rdquo" => Some(Cow::Borrowed("”")),
        "hellip" => Some(Cow::Borrowed("…")),
        "bull" => Some(Cow::Borrowed("•")),
        "copy" => Some(Cow::Borrowed("©")),
        "reg" => Some(Cow::Borrowed("®")),
        "trade" => Some(Cow::Borrowed("™")),
        "deg" => Some(Cow::Borrowed("°")),
        "plusmn" => Some(Cow::Borrowed("±")),
        "times" => Some(Cow::Borrowed("×")),
        "divide" => Some(Cow::Borrowed("÷")),
        "laquo" => Some(Cow::Borrowed("«")),
        "raquo" => Some(Cow::Borrowed("»")),
        "cent" => Some(Cow::Borrowed("¢")),
        "pound" => Some(Cow::Borrowed("£")),
        "yen" => Some(Cow::Borrowed("¥")),
        "euro" => Some(Cow::Borrowed("€")),
        "sect" => Some(Cow::Borrowed("§")),
        "para" => Some(Cow::Borrowed("¶")),
        "eacute" => Some(Cow::Borrowed("é")),
        "Eacute" => Some(Cow::Borrowed("É")),
        "egrave" => Some(Cow::Borrowed("è")),
        "agrave" => Some(Cow::Borrowed("à")),
        "ccedil" => Some(Cow::Borrowed("ç")),
        "uuml" => Some(Cow::Borrowed("ü")),
        "ouml" => Some(Cow::Borrowed("ö")),
        "auml" => Some(Cow::Borrowed("ä")),
        _ => None,
    }
}

/// Identifies whether a given MIME type or file extension is a binary asset (images, fonts, media)
pub fn is_binary_resource(mime_type: &str, file_path: &str) -> bool {
    let lower_mime = mime_type.to_lowercase();
    let lower_path = file_path.to_lowercase();

    if lower_mime.starts_with("image/")
        || lower_mime.starts_with("font/")
        || lower_mime.starts_with("audio/")
        || lower_mime.starts_with("video/")
        || lower_mime == "application/font-woff"
        || lower_mime == "application/font-woff2"
        || lower_mime == "application/x-font-ttf"
        || lower_mime == "application/x-font-otf"
        || lower_mime == "application/vnd.ms-opentype"
        || lower_mime == "application/octet-stream"
    {
        return true;
    }

    lower_path.ends_with(".png")
        || lower_path.ends_with(".jpg")
        || lower_path.ends_with(".jpeg")
        || lower_path.ends_with(".gif")
        || lower_path.ends_with(".webp")
        || lower_path.ends_with(".svg")
        || lower_path.ends_with(".woff")
        || lower_path.ends_with(".woff2")
        || lower_path.ends_with(".ttf")
        || lower_path.ends_with(".otf")
        || lower_path.ends_with(".mp3")
        || lower_path.ends_with(".mp4")
}

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
        assert_eq!(decoded, "Chapter 1 — The Beginning “Quotes” & — — \u{00A0} ’");
    }

    #[test]
    fn test_binary_classification() {
        assert!(is_binary_resource("image/jpeg", "cover.jpg"));
        assert!(is_binary_resource("font/woff2", "font.woff2"));
        assert!(!is_binary_resource("application/xhtml+xml", "chapter.xhtml"));
        assert!(!is_binary_resource("application/x-dtbncx+xml", "toc.ncx"));
    }
}
