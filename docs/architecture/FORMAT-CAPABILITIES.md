# Format Capabilities Matrix

This document provides the canonical matrix of document capabilities supported by Luma's document engines across all supported formats.

## 1. Primary Format Capabilities

| Capability | EPUB | PDF | CBZ | TXT | Markdown | HTML |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Family** | Reflowable | FixedLayout | ImageSequence | Reflowable | Reflowable | Reflowable |
| **Reading Viewport** | Yes | Yes | Yes | Yes | Yes | Yes |
| **Extractable Text** | Yes | Yes (Text Layer) | No | Yes | Yes | Yes |
| **Searchable** | Yes | Yes | Metadata only | Yes | Yes | Yes |
| **Structural Outline / TOC** | Yes (NCX/Nav) | Yes (Outlines) | Yes (ComicInfo/Pages) | Yes (Heuristic) | Yes (Headings) | Yes (H1-H6) |
| **Geometric Bounding Boxes** | No | Yes | Yes (Page) | No | No | No |
| **Paragraph Splitting** | Yes | Yes | No | Yes | Yes | Yes |
| **Range Slicing** | Yes | Yes | No | Yes | Yes | Yes |
| **Academic Citations** | Yes | Yes | Metadata only | Yes | Yes | Yes |
| **Embedded Resources** | Yes (Images/CSS) | Yes (Images/Fonts) | Yes (Images) | No | No | Yes (Images) |
| **Annotation Anchoring** | Exact Range | Bounding Box | Page Coordinates | Char Range | Heading / Char Range | Element / Char Range |
| **AI Context Extraction** | Yes | Yes | Metadata only | Yes | Yes | Yes |

---

## 2. Capability Queries at Runtime

Each document opened via `CanonicalDocument::open` provides a `DocumentCapabilities` record queryable via `doc.capabilities()`:

```rust
pub struct DocumentCapabilities {
    pub reflowable: bool,
    pub fixed_layout: bool,
    pub image_sequence: bool,
    pub extractable_text: bool,
    pub searchable: bool,
    pub selectable_text: bool,
    pub annotatable: bool,
    pub supports_citations: bool,
    pub supports_ai_context: bool,
    pub supports_bookmarks: bool,
    pub supports_thumbnails: bool,
    pub supports_embedded_resources: bool,
}
```

Frontend consumers inspect these capabilities dynamically to enable or disable UI features (e.g., hiding text selection tools when viewing pure image sequences or disabling page layout toggles on reflowable documents).
