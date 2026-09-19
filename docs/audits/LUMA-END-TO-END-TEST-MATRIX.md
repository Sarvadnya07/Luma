# LUMA END-TO-END TEST MATRIX — RUNTIME EVIDENCE

Date: 2026-09-19. Evidence levels: **RP** = RUNTIME-PROVEN this session (live); **IT** = INTEGRATION-TESTED (live backend probe this session); **T** = covered by repo test suite (verified in this or prior session); **U** = UNPROVEN this session.

| Feature | Format | Happy Path | Empty State | Error State | Persistence | Restart | Resize/Reflow | Typography | Search | Selection | Highlight | Concurrency | Security | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Library list | any | RP (real DB rows rendered) | RP (honest empty/error states observed) | RP (transport-down → Retry, no fake data) | T | T | T | n/a | RP (search box live) | n/a | n/a | T | T | Live UI + probes | PASS |
| Import | EPUB | RP (fixture via ImportService at boot) | n/a | T (corrupt/malformed in backend suite) | RP (rows + file on disk) | T | n/a | n/a | T | n/a | n/a | T | T (path sanitizers) | Live + suite | PASS |
| Import | PDF | RP (`import_file_bytes` → success, visible in All Books) | n/a | T | RP | T | n/a | n/a | T | n/a | n/a | T | T | Live + suite | PASS |
| Duplicate detection | any | RP (`exact_duplicate` on re-import) | n/a | n/a | T | T | n/a | n/a | n/a | n/a | n/a | T | T | Live probe | PASS |
| Open book | EPUB | RP (real chapter rendered from parsed EPUB) | n/a | RP (crash → "stopped responding" boundary) | T | T | T | n/a | n/a | n/a | n/a | U (no live A/B race test) | T | Live UI | PASS |
| Open book | PDF | RP (bytes → PDF.js → canvas painted) | n/a | RP (honest warn + error state) | T | T | T | n/a (PDF immutable) | n/a | n/a | n/a | U | T | Live UI | PASS |
| Render content | EPUB | RP (chapter text from engine, sanitized) | n/a | RP | n/a | n/a | T | RP (font 18→24 computed style changed) | n/a | n/a | n/a | n/a | RP (sanitizer allowlist, suite) | Live UI | PASS |
| Render content | PDF | RP (glyph pixels on canvas, text layer spans present) | n/a | RP | n/a | n/a | n/a | n/a (immutable, drawer disabled) | n/a | RP (text layer spans) | n/a | n/a | T | Live pixel scan | PASS |
| Selection | EPUB | RP (trusted dblclick → real Selection; synthetic events correctly rejected) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | RP | n/a | n/a | n/a | Trusted-input evidence | PASS |
| Highlight | EPUB | RP (mark rendered on exact word, computed bg verified) | n/a | n/a | RP (survives close/reopen) | T (backend SQLite) | RP (survives reflow) | RP (survives font change) | n/a | n/a | RP | n/a | n/a | Live UI | PASS |
| Annotations CRUD | any | RP (save via UI, listed via backend) | RP (empty list) | T | RP | T | n/a | n/a | n/a | n/a | RP | n/a | T | Live + suite | PASS |
| Bookmarks | any | IT (create/list/delete commands live) | RP (empty) | T | T | T | n/a | n/a | n/a | n/a | n/a | n/a | T | Live probe | PASS |
| Reading progress | any | IT (save/get round-trip 0.5→0.5) | RP (null before first read) | T | RP | T | n/a | n/a | n/a | n/a | n/a | T | T | Live probe | PASS |
| Reading sessions | any | IT (start/complete live) | n/a | T | T | T | n/a | n/a | n/a | n/a | n/a | T | T | Live probe | PASS |
| Search (in-document) | PDF | IT (real match + snippet + page) | IT (empty for no-match) | T | n/a | n/a | n/a | n/a | IT | n/a | n/a | n/a | T | Live probe | PASS (nav-to-match: U this session) |
| Search (in-document) | EPUB | T (reader-recovery suite RDR-004) | T | T | n/a | n/a | n/a | n/a | T | n/a | n/a | n/a | T | Suite | PARTIAL (not re-run live) |
| Search navigation | EPUB | T (prior session) | n/a | n/a | n/a | n/a | T | n/a | T | n/a | n/a | n/a | T | Prior session | PARTIAL |
| Typography controls | EPUB | RP (computed style verified) | n/a | n/a | T | T | RP (reflow) | RP | n/a | n/a | RP (survives) | n/a | n/a | Live UI | PASS |
| Collections/Tags/Authors/Series | any | RP (real author from EPUB metadata listed) | RP (empty lists honest) | T | T | T | n/a | n/a | n/a | n/a | n/a | n/a | T | Live probe | PASS |
| Delete/Restore/Reimport | any | T (backend suite) | T | T | T | T | n/a | n/a | n/a | n/a | n/a | n/a | T | Suite | PARTIAL (not re-run live) |
| Async race safety | any | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | U (latent risk in readerState) | n/a | Static inspect | UNPROVEN |
| Desktop shell (tauri dev) | any | T (prior sessions) | n/a | n/a | T | T | n/a | n/a | n/a | T (prior session artifacts) | T (prior artifacts) | n/a | T | Prior artifacts | PARTIAL (not re-verified this session) |

## Notes

- "RP (trusted input)" for Selection: evidence captured via CDP-driven trusted dblclick with a pre-armed `selectionchange` recorder; synthetic `dispatchEvent` selections were verified to NOT trigger the chain (anti-false-positive).
- Persistence "T" entries rely on the backend SQLite test suite (`test_backend_remediation.rs`, `test_runtime_acceptance_matrix.rs`) — storage truth is suite-verified; UI rehydration was live-verified for highlights and progress.
- The single substantive UNPROVEN item is **async race safety** in `readerState.ts` (no stale-response guard on `openBook`/`loadChapter`/`loadPdfPage`). Recommend a request-token guard as the next P1 fix.
