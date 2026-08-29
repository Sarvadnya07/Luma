pub mod engine;
pub mod normalize;
pub mod types;

pub use engine::AnchorEngine;
pub use normalize::{levenshtein_distance, normalize_text, similarity_ratio};
pub use types::*;

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_CHAPTER: &str = r#"
    Chapter 1: The Principle of Architecture
    
    In software engineering, local-first systems prioritize user ownership and data autonomy.
    When network partitions occur, the application continues to operate without interruption.
    
    Annotation integrity is the cornerstone of any serious reading system. If a highlight
    drifts or attaches to the wrong sentence after font changes, reader trust is permanently broken.
    
    When network partitions occur, the application continues to operate without interruption.
    This second occurrence tests context-based disambiguation.
    "#;

    #[test]
    fn test_exact_unique_anchor_resolution() {
        let anchor = TextQuoteAnchor::new(
            "Annotation integrity is the cornerstone of any serious reading system.",
            Some("without interruption.".to_string()),
            Some("If a highlight drifts".to_string()),
        );

        let result = AnchorEngine::resolve_quote(&anchor, SAMPLE_CHAPTER);
        match result {
            ResolutionResult::HighConfidence(cand) => {
                assert!(cand.confidence_score >= 0.85);
                assert!(cand.exact_text_matched);
                assert!(cand.matched_text.contains("Annotation integrity"));
            }
            other => panic!("Expected HighConfidence, got {:?}", other),
        }
    }

    #[test]
    fn test_duplicate_phrase_disambiguation_via_context() {
        let target = "When network partitions occur, the application continues to operate without interruption.";

        // First occurrence has prefix "data autonomy."
        let anchor1 = TextQuoteAnchor::new(
            target,
            Some("prioritize user ownership and data autonomy.".to_string()),
            Some("Annotation integrity is".to_string()),
        );

        // Second occurrence has suffix "This second occurrence"
        let anchor2 = TextQuoteAnchor::new(
            target,
            Some("reader trust is permanently broken.".to_string()),
            Some("This second occurrence tests".to_string()),
        );

        let res1 = AnchorEngine::resolve_quote(&anchor1, SAMPLE_CHAPTER);
        let res2 = AnchorEngine::resolve_quote(&anchor2, SAMPLE_CHAPTER);

        let cand1 = match res1 {
            ResolutionResult::HighConfidence(c) => c,
            other => panic!("Expected HighConfidence for anchor1, got {:?}", other),
        };

        let cand2 = match res2 {
            ResolutionResult::HighConfidence(c) => c,
            other => panic!("Expected HighConfidence for anchor2, got {:?}", other),
        };

        // Assert they matched different positions in the document!
        assert_ne!(cand1.start_char, cand2.start_char);
        assert!(cand1.start_char < cand2.start_char);
    }

    #[test]
    fn test_reflow_and_whitespace_mutation_survival() {
        // Document with heavy reflow, altered line wraps and extra spaces
        let reflowed_doc = "Annotation\n  integrity   is the\ncornerstone   of any serious   reading system.";
        let anchor = TextQuoteAnchor::new(
            "Annotation integrity is the cornerstone of any serious reading system.",
            None,
            None,
        );

        let result = AnchorEngine::resolve_quote(&anchor, reflowed_doc);
        match result {
            ResolutionResult::HighConfidence(cand) => {
                assert!(cand.confidence_score >= 0.85);
            }
            other => panic!("Expected HighConfidence across reflow, got {:?}", other),
        }
    }

    #[test]
    fn test_punctuation_and_quote_variation_survival() {
        let mutated_doc = "“Annotation integrity”—is the ‘cornerstone’ of any reading system.";
        let anchor = TextQuoteAnchor::new(
            "\"Annotation integrity\"-is the 'cornerstone' of any reading system.",
            None,
            None,
        );

        let result = AnchorEngine::resolve_quote(&anchor, mutated_doc);
        match result {
            ResolutionResult::HighConfidence(cand) => {
                assert!(cand.confidence_score >= 0.85);
            }
            other => panic!("Expected HighConfidence with quote variation, got {:?}", other),
        }
    }

    #[test]
    fn test_failed_anchor_on_deleted_content() {
        let anchor = TextQuoteAnchor::new(
            "This text does not exist anywhere in the chapter at all.",
            None,
            None,
        );

        let result = AnchorEngine::resolve_quote(&anchor, SAMPLE_CHAPTER);
        match result {
            ResolutionResult::Failed { reason, .. } => {
                assert!(reason.contains("No matching candidate"));
            }
            other => panic!("Expected Failed, got {:?}", other),
        }
    }
}
