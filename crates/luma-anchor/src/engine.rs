use crate::normalize::{normalize_text, similarity_ratio};
use crate::types::{CompositeAnchor, MatchCandidate, ResolutionResult, TextQuoteAnchor};

// ============================================================================
// Constants – default thresholds (can be overridden via config)
// ============================================================================

pub const DEFAULT_HIGH_CONFIDENCE_THRESHOLD: f32 = 0.85;
pub const DEFAULT_MIN_ACCEPTABLE_THRESHOLD: f32 = 0.60;
pub const DEFAULT_AMBIGUITY_DELTA_THRESHOLD: f32 = 0.08;
pub const DEFAULT_PREFIX_SUFFIX_MATCH_THRESHOLD: f32 = 0.70;
pub const DEFAULT_FUZZY_SIMILARITY_THRESHOLD: f32 = 0.75;
pub const DEFAULT_WEIGHT_TEXT_SIMILARITY: f32 = 0.60;
pub const DEFAULT_WEIGHT_PREFIX: f32 = 0.20;
pub const DEFAULT_WEIGHT_SUFFIX: f32 = 0.20;
pub const DEFAULT_WEIGHT_TEXT_ONLY: f32 = 0.75;
pub const DEFAULT_WEIGHT_CONTEXT: f32 = 0.25;
pub const DEFAULT_FUZZY_WINDOW_STEP_DIVISOR: usize = 4;
pub const DEFAULT_FUZZY_WINDOW_STEP_MIN: usize = 1;
pub const DEFAULT_FUZZY_MIN_WINDOW_SIZE: usize = 1;
pub const DEFAULT_CONTEXT_SEARCH_RADIUS: usize = 30;
pub const DEFAULT_FUZZY_SLIDING_STEP_DIVISOR: usize = 2;

// ============================================================================
// Error Messages (centralised)
// ============================================================================

const ERR_EMPTY_TARGET: &str = "Empty quote target";
const ERR_NO_CANDIDATE: &str = "No matching candidate found in document";
const ERR_LOW_CONFIDENCE: &str = "Confidence score below acceptable threshold";

// ============================================================================
// Configuration
// ============================================================================

#[derive(Debug, Clone)]
pub struct AnchorEngineConfig {
    /// Minimum confidence for a high‑confidence match.
    pub high_confidence_threshold: f32,
    /// Minimum acceptable confidence for any match.
    pub min_acceptable_threshold: f32,
    /// Delta threshold to detect ambiguity between top candidates.
    pub ambiguity_delta_threshold: f32,
    /// Minimum similarity for prefix/suffix to be considered matched.
    pub prefix_suffix_match_threshold: f32,
    /// Similarity threshold for fuzzy search candidates.
    pub fuzzy_similarity_threshold: f32,
    /// Weight for text similarity when both prefix and suffix are provided.
    pub weight_text_similarity_both: f32,
    /// Weight for prefix context when both are provided.
    pub weight_prefix_both: f32,
    /// Weight for suffix context when both are provided.
    pub weight_suffix_both: f32,
    /// Weight for text similarity when only one context is provided.
    pub weight_text_only: f32,
    /// Weight for context (prefix or suffix) when only one is provided.
    pub weight_context_only: f32,
    /// Radius (in characters) around the match for prefix/suffix search.
    pub context_search_radius: usize,
    /// Step divisor for sliding window search (larger = coarser).
    pub fuzzy_window_step_divisor: usize,
    /// Minimum step size for fuzzy sliding window.
    pub fuzzy_window_step_min: usize,
    /// Minimum window size for fuzzy search.
    pub fuzzy_min_window_size: usize,
    /// Divisor for sliding step in fuzzy search (larger = coarser).
    pub fuzzy_sliding_step_divisor: usize,
}

impl Default for AnchorEngineConfig {
    fn default() -> Self {
        Self {
            high_confidence_threshold: DEFAULT_HIGH_CONFIDENCE_THRESHOLD,
            min_acceptable_threshold: DEFAULT_MIN_ACCEPTABLE_THRESHOLD,
            ambiguity_delta_threshold: DEFAULT_AMBIGUITY_DELTA_THRESHOLD,
            prefix_suffix_match_threshold: DEFAULT_PREFIX_SUFFIX_MATCH_THRESHOLD,
            fuzzy_similarity_threshold: DEFAULT_FUZZY_SIMILARITY_THRESHOLD,
            weight_text_similarity_both: DEFAULT_WEIGHT_TEXT_SIMILARITY,
            weight_prefix_both: DEFAULT_WEIGHT_PREFIX,
            weight_suffix_both: DEFAULT_WEIGHT_SUFFIX,
            weight_text_only: DEFAULT_WEIGHT_TEXT_ONLY,
            weight_context_only: DEFAULT_WEIGHT_CONTEXT,
            context_search_radius: DEFAULT_CONTEXT_SEARCH_RADIUS,
            fuzzy_window_step_divisor: DEFAULT_FUZZY_WINDOW_STEP_DIVISOR,
            fuzzy_window_step_min: DEFAULT_FUZZY_WINDOW_STEP_MIN,
            fuzzy_min_window_size: DEFAULT_FUZZY_MIN_WINDOW_SIZE,
            fuzzy_sliding_step_divisor: DEFAULT_FUZZY_SLIDING_STEP_DIVISOR,
        }
    }
}

// ============================================================================
// Anchor Engine
// ============================================================================

pub struct AnchorEngine {
    config: AnchorEngineConfig,
}

impl AnchorEngine {
    pub fn new(config: AnchorEngineConfig) -> Self {
        Self { config }
    }

    pub fn with_defaults() -> Self {
        Self::default()
    }


    /// Resolve an anchor against target text content using the configured thresholds.
    pub fn resolve(&self, anchor: &CompositeAnchor, document_text: &str) -> ResolutionResult {
        self.resolve_quote(&anchor.quote_anchor, document_text)
    }

    /// Resolve a TextQuoteAnchor against target text.
    pub fn resolve_quote(&self, quote_anchor: &TextQuoteAnchor, document_text: &str) -> ResolutionResult {
        let normalized_doc = normalize_text(document_text);
        let normalized_target = normalize_text(&quote_anchor.exact);

        if normalized_target.is_empty() {
            return ResolutionResult::Failed {
                best_candidate: None,
                reason: ERR_EMPTY_TARGET.to_string(),
            };
        }

        // 1. Search for all exact normalized matches
        let mut candidates = Vec::new();
        let mut search_start = 0;

        while let Some(found_idx) = normalized_doc[search_start..].find(&normalized_target) {
            let abs_start = search_start + found_idx;
            let abs_end = abs_start + normalized_target.len();

            let candidate = self.evaluate_candidate(
                &normalized_doc,
                abs_start,
                abs_end,
                quote_anchor.prefix.as_deref(),
                quote_anchor.suffix.as_deref(),
                true,
                1.0,
            );
            candidates.push(candidate);
            search_start = abs_start + 1;
        }

        // 2. If no exact matches, run fuzzy sliding‑window search
        if candidates.is_empty() {
            candidates = self.find_fuzzy_candidates(
                &normalized_doc,
                &normalized_target,
                quote_anchor.prefix.as_deref(),
                quote_anchor.suffix.as_deref(),
            );
        }

        if candidates.is_empty() {
            return ResolutionResult::Failed {
                best_candidate: None,
                reason: ERR_NO_CANDIDATE.to_string(),
            };
        }

        // Sort descending by confidence
        candidates.sort_by(|a, b| {
            b.confidence_score
                .partial_cmp(&a.confidence_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let best = candidates[0].clone();

        // Check for ambiguity
        if candidates.len() > 1 {
            let runner_up = &candidates[1];
            if (best.confidence_score - runner_up.confidence_score).abs()
                < self.config.ambiguity_delta_threshold
                && best.confidence_score >= self.config.min_acceptable_threshold
            {
                return ResolutionResult::Ambiguous {
                    candidates: candidates.into_iter().take(3).collect(),
                    highest_score: best.confidence_score,
                };
            }
        }

        if best.confidence_score >= self.config.high_confidence_threshold {
            ResolutionResult::HighConfidence(best)
        } else if best.confidence_score >= self.config.min_acceptable_threshold {
            ResolutionResult::Ambiguous {
                candidates: vec![best.clone()],
                highest_score: best.confidence_score,
            }
        } else {
            ResolutionResult::Failed {
                best_candidate: Some(best),
                reason: ERR_LOW_CONFIDENCE.to_string(),
            }
        }
    }

    // ------------------------------------------------------------------------
    // Evaluation Helpers (with config)
    // ------------------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    fn evaluate_candidate(

        &self,
        doc: &str,
        start_char: usize,
        end_char: usize,
        prefix_context: Option<&str>,
        suffix_context: Option<&str>,
        exact_text_matched: bool,
        fuzzy_sim: f32,
    ) -> MatchCandidate {
        let matched_text = doc[start_char..end_char].to_string();
        let (prefix_sim, prefix_matched) = self.evaluate_prefix(prefix_context, doc, start_char);
        let (suffix_sim, suffix_matched) = self.evaluate_suffix(suffix_context, doc, end_char);

        // Compute weighted confidence based on config
        let confidence_score = match (prefix_context.is_some(), suffix_context.is_some()) {
            (true, true) => {
                (fuzzy_sim * self.config.weight_text_similarity_both)
                    + (prefix_sim * self.config.weight_prefix_both)
                    + (suffix_sim * self.config.weight_suffix_both)
            }
            (true, false) => {
                (fuzzy_sim * self.config.weight_text_only)
                    + (prefix_sim * self.config.weight_context_only)
            }
            (false, true) => {
                (fuzzy_sim * self.config.weight_text_only)
                    + (suffix_sim * self.config.weight_context_only)
            }
            (false, false) => fuzzy_sim,
        };

        MatchCandidate {
            start_char,
            end_char,
            matched_text,
            confidence_score,
            exact_text_matched,
            prefix_matched,
            suffix_matched,
            fuzzy_similarity: fuzzy_sim,
        }
    }

    fn evaluate_prefix(&self, prefix_context: Option<&str>, doc: &str, start_char: usize) -> (f32, bool) {
        if let Some(prefix) = prefix_context {
            let norm_prefix = normalize_text(prefix);
            if !norm_prefix.is_empty() {
                let doc_before = doc[..start_char].trim_end();
                if doc_before.ends_with(&norm_prefix) {
                    return (1.0, true);
                }
                let p_len = norm_prefix.chars().count();
                let mut best_sim = 0.0;
                let window_sizes = self.generate_window_sizes(p_len);
                for &w_size in &window_sizes {
                    if w_size <= doc_before.len() {
                        let tail = &doc_before[doc_before.len() - w_size..];
                        let sim = similarity_ratio(&norm_prefix, tail);
                        if sim > best_sim {
                            best_sim = sim;
                        }
                    }
                }
                // Check a larger window for containing the prefix
                let radius = self.config.context_search_radius;
                let search_window_start = doc_before.len().saturating_sub(p_len + radius);
                let search_window = &doc_before[search_window_start..];
                if search_window.contains(&norm_prefix) {
                    best_sim = best_sim.max(0.95);
                }
                let matched = best_sim >= self.config.prefix_suffix_match_threshold;
                return (best_sim, matched);
            }
        }
        (1.0, true)
    }

    fn evaluate_suffix(&self, suffix_context: Option<&str>, doc: &str, end_char: usize) -> (f32, bool) {
        if let Some(suffix) = suffix_context {
            let norm_suffix = normalize_text(suffix);
            if !norm_suffix.is_empty() {
                let doc_after = doc[end_char..].trim_start();
                if doc_after.starts_with(&norm_suffix) {
                    return (1.0, true);
                }
                let s_len = norm_suffix.chars().count();
                let mut best_sim = 0.0;
                let window_sizes = self.generate_window_sizes(s_len);
                for &w_size in &window_sizes {
                    if w_size <= doc_after.len() {
                        let head = &doc_after[..w_size];
                        let sim = similarity_ratio(&norm_suffix, head);
                        if sim > best_sim {
                            best_sim = sim;
                        }
                    }
                }
                let radius = self.config.context_search_radius;
                let search_window_end = (s_len + radius).min(doc_after.len());
                let search_window = &doc_after[..search_window_end];
                if search_window.contains(&norm_suffix) {
                    best_sim = best_sim.max(0.95);
                }
                let matched = best_sim >= self.config.prefix_suffix_match_threshold;
                return (best_sim, matched);
            }
        }
        (1.0, true)
    }

    // ------------------------------------------------------------------------
    // Fuzzy Search
    // ------------------------------------------------------------------------

    fn find_fuzzy_candidates(
        &self,
        doc: &str,
        target: &str,
        prefix_context: Option<&str>,
        suffix_context: Option<&str>,
    ) -> Vec<MatchCandidate> {
        let target_len = target.len();
        if target_len == 0 || doc.is_empty() {
            return Vec::new();
        }

        let mut candidates = Vec::new();
        let step = (target_len / self.config.fuzzy_window_step_divisor)
            .max(self.config.fuzzy_window_step_min);
        let window_sizes = [
            target_len.saturating_sub(step),
            target_len,
            target_len + step,
        ];

        for &w_size in &window_sizes {
            if w_size < self.config.fuzzy_min_window_size || w_size > doc.len() {
                continue;
            }
            let mut start = 0;
            let inner_step = (step / self.config.fuzzy_sliding_step_divisor).max(self.config.fuzzy_window_step_min);
            while start + w_size <= doc.len() {
                let slice = &doc[start..start + w_size];
                let sim = similarity_ratio(target, slice);
                if sim >= self.config.fuzzy_similarity_threshold {
                    let cand = self.evaluate_candidate(
                        doc,
                        start,
                        start + w_size,
                        prefix_context,
                        suffix_context,
                        false,
                        sim,
                    );
                    candidates.push(cand);
                }
                start += inner_step;
            }
        }
        candidates
    }

    /// Helper to generate a small set of window sizes for context matching.
    fn generate_window_sizes(&self, base_len: usize) -> [usize; 3] {
        let step = (base_len / 4).max(1);

        [
            base_len.saturating_sub(step),
            base_len,
            base_len + step,
        ]
    }
}

// ============================================================================
// Default instance (backward‑compatible)
// ============================================================================

impl Default for AnchorEngine {
    fn default() -> Self {
        Self::new(AnchorEngineConfig::default())
    }
}