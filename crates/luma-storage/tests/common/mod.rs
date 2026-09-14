//! Shared test fixtures for luma-storage integration and perf tests.
//!
//! These helpers encode schema knowledge (book INSERT shape) and EPUB
//! structure knowledge once so tests do not drift apart. Each test binary
//! compiles this module, so helpers unused by a given binary are allowed.
#![allow(dead_code)]

use luma_core::ids::DeviceId;
use luma_core::models::book::{Book, ReadingStatus};
use luma_storage::db::Database;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use std::time::Instant;

/// Bulk-insert `count` books in one transaction; returns the insert duration in ms.
/// Every book gets one author link and every third book gets `ReadingStatus::Reading`.
pub fn seed_books(db: &Database, count: usize) -> f64 {
    use luma_storage::repos::AuthorRepository;

    let author_repo = AuthorRepository::new(db.clone());
    let device_id = DeviceId::new();
    let author = author_repo
        .get_or_create_by_name("Perf Validation Author", device_id)
        .expect("author");

    let start = Instant::now();
    db.with_write_conn(|conn| {
        let tx = conn.transaction().expect("tx");
        for i in 0..count {
            let mut b = Book::new(format!("Validation Book {i:06}"), device_id);
            b.author_ids.push(author.id);
            if i % 3 == 0 {
                b.reading_status = ReadingStatus::Reading;
            }
            insert_book(&tx, &b);
        }
        tx.commit().expect("commit");
        Ok(())
    })
    .expect("bulk seed");
    start.elapsed().as_secs_f64() * 1000.0
}

/// Insert one book (and its first author link) inside an open transaction.
/// Encodes the `books` INSERT shape in exactly one place.
pub fn insert_book(tx: &rusqlite::Transaction<'_>, b: &Book) {
    let state_str = b.library_state.to_string();
    let status_str = b.reading_status.to_string();
    let created_str = b.sync.created_at.to_rfc3339();
    let updated_str = b.sync.updated_at.to_rfc3339();
    let dev_str = b.sync.device_id.to_string();
    tx.execute(
        r#"
        INSERT INTO books (
            id, title, subtitle, series_id, series_index, description,
            publisher, published_date, language, isbn, cover_image_path,
            primary_file_id, reading_status, library_state, trashed_at,
            version, created_at, updated_at, device_id, is_deleted
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
        "#,
        rusqlite::params![
            b.id.to_string(),
            b.title,
            b.subtitle,
            b.series_id.map(|s| s.to_string()),
            b.series_index,
            b.description,
            b.publisher,
            b.published_date,
            b.language,
            b.isbn,
            b.cover_image_path,
            b.primary_file_id.map(|f| f.to_string()),
            status_str,
            state_str,
            b.trashed_at.map(|t| t.to_rfc3339()),
            b.sync.version.0 as i64,
            created_str,
            updated_str,
            dev_str,
            0
        ],
    )
    .expect("insert book");
    if let Some(author_id) = b.author_ids.first() {
        tx.execute(
            "INSERT INTO book_authors (book_id, author_id, position) VALUES (?1, ?2, ?3)",
            rusqlite::params![b.id.to_string(), author_id.to_string(), 0],
        )
        .expect("insert author link");
    }
}

/// Write a minimal valid EPUB with `chapters` chapters to `dest_path`.
/// Chapter bodies contain the search-relevant phrase "Novel Volume".
pub fn create_epub(dest_path: &Path, title: &str, author: &str, num_chapters: usize) {
    use zip::write::{SimpleFileOptions, ZipWriter};
    use zip::CompressionMethod;

    let file = File::create(dest_path).expect("create epub file");
    let mut zip = ZipWriter::new(file);
    let options =
        SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let raw_options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

    zip.start_file("mimetype", raw_options).expect("mimetype");
    zip.write_all(b"application/epub+zip").expect("write");

    zip.start_file("META-INF/container.xml", options).expect("container");
    zip.write_all(
        br#"<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#,
    )
    .expect("write");

    zip.start_file("EPUB/package.opf", options).expect("opf");
    let mut manifest = format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>{title}</dc:title>
    <dc:creator>{author}</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
"#
    );
    let mut spine = String::from("  <spine>\n");
    for i in 0..num_chapters {
        manifest.push_str(&format!(
            r#"    <item id="ch{i}" href="ch{i}.xhtml" media-type="application/xhtml+xml"/>"#
        ));
        manifest.push('\n');
        spine.push_str(&format!(r#"    <itemref idref="ch{i}"/>"#));
        spine.push('\n');
    }
    manifest.push_str("  </manifest>\n");
    spine.push_str("  </spine>\n</package>");
    manifest.push_str(&spine);
    zip.write_all(manifest.as_bytes()).expect("write");

    for i in 0..num_chapters {
        zip.start_file(format!("EPUB/ch{i}.xhtml"), options).expect("chapter");
        zip.write_all(
            format!(
                r#"<!DOCTYPE html><html><body><h1>Chapter {}</h1><p>Realistic body paragraph with Novel Volume text for search indexing and reading evaluation.</p></body></html>"#,
                i + 1
            )
            .as_bytes(),
        )
        .expect("write");
    }

    zip.finish().expect("finish epub");
}

/// Build a syntactically valid synthetic PDF with `num_pages` simple text pages as bytes.
pub fn synthetic_pdf_bytes(num_pages: usize) -> Vec<u8> {
    let mut content = String::from("%PDF-1.7\n");
    for i in 1..=num_pages {
        content.push_str(&format!(
            "{a} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n",
            a = i + 2
        ));
        content.push_str(&format!(
            "{b} 0 obj\n<< /Length 60 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Page {i} content with text payload) Tj\nET\nendstream\nendobj\n",
            b = i + 1000
        ));
    }
    content.push_str("2 0 obj\n<< /Type /Pages /Count ");
    content.push_str(&num_pages.to_string());
    content.push_str(" >>\nendobj\n%%EOF\n");
    content.into_bytes()
}
