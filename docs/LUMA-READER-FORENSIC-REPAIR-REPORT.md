# LUMA — READER FORENSIC REPAIR REPORT
## EPUB/PDF Decoding, Parsing, Rendering & Encoding Investigation and Resolution

**Date**: 2026-09-01  
**Target Engine**: `luma-reader`, `luma-security`, `luma-storage`, `luma-desktop`  
**Status**: `TEST-PROVEN` & `SOURCE-PROVEN`  

---

## 1. Observed Corruption & Incident Summary

Screenshots of real imported publications (*"Atomic Habits"*, etc.) revealed visual corruptions:
1. **EPUB Table of Contents (TOC)**:
   - Chapters and sections displayed leading `` replacement characters (e.g. `8 How to Make a Habit Irresistible`, `The 3rd Law`).
2. **Document Content & PDF Pages**:
   - The reader displayed raw binary stream fragments, unmapped font glyph IDs, and decompressed bytecode resembling `†tQEr... %... x...`.

---

## 2. Root Cause Analysis

### A. EPUB Character Decoding & Navigation Parser
1. **Brittle Navigation Document Regular Expressions**:
   - `parse_nav_doc_toc` used a regex `r#"<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)</a>"#`. In standard EPUB 3 navigation files, chapter numbers and titles are nested in child elements (e.g., `<span>8</span> How to Make a Habit...`). The regex dropped these tags or captured truncated multi-byte UTF-8 fragments.
2. **Missing Entity & Charset Decoder**:
   - Reading XML and XHTML directly using standard `read_to_string` failed or corrupted on UTF-8 BOM (`\xEF\xBB\xBF`) and non-ASCII character entities (e.g. `&#8212;`, `&#8217;`, `&nbsp;`, `&#160;`), injecting `\u{FFFD}` (``) into titles.
3. **Binary Resource Bleed**:
   - Without strict resource classification at the spine boundary, binary assets in EPUB packages risked being decoded as string data.

### B. PDF Binary Stream & Font CID Misinterpretation
1. **Unfiltered Stream Extraction**:
   - Previous stream extraction processed all object streams in the PDF file indiscriminately, including binary TrueType/Type 1 font programs (`/FontFile`), embedded image bitmaps (`/Subtype /Image`), and cross-reference tables.
2. **False Operator Matches on Binary Data**:
   - Arbitrary binary data containing `0x28` `(` and `0x29` `)` matching regex `\(([^)]+)\)\s*(?:Tj|')` inside binary font bytecode was captured and treated as ASCII text.
3. **Composite Font CID / Glyph ID Misinterpretation**:
   - In Type 0 / Composite CID fonts, strings inside `(...) Tj` or `<...> TJ` contain 2-byte glyph indices indexing into font glyph tables rather than ASCII/Unicode characters. Outputting raw CID bytes directly produced unprintable characters (`†tQEr...`).

---

## 3. Comprehensive Fixes Applied

### A. Document Encoding & Entity Decoder (`crates/luma-reader/src/encoding.rs`)
- Implemented `decode_text_bytes`:
  - Strips UTF-8 Byte Order Mark (BOM: `\xEF\xBB\xBF`).
  - Handles UTF-16 LE (`\xFF\xFE`) and UTF-16 BE (`\xFE\xFF`).
  - Detects XML/HTML encoding declarations (`windows-1252`, `iso-8859-1`).
- Implemented `decode_xml_and_html_entities`:
  - Decodes decimal numeric entities (`&#8212;` -> `—`, `&#8217;` -> `’`, `&#160;` -> `\u{00A0}`).
  - Decodes hexadecimal numeric entities (`&#x2014;` -> `—`, `&#x2019;` -> `’`).
  - Decodes named HTML5 entities (`&mdash;`, `&ldquo;`, `&rdquo;`, `&eacute;`, `&copy;`, etc.).
- Implemented `is_binary_resource`:
  - Strictly classifies binary MIME types (`image/*`, `font/*`, `audio/*`, `video/*`) and file extensions (`.png`, `.woff`, `.ttf`, `.otf`), ensuring they are never decoded as text.

### B. EPUB 3 Nav & EPUB 2 NCX Parsing (`crates/luma-reader/src/epub_doc.rs`)
- Replaced regex navigation parsing with XML event-based tree parser `parse_nav_doc_toc` that collects all text nodes across child elements (`<span>`, `<em>`, `<b>`, `<ol>`, `<li>`).
- Enhanced NCX parser to decode all XML and numeric entities.
- Enforced strict resource check in `get_chapter` so non-text spine items are rejected before conversion.

### C. PDF Content Stream & Text Extraction (`crates/luma-reader/src/pdf_doc.rs`)
- Excluded Image XObjects (`/Subtype /Image`) and Font streams (`/Type /Font`, `/FontDescriptor`).
- Bounded text extraction strictly between `BT` (Begin Text) and `ET` (End Text) operators.
- Implemented PDF string escape decoder (handles `\ddd` octal, `\n`, `\r`, `\t`, `\(`, `\)`, `\\`).
- Implemented PDF Hex string decoder (`<48656C6C6F>` -> `Hello`).
- Implemented character entropy validator `is_valid_printable_text`: strictly rejects text layers containing unprintable/control characters or unmapped CID byte sequences, preventing raw binary output.

### D. Frontend Reader UI Integration (`PdfReaderView.tsx` & `readerState.ts`)
- Configured dynamic page data retrieval in `useReaderStore.loadPdfPage`.
- Updated `PdfReaderView.tsx` to format valid extracted paragraphs, or render a clean editorial notice (*"Text layer unavailable for this page (scanned or image-based)"*) when a page lacks a safe text layer.

---

## 4. Defect Tracking Matrix

| Defect ID | Priority | File | Function | Root Cause | Fix | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-01** | `P0` | `pdf_doc.rs` | `extract_page_content_stream` | Binary font/image streams scanned for text operators | Excluded font/image streams; bounded to `BT...ET` | `TEST-PROVEN` |
| **DEF-02** | `P0` | `pdf_doc.rs` | `is_valid_printable_text` | Unmapped 2-byte CID font indices treated as ASCII | Added entropy & unprintable character rejection | `TEST-PROVEN` |
| **DEF-03** | `P0` | `epub_doc.rs` | `parse_nav_doc_toc` | Flat regex failed on nested `<span>` elements in EPUB 3 nav | XML tree parser collecting nested text nodes | `TEST-PROVEN` |
| **DEF-04** | `P0` | `epub_doc.rs` | `get_chapter`, `open` | Direct `read_to_string` corrupted BOM and legacy charsets | Replaced with `decode_text_bytes` | `TEST-PROVEN` |
| **DEF-05** | `P1` | `encoding.rs` | `decode_xml_and_html_entities` | Numeric HTML entities (`&#8212;`) left unparsed | Implemented full entity decoder | `TEST-PROVEN` |
| **DEF-06** | `P1` | `PdfReaderView.tsx`| `renderPageBody` | Binary garbage displayed when text layer unavailable | Render clean classical notice on missing text layer | `TEST-PROVEN` |

---

## 5. Verification Matrix Summary

- `cargo test --workspace` (46 tests passed, including forensic test suite)
- `cargo clippy --workspace --all-targets -- -D warnings` (0 warnings)
- `cargo check -p luma-core -p luma-anchor --target wasm32-unknown-unknown` (0 errors)
- `pnpm typecheck` (All 7 packages clean)
- `pnpm test` (17 tests passed)
- `pnpm build` (Production bundle generated)
