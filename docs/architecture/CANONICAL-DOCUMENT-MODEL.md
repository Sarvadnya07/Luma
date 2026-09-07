# LUMA Canonical Document Model

## 1. Architectural Motivation

In earlier versions of Luma, the document pipeline was presentation-dominated. Readers extracted HTML or page strings solely for direct rendering into webview or DOM containers. Consequently, secondary features—such as deep search, contextual annotation, robust text anchoring, AI reasoning, citation generation, study card generation, and semantic exports—were forced to rely on DOM scraping or format-specific ad-hoc parsing.

The **Canonical Document Model** shifts the architecture from a presentation-only reader pipeline to a **structured domain model**:

```text
Imported Document (EPUB / PDF / CBZ / TXT / MD / HTML)
                          │
                          ▼
            luma-reader Document Engines
                          │
                          ▼
              CanonicalDocument (Domain)
              ├── DocumentIdentity & Metadata
              ├── DocumentStructure (Semantic Hierarchy)
              │   ├── Section Nodes
              │   ├── Heading Nodes
              │   ├── Paragraph Nodes
              │   ├── Blockquote / Code / List Nodes
              │   └── Image / Resource Nodes
              ├── DocumentRange & DocumentPosition
              └── Format Capabilities
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
   Reader View       AI Context      Search & Anchors
   (HTML/Canvas)    (Paragraphs)      (Citations)
```

The visual reader is now simply **one consumer** of the Canonical Document Model.

---

## 2. Core Domain Types (`luma-core::models::canonical`)

The canonical model is implemented in `luma-core` as a pure, dependency-free domain layer compilable to native and WebAssembly (`wasm32-unknown-unknown`).

### 2.1 Architectural Families

Every document format belongs to one of three architectural families:

```rust
pub enum DocumentFamily {
    Reflowable,     // EPUB, TXT, Markdown, HTML
    FixedLayout,    // PDF
    ImageSequence,  // CBZ, CBR
}
```

### 2.2 Semantic Hierarchy (`StructureNode` & `DocumentStructure`)

Documents are represented as hierarchical trees of semantic nodes with stable node IDs and precise document ranges:

```rust
pub enum NodeKind {
    Document,
    Section { index: usize, title: Option<String> },
    Heading { level: u8 },
    Paragraph { index: usize },
    List { ordered: bool },
    ListItem,
    Blockquote,
    Table,
    TableRow,
    TableCell,
    CodeBlock { language: Option<String> },
    Image { resource_id: String, alt: Option<String>, dimensions: Option<(u32, u32)> },
    Footnote { id: String },
    Link { href: String },
    PageBreak { page_number: u32 },
}

pub struct StructureNode {
    pub id: String,
    pub kind: NodeKind,
    pub text: Option<String>,
    pub children: Vec<StructureNode>,
    pub range: Option<DocumentRange>,
}
```

---

## 3. Query Capabilities

The model provides instant answers to structural questions without presentation coupling:

- **"Give me the text of paragraph 12"**: `doc.get_paragraph(section, 12)`
- **"Give me all headings"**: `doc.get_headings()`
- **"Give me every image and its location"**: `doc.get_resources()` or `structure.get_images()`
- **"Give me the exact source range for this selection"**: `doc.get_range_text(&range)`
- **"Give me a scholarly citation"**: `doc.get_citation_context(&range, metadata)`
- **"Search structured text"**: `doc.search_canonical(query)`
