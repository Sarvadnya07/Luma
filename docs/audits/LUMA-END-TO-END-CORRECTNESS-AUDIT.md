# LUMA END-TO-END CORRECTNESS AUDIT — RUNTIME-VERIFIED

Date: 2026-09-19
Method: live runtime verification against the real application (browser preview + real Rust backend via `browser_reader_bridge`), plus static inspection. Every status below carries exactly one evidence level. Nothing is marked PASS without runtime evidence from THIS audit session.

## Executive status

The P0 blocking defect class found in THIS session: **the browser bridge (`browser_reader_bridge`) exposed only a subset of the desktop IPC surface**, so in the browser harness every read-side reader command (`get_reader_pdf_page`, `get_book_file_bytes`, `search_document`, annotation/bookmark/progress/session commands, collections/tags/authors/series) failed with `unsupported browser bridge command`. The UI rendered honest error states (never fake data — the DYNAMIC-DATA-01 contract held), but the reader was unusable: PDF stuck on "Rendering Page N..." forever, search/annotations/progress dead.

Additionally, a **WebView2/Chromium-version defect** was found: `pdfjs-dist` v6 requires ES2025 `TypedArray.prototype.toHex/toBase64` and `Map.prototype.getOrInsertComputed`, which Chromium < 140 lacks; PDF rendering died with `hashOriginal.toHex is not a function` / `getOrInsertComputed is not a function` even when the backend served correct bytes.

Both defect classes are FIXED in this session and runtime-verified (see §Runtime verification).

## Defect registry (this session)

| ID | Severity | Symptom | First failing boundary | Root cause | Fix | Evidence | Status |
|---|---|---|---|---|---|---|---|
| E2E-001 | P0 | PDF open → permanent "Rendering Page N..." | UI → transport (`get_reader_pdf_page`) | Bridge did not implement the command | Implemented in bridge over real `ReaderService.get_pdf_page` | Live probe returns `page_number/width_pt/height_pt/text_content/has_text_layer`; canvas painted | **RUNTIME-VERIFIED** |
| E2E-002 | P0 | PDF.js worker fails `hashOriginal.toHex is not a function` | PDF.js worker realm | pdf.js v6 uses ES2025 TypedArray methods; Chromium 130 lacks them | `pdfTypedArrayPolyfill.ts` + `pdfWorkerEntry.ts` (worker-realm polyfill before stock worker) | `LUMA_PERF_PDF_DOCUMENT_READY` + `LUMA_PERF_PDF_CANVAS_READY` fire; glyph pixels measured on canvas | **RUNTIME-VERIFIED** |
| E2E-003 | P0 | PDF.js main thread fails `getOrInsertComputed is not a function` | Main thread render call | Same ES2025 gap, `Map` upsert methods | Same polyfill module, main-thread import | Render completes, canvas content bbox computed | **RUNTIME-VERIFIED** |
| E2E-004 | P1 | Library metadata load errors (500s) on `list_collections/tags/authors/series` | UI → transport | Bridge had removed the stub block when real commands were added; commands were then missing entirely | Implemented over real `CollectionService` (previously honest-empty stubs; now real data) | `list_authors` returns 1 real author (Elena Vance) from EPUB metadata | **RUNTIME-VERIFIED** |
| E2E-005 | P1 | Annotations/bookmarks/progress/sessions/search unsupported in bridge | UI → transport | Bridge implemented only library+reader-open+chapter | All implemented over the real services (AnnotationService, BookmarkService, ReadingProgressService, ReadingSessionRepository) | save/get progress round-trip 0.5 → 0.5; annotation saved through UI visible in backend | **RUNTIME-VERIFIED** |
| E2E-006 | P2 | Import of bytes-lacking bridge port broke on restart (session-bound ephemeral port) | Infra | Bridge bound port 0; frontend `.env.local` pointed at stale port | `LUMA_BROWSER_BRIDGE_PORT` env pinning (default still ephemeral) | Bridge restart on fixed port 4407; frontend reconnects without changes | **RUNTIME-VERIFIED** |

## Runtime verification (this session, all live)

1. **Library real data**: home renders "• 1 publications" from the real SQLite DB (fixture EPUB imported by the bridge at boot via the real `ImportService`). Author "Elena Vance" comes from real EPUB metadata (`list_authors` after E2E-004 fix). Evidence level: **BROWSER-PRODUCTION-CODE-TESTED**.
2. **Import (PDF)**: `import_file_bytes` through real `ImportService.import_files` — staging, hash, duplicate assessment, transactional persistence. `golden_path.pdf` → `status: success`, real book_id. UI-visible in All Books ("2 items"). Evidence level: **END-TO-END-VERIFIED** (backend via bridge + visible in real UI).
3. **Import (duplicate rejection)**: identical re-import returns `exact_duplicate` assessment. Evidence level: **INTEGRATION-TESTED** (live bridge probe).
4. **Book open (EPUB)**: click card → `open_reader_document` → `get_reader_chapter` → real chapter "Chapter 1: The Principle of Architecture" with real content text from the parsed EPUB. Evidence level: **BROWSER-PRODUCTION-CODE-TESTED**.
5. **Real selection (P0.7)**: CDP-trusted dblclick produced a real browser Selection (evidence: `selectionchange` events with timestamp, `rangeCount: 1`, non-collapsed, text "systems "). Synthetic JS events were also tried first and correctly did NOT create a selection (anti-false-positive check). Evidence level: **BROWSER-TESTED (trusted input)**.
6. **Highlight creation + rendering (P0.8)**: toolbar click → annotation saved (`#FDE68A`, quote "systems ") → `<mark>` rendered with computed `rgba(253, 230, 138, 0.333)` exactly on the selected word. Evidence level: **BROWSER-PRODUCTION-CODE-TESTED** + computed-style verification.
7. **Highlight persistence (P0.9)**: close reader → reopen → `<mark>` rehydrated in the same DOM position inside the paragraph. Evidence level: **PERSISTENCE-VERIFIED** (within session; app-restart persistence covered by backend SQLite storage and existing test suite).
8. **Typography (P0.11)**: font size slider 18 → 24 changed computed style `font-size: 18px → 24px`, `line-height: 30.6px → 40.8px` on the rendered paragraph; the highlight survived the reflow. Evidence level: **BROWSER-PRODUCTION-CODE-TESTED** (computed-style measured, not state-inspected).
9. **PDF render (P0.5)**: canvas painted real glyphs (content bbox [98,82]–[232,90]; non-white pixel scan confirms glyph pixels), text layer extracted "System Design Handbook" (real text extraction), page chrome reports "Page 1 of 1", render transition complete. Evidence level: **BROWSER-PRODUCTION-CODE-TESTED** (pixel + text-layer verification). *Not VISUALLY-VERIFIED via screenshot in this session — the harness screenshot channel was unavailable; pixel-scan evidence stands in.*
10. **In-document search (P0.10)**: `search_document` through real ReaderService returns the real match with snippet "…System Design Handbook…" on the correct page. Navigation-to-match in the EPUB reader was verified earlier by the repo's own reader-recovery suite (RDR-004); not re-verified in this session. Evidence level: **INTEGRATION-TESTED** (search backend live) / navigation **UNPROVEN this session**.
11. **Reading progress**: save/get round-trip through real `ReadingProgressService` (0.5 persisted and returned). UI-driven progress save covered by debounced writer; verified live earlier in session via bridge probes. Evidence level: **INTEGRATION-TESTED**.
12. **Honest failure states**: with transport unavailable the UI shows "Failed to load library data / Retry" (no fake data). Reader crash shows "This document view stopped responding" with Retry/Return (verified when the vite import error triggered ErrorBoundary). Evidence level: **BROWSER-TESTED**.

## Anti-false-positive checks run

- Synthetic (untrusted) pointer events did **not** create a Selection — only trusted CDP input did. The selection→highlight chain is not programmatically forgeable from page JS.
- No mock/demo data observed anywhere in the runtime: with the bridge dead the app showed error states, not sample content.
- Strict text compare ("systems " vs "systems") initially flagged highlight loss after reflow; recomputed with exact quote including trailing space — highlight was present. Lesson recorded: compare with the exact persisted quote.

## Remaining gaps / UNPROVEN items (honest)

1. **Tauri desktop runtime (WebView2 production shell)**: this session verified the browser harness (Vite + real Rust bridge). The same UI in the shipped `tauri dev` shell was exercised in prior repo audits, but NOT re-verified in this session. Status: **UNPROVEN this session** (bridge and Tauri commands share the same service layer; risk is confined to the Tauri IPC shell itself).
2. **Screenshot artifacts**: the preview compositor was unavailable intermittently; visual screenshots were replaced by computed-style/pixel-scan verification. `docs/reader-recovery/runtime-artifacts/` artifacts from previous sessions remain valid for their own sessions.
3. **PDF page-turn with multi-page documents**: the fixture has 1 page; navigation buttons disabled correctly (honest state). Multi-page turn verified by repo test suite, not re-run live here.
4. **Delete/reimport/restart-recovery matrix**: covered by backend test suite (`test_backend_remediation.rs` etc.); not re-driven live in this session.
5. **Race-condition concurrency golden path (open A → open B)**: `readerState.ts` has no explicit stale-response guard (actions await and set unconditionally). No live corruption was observed, but the code carries a theoretical race window. Status: **UNPROVEN / latent risk** — recommend request-token guard as follow-up work.

## Files changed (this session)

- `apps/desktop/src-tauri/src/bin/browser_reader_bridge.rs` — added 15 missing commands backed by the real services; pinned port support.
- `apps/desktop/src/features/reader/pdfTypedArrayPolyfill.ts` — NEW: ES2025 TypedArray + Map upsert polyfills.
- `apps/desktop/src/features/reader/pdfWorkerEntry.ts` — NEW: worker-realm polyfill entry before stock pdf.worker.
- `apps/desktop/src/features/reader/pdfWorker.ts` — wire polyfill + custom worker entry.
- `apps/desktop/.env.local` (untracked, gitignored) — bridge URL pinning for the browser preview.

## Status summary

- P0 import→store→display→open→render→select→highlight→persist→typography: **PASS (browser harness, runtime-verified)** with evidence per section above.
- PDF read path: **PASS (browser harness, runtime-verified)** after E2E-001/002/003.
- Search backend + EPUB navigation: **PARTIAL** (backend verified; navigation relies on prior-session verification).
- Tauri desktop shell: **UNPROVEN this session** (unchanged since last session's verification).
- Concurrency/races: **UNPROVEN / latent risk documented**.
