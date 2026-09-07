# LUMA READER RECOVERY — ARCHITECTURE DECISIONS

### ADR-RDR-01: Canonical Bidirectional Text Mapping for Reflowable Documents
- **Context**: Browsers normalize consecutive whitespace characters into a single space when `Selection.toString()` is invoked. When querying raw DOM nodes in EPUB/HTML/TXT, publisher newlines and tabs fail string equality checks.
- **Decision**: Introduce a non-destructive tokenizer that creates a mapping index:
  $\text{normalized\_char\_index} \leftrightarrow (\text{DOM TextNode}, \text{node\_offset})$.
  Highlighting operates by projecting ranges across this normalized index into standard `<mark className="luma-highlight">` tags without altering the surrounding element hierarchy.

### ADR-RDR-02: PDF Coordinate Authority & Overlay Architecture
- **Context**: Direct DOM-based `<mark>` injection inside PDF.js `TextLayer` breaks PDF.js font glyph spacing and character positioning transforms.
- **Decision**: Keep the PDF.js `TextLayer` strictly for browser text selection and accessibility. Render all visual highlights (persistent annotations and search hits) on an independent, non-interactive overlay layer positioned directly above the canvas and below the selection layer, sized in exact CSS pixels:
  $$\text{CSS Pixel Rect} = \text{PDF Rect} \times \text{Viewport Scale}$$

### ADR-RDR-03: Typography Ownership Matrix
- **Context**: Reflowable documents support dynamic font swapping, line height, and margin changes. Fixed-layout PDFs and comic archives (CBZ) do not support font mutation without visual destruction.
- **Decision**: Restrict typography modifications to reflowable reader views. When a fixed-layout document is active, the typography drawer renders an informational notice explaining that typography is document-governed, while retaining zoom, layout (dual/single spread), and theme inversion controls.
