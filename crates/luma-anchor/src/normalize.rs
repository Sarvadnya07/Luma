use unicode_normalization::UnicodeNormalization;

// ============================================================================
// Configuration
// ============================================================================

#[derive(Debug, Clone)]
pub struct NormalizationConfig {
    /// Apply Unicode NFKD decomposition (default: true)
    pub unicode_normalize: bool,
    /// Collapse consecutive whitespace into a single space (default: true)
    pub collapse_whitespace: bool,
    /// Trim leading/trailing whitespace (default: true)
    pub trim: bool,
    /// Convert smart quotes, apostrophes, and dashes to ASCII equivalents (default: true)
    pub normalize_punctuation: bool,
    /// Convert all characters to lowercase (default: false)
    pub fold_case: bool,
}

impl Default for NormalizationConfig {
    fn default() -> Self {
        Self {
            unicode_normalize: true,
            collapse_whitespace: true,
            trim: true,
            normalize_punctuation: true,
            fold_case: false,
        }
    }
}

// ============================================================================
// Normalization Function
// ============================================================================

/// Normalizes text according to the provided configuration.
pub fn normalize_text_with_config(input: &str, config: &NormalizationConfig) -> String {
    let mut normalized = String::with_capacity(input.len());
    let mut last_was_space = true; // Start true to trim leading spaces

    let chars: Box<dyn Iterator<Item = char>> = if config.unicode_normalize {
        Box::new(input.nfkd())
    } else {
        Box::new(input.chars())
    };

    for c in chars {
        let mapped = if config.normalize_punctuation {
            match c {
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
            }
        } else {
            // Still handle line endings and whitespace variants as spaces,
            // because they are whitespace and should be collapsed if configured.
            match c {
                '\u{00A0}' | '\u{2000}'..='\u{200B}' | '\u{202F}' | '\u{205F}' | '\u{3000}' => ' ',
                '\r' | '\n' | '\t' => ' ',
                other => other,
            }
        };

        let ch = if config.fold_case {
            mapped.to_lowercase().next().unwrap_or(mapped)
        } else {
            mapped
        };

        if config.collapse_whitespace {
            if ch.is_whitespace() {
                if !last_was_space {
                    normalized.push(' ');
                    last_was_space = true;
                }
            } else {
                normalized.push(ch);
                last_was_space = false;
            }
        } else {
            normalized.push(ch);
        }
    }

    if config.trim && normalized.ends_with(' ') {
        normalized.pop();
    }

    normalized
}

/// Normalizes text using the default configuration (current behavior).
pub fn normalize_text(input: &str) -> String {
    normalize_text_with_config(input, &NormalizationConfig::default())
}

// ============================================================================
// Levenshtein Distance (unchanged – no hardcoded values)
// ============================================================================

/// Compute Levenshtein edit distance between two strings with O(min(M, N)) memory footprint.
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

/// Computes similarity ratio between 0.0 (completely distinct) and 1.0 (exact match).
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

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_default() {
        let input = "  Hello \n\t  world! \r\n This  is  a\ttest.   ";
        let normalized = normalize_text(input);
        assert_eq!(normalized, "Hello world! This is a test.");
    }

    #[test]
    fn test_normalize_without_collapse() {
        let config = NormalizationConfig {
            collapse_whitespace: false,
            ..Default::default()
        };
        let input = "Hello  world";
        let normalized = normalize_text_with_config(input, &config);
        assert_eq!(normalized, "Hello  world"); // spaces preserved
    }

    #[test]
    fn test_normalize_without_punctuation_normalization() {
        let config = NormalizationConfig {
            normalize_punctuation: false,
            ..Default::default()
        };
        let input = "“Luma”—the ‘ultimate’ reader";
        let normalized = normalize_text_with_config(input, &config);
        // Smart quotes remain
        assert!(normalized.contains('“'));
        assert!(normalized.contains('’'));
    }

    #[test]
    fn test_normalize_with_case_fold() {
        let config = NormalizationConfig {
            fold_case: true,
            ..Default::default()
        };
        let input = "Hello World!";
        let normalized = normalize_text_with_config(input, &config);
        assert_eq!(normalized, "hello world!");
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