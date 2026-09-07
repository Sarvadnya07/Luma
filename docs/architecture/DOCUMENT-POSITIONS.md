# Document Positions & Anchoring Specification

## 1. Unified Position Model

In digital reading systems, locations must be recorded in ways that remain resilient across window resizing, font changes, reader theme modifications, and format differences.

`DocumentPosition` is the format-neutral location primitive:

```rust
pub struct DocumentPosition {
    /// Spine or section index (0-indexed).
    pub section_index: usize,
    /// Identifier of the structured semantic node (e.g. "p12", "heading-3").
    pub node_id: Option<String>,
    /// UTF-8 Unicode character offset within section or node.
    pub char_offset: usize,
    /// Absolute page number if applicable (1-indexed for PDF/Comics).
    pub page_number: Option<u32>,
    /// Bounding box geometry if applicable (e.g. PDF text span or image region).
    pub geometry: Option<BoundingBox>,
    /// Format-specific native locator string (e.g. EPUB CFI, XPath, or offset).
    pub locator: Option<String>,
}
```

---

## 2. Document Ranges

A `DocumentRange` defines a contiguous span between two `DocumentPosition`s:

```rust
pub struct DocumentRange {
    pub start: DocumentPosition,
    pub end: DocumentPosition,
    pub text_snippet: Option<String>,
}
```

### 2.1 Format-Specific Encodings

1. **EPUB**:
   - `section_index`: Spine index
   - `locator`: Canonical EPUB Canonical Fragment Identifier (`epubcfi(/6/2!/4/10:0)`)
   - `node_id`: Target DOM or semantic node ID (`h-0-1`, `p-0-4`)
2. **Plaintext / Markdown / HTML**:
   - `section_index`: 0 (or section index)
   - `char_offset`: Unicode scalar offset in UTF-8 buffer
   - `node_id`: Paragraph ID (`p0`, `p1`, `p2`)
3. **PDF**:
   - `page_number`: 1-indexed page
   - `geometry`: `BoundingBox { x, y, width, height }` in PDF points
   - `locator`: `page=N`
4. **CBZ / CBR**:
   - `page_number`: 1-indexed image page
   - `locator`: `page=N`
   - `geometry`: Optional normalized coordinates `[0.0, 1.0]` for image annotations
