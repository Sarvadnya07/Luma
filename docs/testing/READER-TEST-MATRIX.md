# Luma — Reader Test Matrix

## 1. Test Scenarios & Execution Matrix

| Category | Test Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **EPUB** | Container & OPF parsing | Identifies rootfile, manifest, spine items in order | Passed |
| **EPUB** | Spine navigation | Previous/Next chapter loads correctly | Passed |
| **EPUB** | Table of Contents | Hierarchical tree with locators | Passed |
| **EPUB** | Footnote popovers | Opens popover on hash link click without scrolling | Passed |
| **EPUB** | In-document search | Returns case-insensitive matches with CFI locators | Passed |
| **PDF** | Page rendering | Correct page count and layout geometry | Passed |
| **PDF** | Outline extraction | Extracts PDF bookmarks/outlines | Passed |
| **PDF** | In-document search | Multi-page search with page locators | Passed |
| **Typography** | Font size changes (12-32px) | Reflows chapter text instantly | Passed |
| **Typography** | Theme changes | Dark, Light, Sepia, E-Ink palettes apply cleanly | Passed |
| **Annotation** | Text Selection Highlight | Creates highlight with color and persists to SQLite | Passed |
| **Annotation** | Add Note to highlight | Saves note body with reference to quote | Passed |
| **Annotation** | Reflow mutation tolerance | `luma-anchor` resolves anchor across reflow/whitespace | Passed |
| **Bookmark** | Add & Delete Bookmark | Saves format-aware locator, restores accurately | Passed |
| **Progress** | Reading Progress Resumption | Saves on chapter change, restores on book open | Passed |
| **Keyboard** | Shortcut navigation | Left/Right arrows, T (TOC), A (Ann), B (Bmk), Esc | Passed |
