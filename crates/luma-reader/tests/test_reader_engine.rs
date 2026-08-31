use std::fs::File;
use std::io::Write;
use tempfile::NamedTempFile;
use zip::write::FileOptions;
use zip::ZipWriter;

use luma_reader::{EpubDocument, PdfDocument};

fn create_test_epub() -> NamedTempFile {
    let file = NamedTempFile::new().unwrap();
    let mut zip = ZipWriter::new(File::create(file.path()).unwrap());
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

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
    <dc:title>Distributed Systems Architecture</dc:title>
    <dc:creator>Leslie Lamport</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="text/ch1.xhtml" media-type="application/xhtml+xml" />
    <item id="ch2" href="text/ch2.xhtml" media-type="application/xhtml+xml" />
  </manifest>
  <spine>
    <itemref idref="ch1" />
    <itemref idref="ch2" />
  </spine>
</package>"#,
    )
    .unwrap();

    // 4. OEBPS/text/ch1.xhtml
    zip.start_file("OEBPS/text/ch1.xhtml", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 1: Consensus Protocols</title></head>
<body>
  <h1>Chapter 1: Consensus Protocols</h1>
  <p>In distributed computing, Paxos is a family of protocols for solving consensus in a network of unreliable processors.</p>
  <p>Annotation integrity ensures that reader highlights survive layout shifts and font changes without drifting.</p>
</body>
</html>"#,
    )
    .unwrap();

    // 5. OEBPS/text/ch2.xhtml
    zip.start_file("OEBPS/text/ch2.xhtml", options).unwrap();
    zip.write_all(
        br#"<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter 2: State Machine Replication</title></head>
<body>
  <h1>Chapter 2: State Machine Replication</h1>
  <p>Replicating deterministic state machines across multiple independent nodes provides high availability.</p>
</body>
</html>"#,
    )
    .unwrap();

    zip.finish().unwrap();
    file
}

#[test]
fn test_epub_document_reader_pipeline() {
    let epub_file = create_test_epub();
    let doc = EpubDocument::open(epub_file.path()).expect("EPUB open failed");

    // Verify Spine count & TOC
    assert_eq!(doc.spine_count(), 2);
    assert_eq!(doc.toc().len(), 2);

    // Verify Chapter 1 Content
    let ch1 = doc.get_chapter(0).expect("Get Chapter 1 failed");
    assert_eq!(ch1.spine_index, 0);
    assert_eq!(ch1.title, "Chapter 1: Consensus Protocols");
    assert!(ch1.text_content.contains("Paxos is a family of protocols"));

    // Verify Chapter 2 Content
    let ch2 = doc.get_chapter(1).expect("Get Chapter 2 failed");
    assert_eq!(ch2.spine_index, 1);
    assert!(ch2.text_content.contains("deterministic state machines"));

    // Verify In-Document Search
    let matches = doc.search("Annotation integrity").expect("Search failed");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].spine_index, 0);
    assert!(matches[0].locator.starts_with("epubcfi"));
    assert!(matches[0].snippet.contains("Annotation integrity"));
}

#[test]
fn test_pdf_document_reader_pipeline() {
    let mut pdf_file = NamedTempFile::new().unwrap();
    pdf_file
        .write_all(
            b"%PDF-1.7\n1 0 obj\n<< /Type /Page /Title (System Architecture Overview) >>\nendobj\n2 0 obj\n<< /Type /Page /Title (Storage Subsystem) >>\nendobj",
        )
        .unwrap();

    let doc = PdfDocument::open(pdf_file.path()).expect("PDF open failed");
    assert_eq!(doc.page_count(), 2);
    assert_eq!(doc.toc().len(), 2);

    let page1 = doc.get_page(1).expect("Get page 1 failed");
    assert_eq!(page1.page_number, 1);
    assert_eq!(page1.width_pt, 595.0);
    assert_eq!(page1.height_pt, 842.0);
}
