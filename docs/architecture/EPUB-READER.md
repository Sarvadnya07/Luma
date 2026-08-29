# Luma — EPUB Reading Engine

## 1. Pipeline & Spine Reading Order

```text
[EPUB Archive File]
       ↓
1. Safe Unpack & Validation (luma-security path checks)
       ↓
2. Locate META-INF/container.xml → Resolve OPF Package Path
       ↓
3. Parse Dublin Core Metadata, Manifest items, Spine itemrefs
       ↓
4. Parse Table of Contents (EPUB 3 nav.xhtml or EPUB 2 toc.ncx)
       ↓
5. Chapter XHTML Loader (Sanitize HTML, strip script/object)
       ↓
6. Presentation Layer: Inject user typography (fontSize, lineHeight, fontFamily, theme)
       ↓
7. Footnote Popover Resolver (Preview target on anchor click without scrolling)
       ↓
8. In-Document Full-Text Search across spine items
```

---

## 2. Invariants & Security
- Raw `<script>` tags are removed via `sanitize_untrusted_html`.
- Internal chapter references use sanitized relative paths.
- External URLs are opened safely via default system browser without exposing internal Webview privileges.
