# LUMA READER RECOVERY — ROOT CAUSE MAP

## Architectural Failure Boundaries & System Dynamics

```
+------------------+       +-------------------+       +-----------------------+
|  User Selection  | ----> |  Normalized Range | ----> |  Persistent Anchor    |
| (window.getSel)  |       | (DOM / PDF quad)  |       | (Quote+Context/Quad)  |
+------------------+       +-------------------+       +-----------------------+
         |                           |                             |
         v                           v                             v
  Whitespace Collapsing       Multi-Node Spanning           DOM Node Mutation /
  (Newlines -> Spaces)       (<span> across tags)          Layout Recomputation
         |                           |                             |
         +---------------------------+-----------------------------+
                                     |
                                     v
                       +---------------------------+
                       | Highlighting & Search Hit |
                       | (Non-destructive mark /   |
                       |  absolute PDF overlay)    |
                       +---------------------------+
```

### Boundary 1: Selection -> Range (EPUB / HTML / TXT)
- **Problem**: User selections in Chromium/Webkit collapse sequential whitespace and newline sequences into single spaces in `selection.toString()`. The underlying DOM text nodes contain raw publisher formatting (tabs, indentation, carriage returns).
- **Consequence**: `fullText.indexOf(selectionText)` fails to find matches whenever selection spans line breaks or multiple indentation levels.
- **Root-Cause Architectural Resolution**:
  Construct a bidirectional mapping index between normalized character space and raw DOM text offsets. Highlight injection must traverse nodes using the normalized index map without corrupting sibling text node lengths.

### Boundary 2: Selection -> Coordinate Geometry (PDF Text Layer)
- **Problem**: PDF coordinate origin is bottom-left with affine transform matrices $(a, b, c, d, e, f)$. DOM coordinates are top-left with standard CSS pixel scaling. Previous implementations appended `" "` after each span indiscriminately, corrupting search and token boundaries.
- **Consequence**: Selection overlays were inverted, misaligned across zoom levels, or failed when text runs were broken into fine-grained glyph spans.
- **Root-Cause Architectural Resolution**:
  Use standard PDF.js `TextLayer` configured with `--scale-factor: viewport.scale`. Derive highlight bounding boxes directly from `span.offsetLeft/Top/Width/Height` or PDF QuadPoints, rendered via an absolute overlay layer synchronized with canvas dimension.

### Boundary 3: Anchor Payload -> Persistence & Rehydration
- **Problem**: Storing raw character indexes into volatile DOM trees causes silent anchoring breakage when CSS themes, font sizes, or chapter fragments shift.
- **Consequence**: Highlights disappeared or attached to random paragraphs on document re-open.
- **Root-Cause Architectural Resolution**:
  Anchors store `quote`, `prefix` (40 chars preceding), `suffix` (40 chars following), and `normalized_exact`. Rehydration performs robust context-disambiguated search rather than blind offset indexing.

### Boundary 4: Format Ownership & Typography Policy
- **Problem**: Typography drawer attempted to apply CSS font family, font size, and line height to PDF viewports where vector rendering is fixed.
- **Consequence**: Users perceived broken controls when clicking typography options in PDF mode.
- **Root-Cause Architectural Resolution**:
  Enforce explicit typography ownership: Reflowable formats (EPUB, TXT, MD, HTML) expose typeface, font size, margins, and line height; Fixed formats (PDF, CBZ) hide or disable typography controls and display an explanatory banner ("PDF documents have fixed typography").
