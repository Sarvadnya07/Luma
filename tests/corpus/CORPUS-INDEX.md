# Luma — Test Corpus Index

This directory catalog contains synthetic test fixtures, open-access public domain test documents, and structural edge cases used for validating Luma's parsing, rendering, and annotation integrity.

---

## 1. Corpus Catalog

| File ID | Name / Description | Format | Features Tested | Redistribution License |
| :--- | :--- | :--- | :--- | :--- |
| `fixture-01-basic` | Standard EPUB 3 | EPUB | Multi-chapter, basic CSS, TOC | Creative Commons CC0 / Synthetic |
| `fixture-02-reflow` | Heavy Typography Reflow | EPUB | Extreme font shifts, drop caps, dense markup | CC0 / Synthetic |
| `fixture-03-footnotes` | Semantic Footnotes | EPUB | Popover footnotes, epub:type, back-links | CC0 / Synthetic |
| `fixture-04-cjk` | Multilingual CJK & RTL | EPUB | Vertical Japanese, Arabic RTL, ruby tags | CC0 / Synthetic |
| `fixture-05-vector-pdf` | Multi-Column Scientific Paper | PDF | 2-column layout, vector charts, math formulas | CC-BY 4.0 / ArXiv Open Access |
| `fixture-06-scanned-pdf` | Scanned Image PDF | PDF | Full-page bitmaps, OCR layer alignment | CC0 / Public Domain |
| `fixture-07-malformed` | Corrupted / Truncated Archive | EPUB | Broken container.xml, missing spine items | Synthetic Test Artifact |
| `fixture-08-zipbomb` | Decompression Bomb | EPUB | High expansion ratio archive (security test) | Synthetic Test Artifact |

---

## 2. Synthetic Test Fixtures

All fixtures in `tests/fixtures/` are generated synthetically or derived from public domain sources to ensure zero copyright restrictions and 100% reproducible test runs in CI/CD environments.
