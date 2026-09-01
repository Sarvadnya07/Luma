use std::fs::File;
use std::io::Write;
use tempfile::NamedTempFile;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use luma_core::models::book::DocumentFormat;
use luma_reader::detector::FormatDetector;
use luma_reader::extractors::{EpubExtractor, PdfExtractor, TextExtractor};

fn create_sample_epub() -> NamedTempFile {
    let file = NamedTempFile::new().unwrap();
    let mut zip = ZipWriter::new(File::create(file.path()).unwrap());

    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Stored)
        .unix_permissions(0o644);

    // 1. mimetype
    zip.start_file("mimetype", options).unwrap();
    zip.write_all(b"application/epub+zip").unwrap();

    // 2. META-INF/container.xml
    zip.start_file("META-INF/container.xml", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
    )
    .unwrap();

    // 3. OEBPS/content.opf
    zip.start_file("OEBPS/content.opf", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>The Principles of Quantum Computing</dc:title>
    <dc:creator>Alice Quantum</dc:creator>
    <dc:creator>Bob Superposition</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Science Press</dc:publisher>
    <dc:identifier id="pub-id">urn:isbn:9781234567890</dc:identifier>
    <dc:description>A comprehensive guide to qubits and entanglement.</dc:description>
    <dc:subject>Physics</dc:subject>
    <dc:subject>Computer Science</dc:subject>
    <meta property="belongs-to-collection">Quantum Computing Series</meta>
    <meta property="group-position">1</meta>
  </metadata>
  <manifest>
    <item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image" />
    <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml" />
  </manifest>
  <spine>
    <itemref idref="ch1" />
  </spine>
</package>"#,
    )
    .unwrap();

    // 4. Dummy Cover Image
    zip.start_file("OEBPS/images/cover.jpg", options).unwrap();
    zip.write_all(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB")
        .unwrap();

    zip.finish().unwrap();
    file
}

#[test]
fn test_epub_format_detection_and_extraction() {
    let epub_file = create_sample_epub();
    let format =
        FormatDetector::detect_from_file(epub_file.path()).expect("format detection failed");
    assert_eq!(format, DocumentFormat::Epub);

    let pkg = EpubExtractor::extract(epub_file.path()).expect("EPUB extraction failed");
    assert_eq!(pkg.metadata.title, "The Principles of Quantum Computing");
    assert_eq!(
        pkg.metadata.authors,
        vec!["Alice Quantum", "Bob Superposition"]
    );
    assert_eq!(pkg.metadata.publisher, Some("Science Press".to_string()));
    assert_eq!(
        pkg.metadata.isbn,
        Some("urn:isbn:9781234567890".to_string())
    );
    assert_eq!(pkg.series, Some("Quantum Computing Series".to_string()));
    assert_eq!(pkg.series_index, Some(1.0));
    assert!(pkg.subjects.contains(&"Physics".to_string()));
    assert!(pkg.cover.is_some());
}

#[test]
fn test_pdf_extraction() {
    let mut pdf_file = NamedTempFile::new().unwrap();
    pdf_file
        .write_all(
            b"%PDF-1.7\n1 0 obj\n<< /Title (Distributed Consensus Protocols) /Author (Leslie Lamport) /Subject (Fault-Tolerant Systems) >>\nendobj",
        )
        .unwrap();

    let format = FormatDetector::detect_from_file(pdf_file.path()).expect("PDF format detect");
    assert_eq!(format, DocumentFormat::Pdf);

    let pkg = PdfExtractor::extract(pdf_file.path()).expect("PDF extraction failed");
    assert_eq!(pkg.metadata.title, "Distributed Consensus Protocols");
    assert_eq!(pkg.metadata.authors, vec!["Leslie Lamport".to_string()]);
    assert_eq!(pkg.metadata.description, Some("Fault-Tolerant Systems".to_string()));
}

#[test]
fn test_markdown_and_text_extraction() {
    let mut md_file = NamedTempFile::new().unwrap();
    md_file
        .write_all(
            b"---\ntitle: \"Architecture Notes\"\nauthor: \"Lead Architect\"\ndescription: \"System blueprint\"\n---\n\n# Chapter 1\nBody text",
        )
        .unwrap();

    let meta =
        TextExtractor::extract(md_file.path(), DocumentFormat::Md).expect("Markdown extract");
    assert_eq!(meta.title, "Architecture Notes");
    assert_eq!(meta.authors, vec!["Lead Architect".to_string()]);
    assert_eq!(meta.description, Some("System blueprint".to_string()));
}
