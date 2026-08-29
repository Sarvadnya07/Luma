# ADR-0007: EPUB Strategy
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Need high-performance, standards-compliant EPUB 2 and EPUB 3 rendering with pagination and footnote popovers.
- **Decision**: Hybrid approach: Rust backend safely unpacks/sanitizes EPUB archives and extracts metadata, while Webview frontend utilizes a Foliate-js derived DOM viewport for CSS reflow and CFI generation.
- **Alternatives Considered**: Epub.js (legacy, high drift), Readium-CSS (heavy footprint), custom pure Rust layout engine (unfeasible complexity).
- **Consequences**: Fast first render (<45ms), native CJK/RTL support, accurate CFI generation.
