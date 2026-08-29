# Luma — PDF Reading Engine

## 1. Architecture & Rendering

```text
[PDF Document File]
       ↓
1. Safe Binary Validation
       ↓
2. Page Count & Outline/Bookmarks Tree Extraction
       ↓
3. High-DPI Canvas Rendering (zoom scale 50% to 200%)
       ↓
4. Transparent Selectable Text Layer (Absolute Bounding Rects)
       ↓
5. Normalized Coordinate Mapping [0.0..1.0]
       ↓
6. In-Document Page Search with snippet previews
```

---

## 2. Text Selection & Geometric Annotations
- Coordinates are stored as normalized bounding rects $\hat{x}, \hat{y}, \hat{w}, \hat{h} \in [0.0, 1.0]$.
- Combined with `TextQuoteAnchor` for exact text quote validation and disambiguation.
