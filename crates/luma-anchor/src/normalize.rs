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

/// Compute Levenshtein edit distance between two strings
pub fn levenshtein_distance(a: &str, b: &str) -> usize {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    let (m, n) = (a_chars.len(), b_chars.len());

    if m == 0 {
        return n;
    }
    if n == 0 {
        return m;
    }

    let mut dp = vec![vec![0usize; n + 1]; m + 1];

    for i in 0..=m {
        dp[i][0] = i;
    }
    for j in 0..=n {
        dp[0][j] = j;
    }

    for i in 1..=m {
        for j in 1..=n {
            let cost = if a_chars[i - 1] == b_chars[j - 1] { 0 } else { 1 };
            dp[i][j] = (dp[i - 1][j] + 1)
                .min(dp[i][j - 1] + 1)
                .min(dp[i - 1][j - 1] + cost);
        }
    }

    dp[m][n]
}

/// Computes similarity ratio between 0.0 (completely distinct) and 1.0 (exact match)
pub fn similarity_ratio(a: &str, b: &str) -> f32 {
    let max_len = a.chars().count().max(b.chars().count());
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
        assert_eq!(normalized, "\"Luma\"-the 'ultimate' reader-supports EPUB & PDF.");
    }

    #[test]
    fn test_similarity_ratio() {
        assert_eq!(similarity_ratio("hello", "hello"), 1.0);
        assert!(similarity_ratio("hello", "helo") >= 0.80);
        assert!(similarity_ratio("completely", "different") < 0.30);
    }
}
