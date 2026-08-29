# ADR-0016: EPUB Rendering and Spine Navigation Architecture

## Status
Accepted

## Context
EPUB publications consist of discrete XHTML documents arranged according to an OPF `<spine>`. Mutating the original files to apply user styles breaks data integrity and hash verification.

## Decision
1. `luma-reader` unpacks the EPUB package, extracts spine itemrefs in reading order, and strips dangerous `<script>` elements.
2. The UI applies typography settings (font family, font size, line spacing, margins, themes) dynamically via a non-destructive presentation layer.

## Consequences
- Clean, security-hardened document rendering without mutating disk files.
- Smooth chapter-by-chapter and continuous scroll reading.
