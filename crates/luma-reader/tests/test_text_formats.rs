use luma_reader::{HtmlDocument, MarkdownDocument, ReflowableDocument, TextDocument};
use std::fs::File;
use std::io::Write;
use tempfile::tempdir;

#[test]
fn test_txt_ascii_unicode_cjk_arabic_devanagari() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("multilingual.txt");

    let sample_text = "\
Philosophy & Reflection

Meditations on existence and consciousness.

CJK Section:
道可道，非常道。名可名，非常名。

Arabic Section:
العقل السليم في الجسم السليم

Devanagari Section:
सत्यमेव जयते नानृतं सत्येन पन्था विततो देवयानः

UTF-8 Symbols:
Mathematical symbols: ∀x ∈ ℝ, x² ≥ 0.
Emoji: 📚 🧠 📖 ✨
";

    let mut file = File::create(&file_path).expect("create file");
    file.write_all(sample_text.as_bytes()).expect("write");

    let doc = TextDocument::open(&file_path).expect("open txt");
    assert_eq!(doc.title(), "Philosophy & Reflection");
    assert_eq!(doc.spine_count(), 1);

    let ch = doc.get_chapter(0).expect("get chapter");
    assert!(ch.html_content.contains("Philosophy &amp; Reflection"));
    assert!(ch.html_content.contains("道可道，非常道"));
    assert!(ch.html_content.contains("العقل السليم"));
    assert!(ch.html_content.contains("सत्यमेव जयते"));
    assert!(ch.html_content.contains("∀x ∈ ℝ"));

    // Verify search
    let matches = doc.search("Arabic").expect("search");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].chapter_title, "Philosophy & Reflection");

    let cjk_matches = doc.search("非常道").expect("search cjk");
    assert_eq!(cjk_matches.len(), 1);
}

#[test]
fn test_txt_utf8_bom_and_long_text() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("bom_long.txt");

    let mut content = vec![0xEF, 0xBB, 0xBF]; // UTF-8 BOM
    content.extend_from_slice(b"BOM Title Header\n\n");
    for i in 0..500 {
        content.extend_from_slice(format!("Paragraph {} discussing deep scholarly knowledge.\n\n", i).as_bytes());
    }

    let mut file = File::create(&file_path).expect("create file");
    file.write_all(&content).expect("write");

    let doc = TextDocument::open(&file_path).expect("open txt with bom");
    assert_eq!(doc.title(), "BOM Title Header");

    let ch = doc.get_chapter(0).expect("get chapter");
    assert!(ch.html_content.contains("Paragraph 0 discussing"));
    assert!(ch.html_content.contains("Paragraph 499 discussing"));

    let search_res = doc.search("Paragraph 250").expect("search long doc");
    assert_eq!(search_res.len(), 1);
}

#[test]
fn test_markdown_full_parsing_and_security_sanitization() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("paper.md");

    let md_text = "\
---
title: \"Epistemic Justification in Science\"
author: \"Dr. Elena Vance\"
---

# Introduction to Epistemology

Knowledge is traditionally defined as **justified true belief**.

## Historical Foundations

Plato explored this in *Theaetetus*, examining whether belief accompanied by an account (*logos*) suffices.

### Core Problems

* Agrippa's Trilemma:
  1. Circular argument
  2. Infinite regress
  3. Dogmatic foundation
* Foundationalism vs Coherentism

> \"The difficulty is that foundational beliefs must themselves be justified without appeal to further beliefs.\"

Here is code demonstrating formal logic:
```python
def is_valid_syllogism(p1, p2, conclusion):
    return p1 and p2 == conclusion
```

Check this [Reference](https://plato.stanford.edu/entries/epistemology/).

Dangerous injection attempts:
<script>alert('pwned');</script>
<iframe src=\"https://malicious.com\"></iframe>
[Bad Link](javascript:alert('xss'))
<img src=\"x\" onerror=\"alert('exploit')\" />
";

    let mut file = File::create(&file_path).expect("create file");
    file.write_all(md_text.as_bytes()).expect("write");

    let doc = MarkdownDocument::open(&file_path).expect("open md");
    assert_eq!(doc.title(), "Epistemic Justification in Science");
    assert_eq!(doc.spine_count(), 1);

    // Verify TOC
    let toc = doc.toc();
    assert!(toc.len() >= 2);
    assert_eq!(toc[0].title, "Introduction to Epistemology");
    assert_eq!(toc[1].title, "Historical Foundations");

    let ch = doc.get_chapter(0).expect("get chapter");

    // Verify Markdown elements rendered
    assert!(ch.html_content.contains("<h1 id=\"heading-0\""));
    assert!(ch.html_content.contains("<strong>justified true belief</strong>"));
    assert!(ch.html_content.contains("<em>Theaetetus</em>"));
    assert!(ch.html_content.contains("<blockquote"));
    assert!(ch.html_content.contains("<pre"));
    assert!(ch.html_content.contains("def is_valid_syllogism"));
    assert!(ch.html_content.contains("<a href=\"https://plato.stanford.edu/entries/epistemology/\""));

    // Verify security defenses: NO script tags, NO iframes, NO javascript: URLs, NO onerror handlers
    assert!(!ch.html_content.contains("<script"));
    assert!(!ch.html_content.contains("alert('pwned')"));
    assert!(!ch.html_content.contains("<iframe"));
    assert!(!ch.html_content.contains("javascript:alert"));
    assert!(!ch.html_content.contains("onerror"));

    // Verify search
    let matches = doc.search("Agrippa").expect("search");
    assert_eq!(matches.len(), 1);
    assert!(matches[0].snippet.contains("Trilemma"));
}

#[test]
fn test_html_document_sanitization_and_toc() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("article.html");

    let html_content = "\
<!DOCTYPE html>
<html>
<head>
    <title>Quantum Decoherence Notes</title>
    <script>window.maliciousToken = 'stolen';</script>
</head>
<body onload=\"alert('executed')\">
    <h1>Quantum Decoherence and the Measurement Problem</h1>
    <p>Decoherence explains the apparent transition from quantum to classical probabilities.</p>
    <h2>Environment-Induced Superselection (Einselection)</h2>
    <p>The system density matrix rapidly diagonalizes in the pointer basis.</p>
    <iframe src=\"evil.html\"></iframe>
    <a href=\"javascript:doHacking()\">Click for more info</a>
    <a href=\"https://quantum.org/papers\" target=\"_blank\">Official Paper</a>
</body>
</html>
";

    let mut file = File::create(&file_path).expect("create file");
    file.write_all(html_content.as_bytes()).expect("write");

    let doc = HtmlDocument::open(&file_path).expect("open html");
    assert_eq!(doc.title(), "Quantum Decoherence Notes");
    assert_eq!(doc.spine_count(), 1);

    let toc = doc.toc();
    assert_eq!(toc.len(), 2);
    assert_eq!(toc[0].title, "Quantum Decoherence and the Measurement Problem");
    assert_eq!(toc[1].title, "Environment-Induced Superselection (Einselection)");

    let ch = doc.get_chapter(0).expect("get chapter");

    // Verify script, iframe, inline onload, and javascript: links are stripped/sanitized
    assert!(!ch.html_content.contains("<script"));
    assert!(!ch.html_content.contains("window.maliciousToken"));
    assert!(!ch.html_content.contains("<iframe"));
    assert!(!ch.html_content.contains("onload="));
    assert!(!ch.html_content.contains("javascript:doHacking()"));

    // Verify safe content remains
    assert!(ch.html_content.contains("Quantum Decoherence and the Measurement Problem"));
    assert!(ch.html_content.contains("density matrix rapidly diagonalizes"));
    assert!(ch.html_content.contains("https://quantum.org/papers"));

    // Search
    let matches = doc.search("diagonalizes").expect("search html");
    assert_eq!(matches.len(), 1);
}

#[test]
fn test_reflowable_document_polymorphic_dispatch() {
    let dir = tempdir().expect("temp dir");

    // Text file
    let txt_path = dir.path().join("dispatch.txt");
    let mut f = File::create(&txt_path).expect("create");
    f.write_all(b"Simple Text Document\n\nBody content goes here.").expect("write");

    let text_doc = TextDocument::open(&txt_path).expect("open text");
    let reflow = ReflowableDocument::Text(text_doc);

    assert_eq!(reflow.spine_count(), 1);
    assert_eq!(reflow.toc().len(), 1);
    let ch = reflow.get_chapter(0).expect("get chapter");
    assert!(ch.html_content.contains("Simple Text Document"));
    let search_res = reflow.search("Body").expect("search");
    assert_eq!(search_res.len(), 1);
}
