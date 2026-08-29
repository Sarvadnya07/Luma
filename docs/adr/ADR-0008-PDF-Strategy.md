# ADR-0008: PDF Strategy
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Need crisp, high-DPI rendering and accurate text selection coordinate extraction for PDF documents.
- **Decision**: Adopt PDF.js with virtualized canvas rendering and transparent text layers, coupled with normalized bounding box coordinate math in `luma-anchor`.
- **Alternatives Considered**: MuPDF (license barrier: AGPLv3 incompatible with MIT), PDFium native FFI (heavy binary distribution).
- **Consequences**: Permissive Apache 2.0 license, seamless cross-platform canvas rendering, precise selection rects.
