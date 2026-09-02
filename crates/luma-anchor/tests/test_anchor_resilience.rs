use luma_anchor::{AnchorEngine, CompositeAnchor, ResolutionResult, TextQuoteAnchor};

#[test]
fn test_anchor_resilience_across_typography_and_reflow_mutations() {
    let original_doc = "Chapter 1: The Principle of Architecture.\n\nIn software engineering, local-first systems prioritize user ownership and data autonomy. When network partitions occur, the application continues to operate without interruption.\n\nAnnotation integrity is the cornerstone of any serious reading system. If a highlight drifts or attaches to the wrong sentence after font changes, reader trust is permanently broken.\n\nEvery highlight must maintain multiple anchor signals.";

    let quote = "Annotation integrity is the cornerstone of any serious reading system.";
    let prefix = "without interruption. \n\n";
    let suffix = " If a highlight drifts";

    let anchor = CompositeAnchor {
        format_locator: None,
        quote_anchor: TextQuoteAnchor {
            exact: quote.to_string(),
            prefix: Some(prefix.to_string()),
            suffix: Some(suffix.to_string()),
            normalized_exact:
                "annotation integrity is the cornerstone of any serious reading system".to_string(),
        },
        chapter_content_hash: None,
        document_checksum: None,
    };

    // Scenario A: Exact Resolution on unmodified text
    let res_exact = AnchorEngine::resolve(&anchor, original_doc);
    match res_exact {
        ResolutionResult::HighConfidence(candidate) => {
            assert!(candidate.confidence_score >= 0.82);
            assert_eq!(candidate.matched_text, quote);
        }
        _ => panic!("Expected HighConfidence for exact match"),
    }

    // Scenario B: Whitespace mutation (simulating font reflow / CSS column spacing)
    let reflowed_doc = original_doc.replace("\n\n", "   \n\t ");
    let res_reflow = AnchorEngine::resolve(&anchor, &reflowed_doc);
    match res_reflow {
        ResolutionResult::HighConfidence(candidate) => {
            assert!(candidate.confidence_score >= 0.82);
        }
        _ => panic!("Expected HighConfidence for reflowed match"),
    }

    // Scenario C: Non-existent text correctly returns Failed (never attach to incorrect random text)
    let bad_anchor = CompositeAnchor {
        format_locator: None,
        quote_anchor: TextQuoteAnchor {
            exact: "This sentence does not exist anywhere in the text.".to_string(),
            prefix: None,
            suffix: None,
            normalized_exact: "this sentence does not exist anywhere in the text".to_string(),
        },
        chapter_content_hash: None,
        document_checksum: None,
    };
    let res_fail = AnchorEngine::resolve(&bad_anchor, original_doc);
    match res_fail {
        ResolutionResult::Failed { reason, .. } => {
            assert!(
                reason.contains("No matching candidate")
                    || reason.contains("below acceptable threshold")
            );
        }
        _ => panic!("Expected Failed for missing text"),
    }
}

#[test]
fn test_benchmark_fuzzy_anchor_resolution_throughput() {
    use std::time::Instant;

    let prefix_text = "In the heart of the ancient forest, beneath towering oaks, ";
    let target_quote = "the quick brown fox jumps over the lazy dog";
    let suffix_text = " and vanishes into the golden afternoon sunlight.";
    let filler = "Some other interesting chapters and paragraphs of the book text. ".repeat(50);

    let doc_text = format!(
        "{}{}{}{}{}",
        filler, prefix_text, target_quote, suffix_text, filler
    );

    let quote_anchor = TextQuoteAnchor {
        exact: target_quote.to_string(),
        prefix: Some(prefix_text.to_string()),
        suffix: Some(suffix_text.to_string()),
        normalized_exact: target_quote.to_string(),
    };

    let start = Instant::now();
    let iterations = 1000;
    for _ in 0..iterations {
        let res = AnchorEngine::resolve_quote(&quote_anchor, &doc_text);
        assert!(matches!(res, ResolutionResult::HighConfidence(_)));
    }
    let duration = start.elapsed();
    let avg_per_res_us = duration.as_micros() as f64 / iterations as f64;

    println!(
        "Benchmark: 1000 fuzzy anchor resolutions completed in {:?} (avg: {:.2} µs/res)",
        duration, avg_per_res_us
    );
    // Performance budget: < 1500 µs (debug build) / < 100 µs (release build)
    assert!(
        avg_per_res_us < 1500.0,
        "Anchor resolution exceeded latency budget: {:.2} µs",
        avg_per_res_us
    );
}
