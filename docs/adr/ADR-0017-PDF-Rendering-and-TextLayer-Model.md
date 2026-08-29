# ADR-0017: PDF Rendering and Text Layer Coordinate Model

## Status
Accepted

## Context
PDF documents contain fixed page geometry. High-DPI screens and zoom interactions require coordinate calculations that do not drift when scale changes.

## Decision
We adopt high-DPI canvas rendering paired with an aligned transparent DOM text layer. Highlight bounding geometry is stored as normalized page coordinates ($\hat{x}, \hat{y}, \hat{w}, \hat{h} \in [0.0, 1.0]$) alongside the text quote and context prefix/suffix.

## Consequences
- Accurate text selection and highlight rendering across zoom factors and screen resolutions.
