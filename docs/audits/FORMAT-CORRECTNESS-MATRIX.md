# LUMA FORMAT CORRECTNESS MATRIX — RUNTIME EVIDENCE

Date: 2026-09-19. Verification levels: **RP** = runtime-verified live this session; **T** = covered by repo test suite (prior verified sessions); **U** = unproven this session.

Per the master audit law: success of one format NEVER implies another. Each format is verified independently across its pipeline stages.

| Stage | EPUB | PDF | TXT | MD | HTML | CBZ |
|---|---|---|---|---|---|---|
| Import | RP (fixture imported at bridge boot via real ImportService) | RP (`import_file_bytes` live: hash→dedupe→persist) | T | T | T | T |
| Format detection | T (magic bytes, `test_extractors.rs`) | T + RP (served bytes start `%PDF`) | T | T | T | T |
| Metadata extraction | RP (title + author "Elena Vance" rendered from real EPUB) | T (title fallback to filename observed live — honest) | T | T | T | n/a |
| Cover extraction | RP (cover data URL drives card art) | T | n/a | n/a | n/a | T |
| File storage | RP (stored under library dir, real path) | RP (bytes read back = original `%PDF`) | T | T | T | T |
| Open | RP (`open_reader_document` live) | RP | T | T | T | T |
| Parsing/structure | RP (spine/chapter model live) | RP (page count, page geometry live) | T | T | T | T |
| Render | RP (chapter content rendered) | RP (canvas glyph pixels + text layer spans) | T (RDR-006 fixed) | T (RDR-006) | T (RDR-006) | T |
| Navigation | T (multi-chapter suite; single-chapter fixture live) | T (multi-page suite; 1-page fixture live, buttons honestly disabled) | T | T | T | T |
| Search | T (RDR-004) | RP (live match + snippet + page) | T | T | T | n/a |
| Selection | RP (trusted input → real Selection) | T (text-layer selection, RDR-002 fixed) | T | T | T | n/a |
| Highlight | RP (exact `<mark>`, computed bg) | T (viewport quads, RDR-003 fixed) | T | T | T | n/a |
| Annotation persistence | RP (close/reopen rehydrates) | T | T | T | T | T |
| Progress | RP round-trip | RP round-trip | T | T | T | T |
| Reopen after close | RP | RP | T | T | T | T |
| Error handling | RP (honest failure boundary) | RP (blank-page guard: scanned-page badge, RDR-008) | T | T | T | T |
| Scanned/no-text-layer | n/a | T (badge + canvas-only render guaranteed by design: text failure ≠ blank page) | n/a | n/a | n/a | n/a |

## Key invariants verified

- **PDF visual rendering does not depend on text extraction** (master prompt §16): canvas render path (`PDF_DOCUMENT_READY` → `PDF_CANVAS_READY`) and text layer are independent; the scanned-page badge (RDR-008) covers zero-text pages. This session's live fixture HAD a text layer; the no-text path remains suite-verified (T), not re-driven live (U for that specific sub-path).
- **No format is routed through the wrong pipeline** (§17): TXT/MD/HTML route to their dedicated readers (RDR-006 resolution, suite-verified); EPUB→`EpubReaderView`, PDF→`PdfReaderView` observed live.
- **Filename-derived titles are honest fallbacks, not fabricated metadata**: the imported PDF showed its filename-derived title because the fixture PDF has no title metadata — this is the documented honest behavior, not fake data.

## Unproven this session (honest)

- CBR (RAR archives): no fixture, no live run — remains **U** (dependency-light format, previously untested in the repo's own matrices).
- Live multi-page PDF page-turn and multi-chapter EPUB navigation were not re-driven with richer fixtures (fixtures on hand are 1-page/1-chapter); suite coverage stands.
