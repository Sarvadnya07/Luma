# LUMA READER RECOVERY — KNOWN LIMITATIONS

1. **Scanned / OCR-Less Documents**:
   - PDFs containing purely raster images without an embedded OCR text layer cannot support native text selection or character-based highlights without optical character recognition (OCR).
   - In Luma, these pages are identified by `textContent.items.length === 0` and display a clear badge: *"Scanned Page (No Text Layer)"*. Visual canvas rendering remains fully functional.

2. **Complex DRM & Encrypted Files**:
   - Files with active Adobe DRM or proprietary encryption cannot be parsed locally without external decryption keys. Luma flags them during import as unsupported format rather than failing silently.

3. **Multi-Column Fluid Flow Across Screen Boundaries**:
   - Reflowable EPUB multi-column pagination relies on CSS column rules. When switching between single and dual column mode, active selection ranges clear to prevent DOM layout oscillation.
