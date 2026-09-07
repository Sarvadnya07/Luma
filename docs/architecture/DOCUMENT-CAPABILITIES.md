# Document Capabilities Specification

## 1. Overview

Different digital document formats possess fundamentally different physical and semantic realities. Rather than forcing formats into artificial parity (e.g. attempting to reflow fixed PDF page layouts or pretending image-only CBZ manga has extractable plaintext), Luma explicitly declares document capabilities via `DocumentCapabilities`.

---

## 2. Capabilities Matrix

| Capability | Reflowable (EPUB, TXT, MD, HTML) | FixedLayout (PDF) | ImageSequence (CBZ, CBR) |
|---|:---:|:---:|:---:|
| `searchable` | ✅ Yes | ✅ Yes (with text layer) | ❌ No |
| `selectable` | ✅ Yes | ✅ Yes | ❌ No |
| `annotatable` | ✅ Yes | ✅ Yes | ✅ Yes (page geometry) |
| `reflowable` | ✅ Yes | ❌ No | ❌ No |
| `fixed_layout` | ❌ No | ✅ Yes | ✅ Yes |
| `image_sequence` | ❌ No | ❌ No | ✅ Yes |
| `extractable_text` | ✅ Yes | ✅ Yes | ❌ No |
| `has_geometry` | ❌ No | ✅ Yes (points/pt) | ✅ Yes (pixels/norm) |
| `has_resources` | ✅ Yes (images, fonts, css) | ✅ Yes | ✅ Yes (image pages) |
| `has_toc` | ✅ Yes | ✅ Yes | ❌ No (optional ComicInfo) |

---

## 3. Rust Representation

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentCapabilities {
    pub searchable: bool,
    pub selectable: bool,
    pub annotatable: bool,
    pub reflowable: bool,
    pub fixed_layout: bool,
    pub image_sequence: bool,
    pub extractable_text: bool,
    pub has_geometry: bool,
    pub has_resources: bool,
    pub has_toc: bool,
}
```

Every document engine declares its capabilities at open time. The user interface and secondary consumers (such as search indexing or AI reasoning) branch cleanly on these capabilities rather than failing at runtime.
