# Rendering Pipeline & Zero-Disk Invariant

## 1. Architectural Philosophy: Rendering is ONE Consumer

In traditional monolithic reader applications, document parsing is tightly coupled to viewport rendering. The engine parses only what is needed to paint pixels, discarding semantic structures, range metadata, and document hierarchies.

In Luma's canonical architecture, **Rendering is merely ONE consumer** of the Canonical Document Model, alongside:
- Search Indexing & In-Document Querying
- Range-Based Selection & Highlight Anchoring
- AI Context Ingestion & Summarization
- Scholarly Citation & Quotation Generation
- Flashcard & Study Deck Generation
- Semantic Note Linking
- Format Export & Archival

```
                     ┌────────────────────────┐
                     │    Source Document     │
                     └───────────┬────────────┘
                                 │ Parser / Engine
                                 ▼
                     ┌────────────────────────┐
                     │ CanonicalDocumentModel │
                     │  (Structure, Offsets,  │
                     │   Nodes, Resources)    │
                     └───────────┬────────────┘
         ┌───────────────┬───────┴───────┬───────────────┐
         ▼               ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ Rendering │   │  Search   │   │Anchoring /│   │AI Context/│
   │ Pipeline  │   │  Engine   │   │Annotations│   │ Citations │
   └───────────┘   └───────────┘   └───────────┘   └───────────┘
```

---

## 2. Zero-Disk Render Invariant

**Absolute Guarantee**: The Luma document engine, reader backend, and frontend never dump rendered page images (e.g. `*_rendered.png`, `page_*.jpg`, canvas screenshots) to the filesystem or repository tree.

### Enforced Rules:
1. **In-Memory Bitmaps**: PDF pages are rendered directly to HTML5 Canvas via `pdfjs-dist` workers within browser memory. Canvas pixel buffers are managed by WebGL/2D canvas contexts and garbage-collected when views unmount.
2. **On-the-Fly Archive Extraction**: Comic archives (CBZ) stream image bytes on-demand from the zip container into memory. Images are transferred across Tauri IPC as byte buffers or served through secure memory asset streaming. No intermediate extraction directory is written to disk.
3. **Reflowable Webview Sanitization**: EPUB, Markdown, Plaintext, and HTML documents are parsed into semantic HTML trees, sanitized via `luma_security` (ammonia/DOMPurify), and injected directly into DOM containers without saving intermediate HTML files.
4. **Isolated Cover Store**: The only image files written to disk are persistent book covers extracted during initial library ingestion, stored securely under `<app_data>/covers/<sha256>.<ext>` and tracked in SQLite (`cover_images` table).

---

## 3. Format-Specific Rendering Pipelines

### A. Fixed Layout: PDF Pipeline
```
[File on Disk] 
       │ (Lazy read via memory-map / chunk)
       ▼
[PdfDocument Engine (Rust)] 
       │ Structure extraction & text-layer bounding boxes
       ▼
[Frontend: PdfReaderView.tsx]
       │ Transfer ArrayBuffer to Web Worker
       ▼
[PDF.js Worker] 
       │ Decode display list & vector glyphs in-memory
       ▼
[HTML5 Canvas (PdfPageCanvas.tsx)]
       │ Render pixels to Canvas 2D Context
       ▼
[Viewport Display] (Zero disk footprint)
```

### B. Image Sequence: CBZ Pipeline
```
[CBZ Zip Archive]
       │
       ▼
[CbzDocument (Rust)]
       │ Natural numeric sort: natural_cmp("page_1.png", "page_10.png")
       │ Read entry into in-memory Vec<u8>
       ▼
[Tauri IPC: read_document_resource]
       │ Transferred as ArrayBuffer
       ▼
[Frontend: Blob URL / Object URL]
       │ In-memory image element: <img src="blob:..." />
       ▼
[Viewport Display] (Zero disk footprint)
```

### C. Reflowable: EPUB, TXT, Markdown, HTML Pipeline
```
[Source File]
       │
       ▼
[Format Engine (EpubDoc / TextDoc / MarkdownDoc / HtmlDoc)]
       │ Semantic node tree generation: StructureNode, NodeKind, Range
       │ HTML generation with stable paragraph locators: id="p0", id="p1"
       ▼
[luma_security: HTML Sanitizer]
       │ Strip scripts, unsafe attributes, malformed tags
       ▼
[Tauri IPC: get_chapter / get_document_structure]
       │ Transferred as JSON / HTML payload
       ▼
[Frontend Reflowable Viewport]
       │ Direct DOM mounting inside styled container
       ▼
[Viewport Display] (Zero disk footprint)
```
