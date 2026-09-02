use luma_reader::EpubDocument;
use std::fs::File;
use std::io::Write;
use std::time::Instant;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

fn create_sample_epub(num_chapters: usize) -> tempfile::NamedTempFile {
    let temp_file = tempfile::NamedTempFile::new().expect("temp file");
    let file = File::create(temp_file.path()).expect("create");
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    // mimetype
    let raw_options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    zip.start_file("mimetype", raw_options).expect("mimetype");
    zip.write_all(b"application/epub+zip").expect("write");

    // container.xml
    zip.start_file("META-INF/container.xml", options).expect("container");
    zip.write_all(br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#).expect("write");

    // content.opf
    zip.start_file("OEBPS/content.opf", options).expect("opf");
    let mut opf_manifest = String::from(r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Performance Test EPUB</dc:title>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
"#);

    let mut opf_spine = String::from("  <spine>\n");

    for i in 0..num_chapters {
        opf_manifest.push_str(&format!(
            r#"    <item id="ch{}" href="ch{}.xhtml" media-type="application/xhtml+xml"/>"#,
            i, i
        ));
        opf_manifest.push('\n');
        opf_spine.push_str(&format!(r#"    <itemref idref="ch{}"/>"#, i));
        opf_spine.push('\n');
    }
    opf_manifest.push_str("  </manifest>\n");
    opf_spine.push_str("  </spine>\n</package>");
    zip.write_all(format!("{}{}", opf_manifest, opf_spine).as_bytes()).expect("write");

    // Write chapter files
    for i in 0..num_chapters {
        zip.start_file(format!("OEBPS/ch{}.xhtml", i), options).expect("ch");
        zip.write_all(format!(
            r#"<!DOCTYPE html><html><body><h1>Chapter {}</h1><p>Content for chapter number {} with extensive text content.</p></body></html>"#,
            i, i
        ).as_bytes()).expect("write");
    }

    zip.finish().expect("finish");
    temp_file
}

#[test]
fn test_benchmark_epub_reopen_vs_session_reuse() {
    let epub_file = create_sample_epub(50);
    let path = epub_file.path();

    // Baseline: Re-opening the EPUB file on every single chapter read (existing ReaderService behavior)
    let reopen_start = Instant::now();
    for i in 0..50 {
        let doc = EpubDocument::open(path).expect("open");
        let chapter = doc.get_chapter(i).expect("chapter");
        assert_eq!(chapter.spine_index, i);
    }
    let reopen_duration = reopen_start.elapsed();
    println!("Baseline: 50 chapter reads with repeated EpubDocument::open = {:?}", reopen_duration);

    // Optimized: Reusing a single open EpubDocument session
    let session_start = Instant::now();
    let session_doc = EpubDocument::open(path).expect("open once");
    for i in 0..50 {
        let chapter = session_doc.get_chapter(i).expect("chapter from session");
        assert_eq!(chapter.spine_index, i);
    }
    let session_duration = session_start.elapsed();
    println!("Optimized: 50 chapter reads with session reuse = {:?}", session_duration);

    assert!(session_duration < reopen_duration);
    let speedup = reopen_duration.as_secs_f64() / session_duration.as_secs_f64();
    println!("Session reuse speedup: {:.2}x faster", speedup);
}
