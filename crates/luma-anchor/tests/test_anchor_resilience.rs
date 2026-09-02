use luma_anchor::{AnchorEngine, CompositeAnchor, ResolutionResult, TextQuoteAnchor};

// ============================================================================
// Constants for test configuration
// ============================================================================

/// Performance budget: maximum average µs per resolution (debug build).
/// In release builds this should be significantly lower.
const PERFORMANCE_BUDGET_MICROS: f64 = 1500.0;

/// High-confidence threshold used by the resilience tests.
/// The engine's internal configuration is private to the crate, so tests use the
/// canonical threshold expected by the resolution logic.
const HIGH_CONFIDENCE_THRESHOLD: f32 = 0.85;


// ============================================================================
// Test: Anchor resilience across mutations
// ============================================================================

#[test]
fn test_anchor_resilience_across_typography_and_reflow_mutations() {
    let engine = AnchorEngine::with_defaults();

    let original_doc = "Chapter 1: The Principle of Architecture.\n\nIn software engineering, local-first systems prioritize user ownership and data autonomy. When network partitions occur, the application continues to operate without interruption.\n\nAnnotation integrity is the cornerstone of any serious reading system. If a highlight drifts or attaches to the wrong sentence after font changes, reader trust is permanently broken.\n\nEvery highlight must maintain multiple anchor signals.";

    let quote = "Annotation integrity is the cornerstone of any serious reading system.";
    let prefix = "without interruption. \n\n";
    let suffix = " If a highlight drifts";

    let anchor = CompositeAnchor {
        format_locator: None,
        quote_anchor: TextQuoteAnchor::new(quote, Some(prefix.to_string()), Some(suffix.to_string())),
        chapter_content_hash: None,
        document_checksum: None,
    };

    // Scenario A: Exact Resolution on unmodified text
    let res_exact = engine.resolve(&anchor, original_doc);
    match res_exact {
        ResolutionResult::HighConfidence(candidate) => {
            assert!(
                candidate.confidence_score >= HIGH_CONFIDENCE_THRESHOLD,
                "Confidence score {:.2} below high threshold {:.2}",
                candidate.confidence_score,
                HIGH_CONFIDENCE_THRESHOLD
            );
            assert_eq!(candidate.matched_text, quote);
        }
        _ => panic!("Expected HighConfidence for exact match"),
    }

    // Scenario B: Whitespace mutation (simulating font reflow / CSS column spacing)
    let reflowed_doc = original_doc.replace("\n\n", "   \n\t ");
    let res_reflow = engine.resolve(&anchor, &reflowed_doc);
    match res_reflow {
        ResolutionResult::HighConfidence(candidate) => {
            assert!(
                candidate.confidence_score >= HIGH_CONFIDENCE_THRESHOLD,
                "Confidence score {:.2} below high threshold {:.2}",
                candidate.confidence_score,
                HIGH_CONFIDENCE_THRESHOLD
            );
        }
        _ => panic!("Expected HighConfidence for reflowed match"),
    }

    // Scenario C: Non-existent text correctly returns Failed
    let bad_anchor = CompositeAnchor {
        format_locator: None,
        quote_anchor: TextQuoteAnchor::new(
            "This sentence does not exist anywhere in the text.",
            None,
            None,
        ),
        chapter_content_hash: None,
        document_checksum: None,
    };
    let res_fail = engine.resolve(&bad_anchor, original_doc);
    match res_fail {
        ResolutionResult::Failed { best_candidate, reason } => {
            let expected_failure_reasons = ["matching candidate", "no candidate", "low confidence", "below acceptable threshold"];

            let reason_lower = reason.to_lowercase();
            let matches = expected_failure_reasons
                .iter()
                .any(|msg| reason_lower.contains(msg));
            assert!(
                matches,
                "Failure reason '{}' did not contain expected messages: {:?}",
                reason,
                expected_failure_reasons
            );
            assert!(best_candidate.is_none(), "Best candidate should be None on failure");


        }
        _ => panic!("Expected Failed for missing text"),
    }
}

// ============================================================================
// Test: Fuzzy anchor resolution throughput benchmark
// ============================================================================

#[test]
fn test_benchmark_fuzzy_anchor_resolution_throughput() {
    use std::time::Instant;

    let engine = AnchorEngine::with_defaults();

    let prefix_text = "In the heart of the ancient forest, beneath towering oaks, ";
    let target_quote = "the quick brown fox jumps over the lazy dog";
    let suffix_text = " and vanishes into the golden afternoon sunlight.";
    let filler = "Some other interesting chapters and paragraphs of the book text. ".repeat(50);

    let doc_text = format!(
        "{}{}{}{}{}",
        filler, prefix_text, target_quote, suffix_text, filler
    );

    let quote_anchor = TextQuoteAnchor::new(
        target_quote,
        Some(prefix_text.to_string()),
        Some(suffix_text.to_string()),
    );

    let iterations = 1000;
    let start = Instant::now();
    for _ in 0..iterations {
        let res = engine.resolve_quote(&quote_anchor, &doc_text);
        assert!(matches!(res, ResolutionResult::HighConfidence(_)));
    }
    let duration = start.elapsed();
    let avg_per_res_us = duration.as_micros() as f64 / iterations as f64;

    println!(
        "Benchmark: {} fuzzy anchor resolutions completed in {:?} (avg: {:.2} µs/res)",
        iterations, duration, avg_per_res_us
    );
    assert!(
        avg_per_res_us < PERFORMANCE_BUDGET_MICROS,
        "Anchor resolution exceeded latency budget: {:.2} µs (budget: {:.2} µs)",
        avg_per_res_us,
        PERFORMANCE_BUDGET_MICROS
    );
}  