use crate::normalize::{normalize_text, similarity_ratio};
use crate::types::{CompositeAnchor, MatchCandidate, ResolutionResult, TextQuoteAnchor};

pub const HIGH_CONFIDENCE_THRESHOLD: f32 = 0.85;
pub const MIN_ACCEPTABLE_THRESHOLD: f32 = 0.60;
pub const AMBIGUITY_DELTA_THRESHOLD: f32 = 0.08;

pub struct AnchorEngine;

impl AnchorEngine {
    /// Resolve an anchor against target text content
    pub fn resolve(anchor: &CompositeAnchor, document_text: &str) -> ResolutionResult {
        Self::resolve_quote(&anchor.quote_anchor, document_text)
    }

    /// Resolve a TextQuoteAnchor against target text
    pub fn resolve_quote(quote_anchor: &TextQuoteAnchor, document_text: &str) -> ResolutionResult {
        let normalized_doc = normalize_text(document_text);
        let normalized_target = normalize_text(&quote_anchor.exact);

        if normalized_target.is_empty() {
            return ResolutionResult::Failed {
                best_candidate: None,
                reason: "Empty quote target".to_string(),
            };
        }

        // 1. Search for all exact normalized matches
        let mut candidates = Vec::new();
        let mut search_start = 0;

        while let Some(found_idx) = normalized_doc[search_start..].find(&normalized_target) {
            let abs_start = search_start + found_idx;
            let abs_end = abs_start + normalized_target.len();

            let candidate = Self::evaluate_candidate(
                &normalized_doc,
                abs_start,
                abs_end,
                &normalized_target,
                quote_anchor.prefix.as_deref(),
                quote_anchor.suffix.as_deref(),
                true,
                1.0,
            );
            candidates.push(candidate);
            search_start = abs_start + 1;
        }

        // 2. If no exact matches found, run fuzzy sliding-window search
        if candidates.is_empty() {
            candidates = Self::find_fuzzy_candidates(
                &normalized_doc,
                &normalized_target,
                quote_anchor.prefix.as_deref(),
                quote_anchor.suffix.as_deref(),
            );
        }

        if candidates.is_empty() {
            return ResolutionResult::Failed {
                best_candidate: None,
                reason: "No matching candidate found in document".to_string(),
            };
        }

        // Sort descending by confidence score
        candidates.sort_by(|a, b| {
            b.confidence_score
                .partial_cmp(&a.confidence_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let best = candidates[0].clone();

        // Check if top candidates are ambiguous
        if candidates.len() > 1 {
            let runner_up = &candidates[1];
            if (best.confidence_score - runner_up.confidence_score).abs()
                < AMBIGUITY_DELTA_THRESHOLD
                && best.confidence_score >= MIN_ACCEPTABLE_THRESHOLD
            {
                return ResolutionResult::Ambiguous {
                    candidates: candidates.into_iter().take(3).collect(),
                    highest_score: best.confidence_score,
                };
            }
        }

        if best.confidence_score >= HIGH_CONFIDENCE_THRESHOLD {
            ResolutionResult::HighConfidence(best)
        } else if best.confidence_score >= MIN_ACCEPTABLE_THRESHOLD {
            ResolutionResult::Ambiguous {
                candidates: vec![best.clone()],
                highest_score: best.confidence_score,
            }
        } else {
            ResolutionResult::Failed {
                best_candidate: Some(best),
                reason: "Confidence score below acceptable threshold".to_string(),
            }
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn evaluate_candidate(
        doc: &str,
        start_char: usize,
        end_char: usize,
        _target_text: &str,
        prefix_context: Option<&str>,
        suffix_context: Option<&str>,
        exact_text_matched: bool,
        fuzzy_sim: f32,
    ) -> MatchCandidate {
        let matched_text = doc[start_char..end_char].to_string();

        let mut prefix_sim = 1.0f32;
        let mut prefix_matched = true;
        if let Some(prefix) = prefix_context {
            let norm_prefix = normalize_text(prefix);
            if !norm_prefix.is_empty() {
                let doc_before = doc[..start_char].trim_end();
                if doc_before.ends_with(&norm_prefix) {
                    prefix_sim = 1.0;
                    prefix_matched = true;
                } else {
                    let p_len = norm_prefix.chars().count();
                    let mut best_sim = 0.0f32;
                    for delta in [-4isize, -2, -1, 0, 1, 2, 4] {
                        let window_len = (p_len as isize + delta).max(1) as usize;
                        if window_len <= doc_before.len() {
                            let tail = &doc_before[doc_before.len() - window_len..];
                            let sim = similarity_ratio(&norm_prefix, tail);
                            if sim > best_sim {
                                best_sim = sim;
                            }
                        }
                    }
                    let search_window_start = doc_before.len().saturating_sub(p_len + 30);
                    let search_window = &doc_before[search_window_start..];
                    if search_window.contains(&norm_prefix) {
                        best_sim = best_sim.max(0.95);
                    }
                    prefix_sim = best_sim;
                    prefix_matched = prefix_sim >= 0.70;
                }
            }
        }

        let mut suffix_sim = 1.0f32;
        let mut suffix_matched = true;
        if let Some(suffix) = suffix_context {
            let norm_suffix = normalize_text(suffix);
            if !norm_suffix.is_empty() {
                let doc_after = doc[end_char..].trim_start();
                if doc_after.starts_with(&norm_suffix) {
                    suffix_sim = 1.0;
                    suffix_matched = true;
                } else {
                    let s_len = norm_suffix.chars().count();
                    let mut best_sim = 0.0f32;
                    for delta in [-4isize, -2, -1, 0, 1, 2, 4] {
                        let window_len = (s_len as isize + delta).max(1) as usize;
                        if window_len <= doc_after.len() {
                            let head = &doc_after[..window_len];
                            let sim = similarity_ratio(&norm_suffix, head);
                            if sim > best_sim {
                                best_sim = sim;
                            }
                        }
                    }
                    let search_window_end = (s_len + 30).min(doc_after.len());
                    let search_window = &doc_after[..search_window_end];
                    if search_window.contains(&norm_suffix) {
                        best_sim = best_sim.max(0.95);
                    }
                    suffix_sim = best_sim;
                    suffix_matched = suffix_sim >= 0.70;
                }
            }
        }

        // Compute weighted confidence
        // Base text similarity: 60%
        // Prefix context: 20%
        // Suffix context: 20%
        let confidence_score = match (prefix_context.is_some(), suffix_context.is_some()) {
            (true, true) => (fuzzy_sim * 0.60) + (prefix_sim * 0.20) + (suffix_sim * 0.20),
            (true, false) => (fuzzy_sim * 0.75) + (prefix_sim * 0.25),
            (false, true) => (fuzzy_sim * 0.75) + (suffix_sim * 0.25),
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

    fn find_fuzzy_candidates(
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
        let step = (target_len / 4).max(1);
        let window_sizes = [
            target_len.saturating_sub(step),
            target_len,
            target_len + step,
        ];

        for &w_size in &window_sizes {
            if w_size == 0 || w_size > doc.len() {
                continue;
            }

            let mut start = 0;
            while start + w_size <= doc.len() {
                let slice = &doc[start..start + w_size];
                let sim = similarity_ratio(target, slice);

                if sim >= 0.75 {
                    let cand = Self::evaluate_candidate(
                        doc,
                        start,
                        start + w_size,
                        target,
                        prefix_context,
                        suffix_context,
                        false,
                        sim,
                    );
                    candidates.push(cand);
                }
                start += (step / 2).max(1);
            }
        }

        candidates
    }
}
