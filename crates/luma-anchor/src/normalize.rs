use unicode_normalization::UnicodeNormalization;

/// Normalizes text for resilient quote comparison:
/// 1. Converts to Unicode NFKD decomposition
/// 2. Unifies typographical variations (smart quotes, curly apostrophes, dashes, non-breaking spaces)
/// 3. Collapses consecutive whitespace (spaces, tabs, newlines) into single ASCII space
/// 4. Trims leading/trailing whitespace
pub fn normalize_text(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    let mut last_was_space = true; // Start true to trim leading spaces

    for c in input.nfkd() {
        let mapped = match c {
            // Smart quotes & apostrophes -> standard ascii
            '‘' | '’' | '‚' | '‛' | '`' | '´' => '\'',
            '“' | '”' | '„' | '‟' | '«' | '»' => '"',
            // Hyphens and dashes -> standard ascii hyphen
            '—' | '–' | '―' | '‐' | '‑' => '-',
            // Whitespace variants -> standard space
            '\u{00A0}' | '\u{2000}'..='\u{200B}' | '\u{202F}' | '\u{205F}' | '\u{3000}' => ' ',
            // Line endings & control chars -> standard space
            '\r' | '\n' | '\t' => ' ',
            other => other,
        };

        if mapped.is_whitespace() {
            if !last_was_space {
                normalized.push(' ');
                last_was_space = true;
            }
        } else {
            normalized.push(mapped);
            last_was_space = false;
        }
    }

    if normalized.ends_with(' ') {
        normalized.pop();
    }

    normalized
}

/// Compute Levenshtein edit distance between two strings with O(min(M, N)) memory footprint
pub fn levenshtein_distance(a: &str, b: &str) -> usize {
    if a == b {
        return 0;
    }
    if a.is_empty() {
        return b.chars().count();
    }
    if b.is_empty() {
        return a.chars().count();
    }

    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let (m, n) = (a_chars.len(), b_chars.len());

    // Swap to ensure n <= m, minimizing buffer size
    let (a_chars, b_chars, _m, n) = if n > m {
        (b_chars, a_chars, n, m)
    } else {
        (a_chars, b_chars, m, n)
    };

    let mut v0: Vec<usize> = (0..=n).collect();
    let mut v1: Vec<usize> = vec![0; n + 1];

    for (i, &ca) in a_chars.iter().enumerate() {
        v1[0] = i + 1;

        for (j, &cb) in b_chars.iter().enumerate() {
            let cost = if ca == cb { 0 } else { 1 };
            v1[j + 1] = (v1[j] + 1).min(v0[j + 1] + 1).min(v0[j] + cost);
        }

        std::mem::swap(&mut v0, &mut v1);
    }

    v0[n]
}

/// Computes similarity ratio between 0.0 (completely distinct) and 1.0 (exact match)
pub fn similarity_ratio(a: &str, b: &str) -> f32 {
    if a == b {
        return 1.0;
    }
    let len_a = a.chars().count();
    let len_b = b.chars().count();
    let max_len = len_a.max(len_b);
    if max_len == 0 {
        return 1.0;
    }
    let distance = levenshtein_distance(a, b);
    1.0 - (distance as f32 / max_len as f32)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_whitespace_and_newlines() {
        let input = "  Hello \n\t  world! \r\n This  is  a\ttest.   ";
        let normalized = normalize_text(input);
        assert_eq!(normalized, "Hello world! This is a test.");
    }

    #[test]
    fn test_normalize_smart_quotes_and_dashes() {
        let input = "“Luma”—the ‘ultimate’ reader—supports EPUB & PDF.";
        let normalized = normalize_text(input);
        assert_eq!(
            normalized,
            "\"Luma\"-the 'ultimate' reader-supports EPUB & PDF."
        );
    }

    #[test]
    fn test_similarity_ratio() {
        assert_eq!(similarity_ratio("hello", "hello"), 1.0);
        assert!(similarity_ratio("hello", "helo") >= 0.80);
        assert!(similarity_ratio("completely", "different") < 0.30);
    }
}
