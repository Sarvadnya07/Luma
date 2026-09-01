use luma_reader::encoding::{decode_text_bytes, decode_xml_and_html_entities, is_binary_resource};
use luma_reader::pdf_doc::PdfDocument;
use luma_reader::TocItem;

#[test]
fn test_utf8_bom_and_multilingual_decoding() {
    // 1. UTF-8 with BOM
    let mut bom_bytes = vec![0xEF, 0xBB, 0xBF];
    bom_bytes.extend_from_slice("The Architecture of Silence — Elena Vance".as_bytes());
    let decoded_bom = decode_text_bytes(&bom_bytes);
    assert_eq!(decoded_bom, "The Architecture of Silence — Elena Vance");
    assert!(!decoded_bom.contains('\u{FFFD}'));

    // 2. Multilingual Unicode strings
    let devanagari = "नमस्ते दुनिया — शांति और वास्तुकला";
    assert_eq!(decode_text_bytes(devanagari.as_bytes()), devanagari);

    let cjk = "寂静的建筑 — 空间与静止之美";
    assert_eq!(decode_text_bytes(cjk.as_bytes()), cjk);

    let arabic = "هندسة الصمت — الجمال والفضاء";
    assert_eq!(decode_text_bytes(arabic.as_bytes()), arabic);

    let european = "L'architecture du silence: Élégance & Sérénité";
    assert_eq!(decode_text_bytes(european.as_bytes()), european);
}

#[test]
fn test_epub_toc_and_entity_decoding_without_mojibake() {
    // Simulates EPUB 3 Navigation Document with nested spans and numeric HTML character entities
    let nav_xhtml = r#"
    <?xml version="1.0" encoding="UTF-8"?>
    <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
    <body>
      <nav epub:type="toc" id="toc">
        <ol>
          <li><a href="text/ch08.xhtml"><span class="chapter-number">8</span> <span class="chapter-title">How to Make a Habit Irresistible</span></a></li>
          <li><a href="text/ch09.xhtml"><span class="num">9</span> The Role of Family &amp; Friends in Shaping Your Habits</a></li>
          <li><a href="text/ch10.xhtml">Chapter 10: How to Find &amp; Fix the Causes of Bad Habits</a></li>
          <li><a href="text/law3.xhtml">The 3rd Law &mdash; Make It Easy</a></li>
        </ol>
      </nav>
    </body>
    </html>
    "#;

    // Test entity decoding
    let decoded_entities = decode_xml_and_html_entities(
        "The 3rd Law &mdash; &#8216;Make It Easy&#8217; &#x2014; &#160;",
    );
    assert_eq!(decoded_entities, "The 3rd Law — ‘Make It Easy’ — \u{00A0}");
    assert!(!decoded_entities.contains('\u{FFFD}'));


    // Test XML Nav doc TOC extraction
    let mut reader = quick_xml::Reader::from_str(nav_xhtml);
    reader.config_mut().trim_text(true);

    let mut items = Vec::new();
    let mut buf = Vec::new();
    let mut current_href = String::new();
    let mut current_parts = Vec::new();
    let mut inside_a = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if name == "a" {
                    inside_a = true;
                    current_parts.clear();
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"href" {
                            current_href = String::from_utf8_lossy(&attr.value).to_string();
                        }
                    }
                }
            }
            Ok(quick_xml::events::Event::Text(e)) if inside_a => {
                let text = String::from_utf8_lossy(e.as_ref()).to_string();
                let decoded = decode_xml_and_html_entities(&text);
                if !decoded.trim().is_empty() {
                    current_parts.push(decoded.trim().to_string());
                }
            }
            Ok(quick_xml::events::Event::End(e)) => {
                let name = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
                if name == "a" {
                    inside_a = false;
                    let full_title = current_parts.join(" ");
                    items.push(TocItem {
                        title: full_title,
                        locator: current_href.clone(),
                        play_order: Some((items.len() + 1) as u32),
                        children: Vec::new(),
                    });
                    current_href.clear();
                    current_parts.clear();
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            _ => {}
        }
        buf.clear();
    }

    assert_eq!(items.len(), 4);
    assert_eq!(items[0].title, "8 How to Make a Habit Irresistible");
    assert_eq!(items[0].locator, "text/ch08.xhtml");
    assert_eq!(
        items[1].title,
        "9 The Role of Family & Friends in Shaping Your Habits"
    );
    assert_eq!(items[3].title, "The 3rd Law — Make It Easy");
}

#[test]
fn test_binary_resource_isolation() {
    assert!(is_binary_resource("image/png", "images/fig1.png"));
    assert!(is_binary_resource("font/woff2", "fonts/custom.woff2"));
    assert!(is_binary_resource("font/ttf", "fonts/custom.ttf"));
    assert!(!is_binary_resource(
        "application/xhtml+xml",
        "text/ch01.xhtml"
    ));
    assert!(!is_binary_resource("application/x-dtbncx+xml", "toc.ncx"));
}

#[test]
fn test_pdf_escape_and_entropy_rejection() {
    // 1. Literal PDF Escapes
    let raw_escapes = r"(The\040Architecture\040of\040Silence\nSection\0401)";
    let decoded = PdfDocument::decode_pdf_string_literal(raw_escapes);
    assert_eq!(decoded, "The Architecture of Silence\nSection 1");

    // 2. Hex String
    let hex_str = "<48656C6C6F20576F726C64>";
    let decoded_hex = PdfDocument::decode_pdf_string_literal(hex_str);
    assert_eq!(decoded_hex, "Hello World");

    // 3. Binary Garbage / Unmapped CID Stream Rejection
    let binary_garbage = "\u{0001}\u{0002}\u{0005}\u{0014}\u{001b}†tQEr%x\u{0000}\u{0008}\u{000c}";
    assert!(!PdfDocument::is_valid_printable_text(binary_garbage));

    let clean_text = "Atomic Habits: An Easy & Proven Way to Build Good Habits & Break Bad Ones";
    assert!(PdfDocument::is_valid_printable_text(clean_text));
}
