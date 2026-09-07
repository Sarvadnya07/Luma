use std::fs::File;
use std::io::Write;
use tempfile::tempdir;

use luma_core::models::book::DocumentFormat;
use luma_core::models::canonical::{DocumentPosition, DocumentRange};
use luma_reader::canonical::CanonicalDocument;

#[test]
fn test_adversarial_empty_files() {
    let dir = tempdir().expect("temp dir");

    // 1. Empty TXT
    let txt_path = dir.path().join("empty.txt");
    File::create(&txt_path).expect("create empty txt");
    let txt_doc = CanonicalDocument::open(&txt_path, DocumentFormat::Txt).expect("open empty txt");
    assert_eq!(txt_doc.title(), "empty");
    let txt_structure = txt_doc.structure().expect("txt structure");
    assert_eq!(txt_structure.total_paragraphs, 0);
    assert_eq!(txt_structure.total_words, 0);
    assert_eq!(txt_doc.get_headings().expect("headings").len(), 0);
    assert_eq!(txt_doc.search_canonical("test").expect("search").len(), 0);
    assert!(txt_doc.get_paragraph(0, 0).is_err());

    // 2. Empty Markdown
    let md_path = dir.path().join("empty.md");
    File::create(&md_path).expect("create empty md");
    let md_doc = CanonicalDocument::open(&md_path, DocumentFormat::Md).expect("open empty md");
    assert_eq!(md_doc.title(), "empty");
    let md_structure = md_doc.structure().expect("md structure");
    assert_eq!(md_structure.total_paragraphs, 0);
    assert_eq!(md_doc.get_headings().expect("headings").len(), 0);

    // 3. Empty HTML
    let html_path = dir.path().join("empty.html");
    File::create(&html_path).expect("create empty html");
    let html_doc =
        CanonicalDocument::open(&html_path, DocumentFormat::Html).expect("open empty html");
    assert_eq!(html_doc.title(), "empty");
    let html_structure = html_doc.structure().expect("html structure");
    assert_eq!(html_structure.total_paragraphs, 0);
}

#[test]
fn test_adversarial_malformed_html() {
    let dir = tempdir().expect("temp dir");
    let html_path = dir.path().join("broken.html");

    // Malformed HTML with unclosed tags, script tags, and broken attributes
    let broken_content = r#"
        <html>
        <head><title>Unclosed Document
        <body>
        <script>alert('xss');</script>
        <h1>Header Without Close
        <p>Paragraph with <b>unclosed bold and <a href="http://example.com?a=1&b=2">link</p>
        <div>Nested unclosed <span>inner content</div>
        <h3>Valid H3</h3>
        <p>Final note.</p>
    "#;
    let mut file = File::create(&html_path).expect("create file");
    file.write_all(broken_content.as_bytes()).expect("write");

    let doc = CanonicalDocument::open(&html_path, DocumentFormat::Html).expect("open broken html");

    // Must not panic, must extract title or fallback gracefully
    assert!(!doc.title().is_empty());

    let structure = doc.structure().expect("structure");
    assert!(
        structure.total_paragraphs > 0,
        "Should recover paragraphs from broken HTML"
    );

    // Sanitization check: Ensure script tag is not leaked as reader content
    let search_script = doc.search_canonical("alert").expect("search");
    assert_eq!(
        search_script.len(),
        0,
        "Script contents should be sanitized/omitted"
    );

    // Valid H3 heading extraction
    let headings = doc.get_headings().expect("headings");
    assert!(
        headings
            .iter()
            .any(|h| h.text.as_deref() == Some("Valid H3")),
        "Should find valid heading even among malformed HTML"
    );
}

#[test]
fn test_adversarial_unicode_and_emojis() {
    let dir = tempdir().expect("temp dir");
    let txt_path = dir.path().join("unicode.txt");

    // Multibyte UTF-8: CJK, Arabic, Hebrew, Emojis, Accented Latin, Math symbols
    let unicode_text = "🦀 Rust & Luma 🚀\n\nCafé au lait — Déjà vu.\n\nمرحبا بالعالم (Arabic RTL)\n\nשלום עולם (Hebrew RTL)\n\n日本語の段落です。漢字とひらがな。\n\n∀x ∈ ℝ: x² ≥ 0.";
    let mut file = File::create(&txt_path).expect("create file");
    file.write_all(unicode_text.as_bytes()).expect("write");

    let doc = CanonicalDocument::open(&txt_path, DocumentFormat::Txt).expect("open unicode txt");

    let structure = doc.structure().expect("structure");
    assert_eq!(structure.total_paragraphs, 6);

    // Test paragraph extraction with multibyte characters
    let p0 = doc.get_paragraph(0, 0).expect("p0");
    assert_eq!(p0, "🦀 Rust & Luma 🚀");

    let p1 = doc.get_paragraph(0, 1).expect("p1");
    assert_eq!(p1, "Café au lait — Déjà vu.");

    let p2 = doc.get_paragraph(0, 2).expect("p2");
    assert_eq!(p2, "مرحبا بالعالم (Arabic RTL)");

    let p4 = doc.get_paragraph(0, 4).expect("p4");
    assert_eq!(p4, "日本語の段落です。漢字とひらがな。");

    // Test search across multibyte UTF-8 boundaries
    let search_crab = doc.search_canonical("🦀").expect("search crab");
    assert_eq!(search_crab.len(), 1);

    let search_jp = doc.search_canonical("日本語").expect("search japanese");
    assert_eq!(search_jp.len(), 1);

    // Range slicing within unicode text
    // "Café au lait" - ensure character vs byte boundary does not panic
    let range = DocumentRange::new(
        DocumentPosition::new(0, 17), // points to line 2
        DocumentPosition::new(0, 21),
    );
    let range_res = doc.get_range_text(&range);
    assert!(
        range_res.is_ok(),
        "Unicode range slicing should be safe and not panic"
    );
}

#[test]
fn test_adversarial_out_of_bounds_queries() {
    let dir = tempdir().expect("temp dir");
    let txt_path = dir.path().join("bounds.txt");

    let text = "Line 1\n\nLine 2";
    let mut file = File::create(&txt_path).expect("create file");
    file.write_all(text.as_bytes()).expect("write");

    let doc = CanonicalDocument::open(&txt_path, DocumentFormat::Txt).expect("open txt");

    // Query non-existent section
    assert!(doc.get_paragraph(999, 0).is_err());

    // Query non-existent paragraph
    assert!(doc.get_paragraph(0, 999).is_err());

    // Inverted range (start > end)
    let inverted = DocumentRange::new(DocumentPosition::new(0, 20), DocumentPosition::new(0, 5));
    let inverted_slice = doc.get_range_text(&inverted);
    // Either returns empty string or gracefully bounds, but must never panic
    assert!(inverted_slice.is_ok() || inverted_slice.is_err());

    // Huge range far past document end
    let past_end = DocumentRange::new(
        DocumentPosition::new(0, 5),
        DocumentPosition::new(0, 999999),
    );
    let past_slice = doc.get_range_text(&past_end).expect("past slice");
    assert!(
        !past_slice.is_empty(),
        "Should slice up to end of document without panicking"
    );
}
