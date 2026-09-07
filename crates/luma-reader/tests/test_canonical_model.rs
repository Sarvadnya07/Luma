use std::fs::File;
use std::io::Write;
use tempfile::tempdir;

use luma_core::models::book::DocumentFormat;
use luma_core::models::canonical::{
    CanonicalDocumentMetadata, DocumentFamily, DocumentPosition, DocumentRange, NodeKind,
};
use luma_reader::canonical::CanonicalDocument;

#[test]
fn test_canonical_text_document() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("sample.txt");

    let text = "First Chapter Title\n\nThis is paragraph zero of the book.\n\nThis is paragraph one with insightful commentary.\n\nFinal concluding thoughts.";
    let mut file = File::create(&file_path).expect("create file");
    file.write_all(text.as_bytes()).expect("write");

    let doc = CanonicalDocument::open(&file_path, DocumentFormat::Txt).expect("open canonical txt");
    assert_eq!(doc.family(), DocumentFamily::Reflowable);
    assert!(doc.capabilities().reflowable);
    assert!(doc.capabilities().searchable);
    assert!(doc.capabilities().extractable_text);

    // Structure inspection
    let structure = doc.structure().expect("structure");
    assert_eq!(structure.total_paragraphs, 4);
    assert!(structure.total_words > 10);

    // Paragraph query
    let p0 = doc.get_paragraph(0, 0).expect("get paragraph 0");
    assert_eq!(p0, "First Chapter Title");

    let p1 = doc.get_paragraph(0, 1).expect("get paragraph 1");
    assert_eq!(p1, "This is paragraph zero of the book.");

    // Range query
    let range = DocumentRange::new(
        DocumentPosition::new(0, 0),
        DocumentPosition::new(0, 19),
    );
    let slice = doc.get_range_text(&range).expect("range text");
    assert_eq!(slice, "First Chapter Title");

    // Citation generation
    let metadata = CanonicalDocumentMetadata {
        title: "The Book of Reflection".to_string(),
        subtitle: None,
        authors: vec!["Jane Doe".to_string()],
        contributors: Vec::new(),
        language: Some("en".to_string()),
        publisher: Some("Luma Press".to_string()),
        publication_date: Some("2026".to_string()),
        identifier: None,
        isbn: None,
        series: None,
        series_index: None,
        tags: Vec::new(),
        description: None,
        format: DocumentFormat::Txt,
        mime_type: "text/plain".to_string(),
        encoding: "utf-8".to_string(),
        source_fingerprint: String::new(),
        total_pages_or_spines: Some(1),
    };

    let cit_range = DocumentRange::new(
        DocumentPosition::new(0, 21),
        DocumentPosition::new(0, 56),
    );
    let citation = doc
        .get_citation_context(&cit_range, Some(&metadata))
        .expect("citation context");
    assert_eq!(citation.quote, "This is paragraph zero of the book.");
    assert!(citation.formatted_citation.contains("Jane Doe (2026). The Book of Reflection"));

    // Canonical search
    let matches = doc.search_canonical("insightful").expect("search canonical");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].section_index, 0);
    assert!(matches[0].snippet.contains("insightful"));
}

#[test]
fn test_canonical_markdown_document() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("sample.md");

    let md_content = "# Guide to Distributed Systems\n\nDistributed systems require consensus algorithms.\n\n## Paxos and Raft\n\nRaft simplifies consensus through leader election.\n\n> Consensus is hard.\n\n```rust\nfn elect() -> bool { true }\n```";
    let mut file = File::create(&file_path).expect("create file");
    file.write_all(md_content.as_bytes()).expect("write");

    let doc = CanonicalDocument::open(&file_path, DocumentFormat::Md).expect("open canonical md");
    assert_eq!(doc.family(), DocumentFamily::Reflowable);
    assert_eq!(doc.title(), "Guide to Distributed Systems");

    let structure = doc.structure().expect("structure");
    let headings = doc.get_headings().expect("headings");
    assert_eq!(headings.len(), 2);
    assert_eq!(headings[0].text.as_deref(), Some("Guide to Distributed Systems"));
    assert_eq!(headings[1].text.as_deref(), Some("Paxos and Raft"));

    // Verify paragraph extraction
    let p0 = doc.get_paragraph(0, 0).expect("get paragraph 0");
    assert_eq!(p0, "Distributed systems require consensus algorithms.");

    let p1 = doc.get_paragraph(0, 1).expect("get paragraph 1");
    assert_eq!(p1, "Raft simplifies consensus through leader election.");

    // Verify code block node exists in structure
    let has_code_block = structure.root.children.iter().any(|node| matches!(node.kind, NodeKind::CodeBlock { .. }));
    assert!(has_code_block, "Structure should contain CodeBlock node");

    // Verify blockquote node exists in structure
    let has_quote = structure.root.children.iter().any(|node| matches!(node.kind, NodeKind::Blockquote));
    assert!(has_quote, "Structure should contain Blockquote node");
}

#[test]
fn test_canonical_html_document() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("sample.html");

    let html_content = "<html><head><title>Quantum Computing</title></head><body><h1>Introduction</h1><p>Qubits exhibit superposition.</p><h2>Entanglement</h2><p>Spooky action at a distance.</p></body></html>";
    let mut file = File::create(&file_path).expect("create file");
    file.write_all(html_content.as_bytes()).expect("write");

    let doc = CanonicalDocument::open(&file_path, DocumentFormat::Html).expect("open canonical html");
    assert_eq!(doc.title(), "Quantum Computing");

    let headings = doc.get_headings().expect("headings");
    assert_eq!(headings.len(), 2);
    assert_eq!(headings[0].text.as_deref(), Some("Introduction"));
    assert_eq!(headings[1].text.as_deref(), Some("Entanglement"));

    let p0 = doc.get_paragraph(0, 0).expect("p0");
    assert_eq!(p0, "Qubits exhibit superposition.");

    let p1 = doc.get_paragraph(0, 1).expect("p1");
    assert_eq!(p1, "Spooky action at a distance.");
}

#[test]
fn test_canonical_cbz_document_natural_sort_and_resources() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("comic.cbz");

    let file = File::create(&file_path).expect("create file");
    let mut zip = zip::ZipWriter::new(file);

    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Stored);

    // ComicInfo.xml
    zip.start_file("ComicInfo.xml", options).expect("zip file");
    zip.write_all(b"<ComicInfo><Title>Neo Tokyo</Title><Series>Cyberpunk</Series><Writer>Akira K.</Writer></ComicInfo>").expect("write xml");

    // Add pages out of numeric order: page_10, page_2, page_1
    zip.start_file("page_10.jpg", options).expect("zip file");
    zip.write_all(b"PAGE10_IMAGE_DATA").expect("write page 10");

    zip.start_file("page_2.jpg", options).expect("zip file");
    zip.write_all(b"PAGE2_IMAGE_DATA").expect("write page 2");

    zip.start_file("page_1.jpg", options).expect("zip file");
    zip.write_all(b"PAGE1_IMAGE_DATA").expect("write page 1");

    zip.finish().expect("finish zip");

    let doc = CanonicalDocument::open(&file_path, DocumentFormat::Cbz).expect("open canonical cbz");
    assert_eq!(doc.family(), DocumentFamily::ImageSequence);
    assert_eq!(doc.title(), "Neo Tokyo");
    assert!(doc.capabilities().image_sequence);
    assert!(!doc.capabilities().searchable);

    // Resources & Natural Sort verification
    let resources = doc.get_resources();
    assert_eq!(resources.len(), 3);
    assert_eq!(resources[0].id, "page_1.jpg");
    assert_eq!(resources[1].id, "page_2.jpg");
    assert_eq!(resources[2].id, "page_10.jpg");

    // Read resource bytes
    let (bytes1, mime1) = doc.read_resource("page_1.jpg").expect("read page 1");
    assert_eq!(bytes1, b"PAGE1_IMAGE_DATA");
    assert_eq!(mime1, "image/jpeg");

    let (bytes10, _) = doc.read_resource("page_10.jpg").expect("read page 10");
    assert_eq!(bytes10, b"PAGE10_IMAGE_DATA");
}
