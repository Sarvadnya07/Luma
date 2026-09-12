# Luma Reader Runtime Map

## Scope

This document maps the existing production EPUB reader execution path. It does not modify the reader, introduce a transport adapter, or claim browser/runtime acceptance.

## 1. Frontend entry point

- `apps/desktop/index.html` mounts `<div id="root">` and loads `/src/main.tsx`.
- `apps/desktop/src/main.tsx` imports the application stylesheet and renders `<App />` with React.
- `apps/desktop/src/app/App.tsx` selects the library or reader view from the reader store's `currentBook` state.

## 2. Route / reader entry

There is no router route for the reader. Reader navigation is state-driven:

```text
App.currentBook === null  -> LibraryView
App.currentBook !== null  -> ReaderView
```

`apps/desktop/src/features/library/LibraryView.tsx` selects a book and calls the reader store's `setCurrentBook`. `setCurrentBook(book)` delegates to `openBook(book)`.

## 3. Reader route/component

- `apps/desktop/src/features/reader/ReaderView.tsx` is the production reader shell.
- It chooses the document renderer from `documentData.file.format`.
- EPUB/reflowable formats render `apps/desktop/src/features/reader/EpubReaderView.tsx`.
- `EpubReaderView` renders `currentChapter.html_content` with `dangerouslySetInnerHTML` inside the `.prose-reader` content element.

## 4. `openBook` implementation

`apps/desktop/src/state/readerState.ts`, `createReaderStore().openBook`:

1. Sets `currentBook` and switches `activeTab` to `reader`.
2. Calls `api.openReaderDocument(book.id, fileId)`.
3. Stores document metadata, annotations, bookmarks, and progress.
4. Starts a reading session through `api.startReadingSession`.
5. For EPUB/TXT/MD/HTML, resolves the initial spine index and calls `loadChapter(initialIndex)`.
6. `loadChapter` calls `api.getReaderChapter(currentBook.id, spineIndex)`.
7. The returned `ChapterContent` is stored as `currentChapter`.
8. React renders `EpubReaderView`, which inserts `currentChapter.html_content` into the real DOM.

## 5. `openReaderDocument` implementation

`apps/desktop/src/lib/tauri.ts`, `LumaApiClient.openReaderDocument` calls:

```text
_call("open_reader_document", { bookId, fileId }, mockFallback)
```

Transport selection:

- If `useMock` is true, or the page is not detected as Tauri, the mock fallback is used.
- Otherwise `config.invoke`, defaulting to `@tauri-apps/api/core.invoke`, sends the command through Tauri IPC.
- `isTauri()` checks for `window.__TAURI_INTERNALS__` or `window.__TAURI__`.

The mock implementation is not the production EPUB path. It returns fixture-like in-memory chapter HTML and does not parse `tests/fixtures/sample_book.epub`.

## 6. Tauri commands used by the EPUB open path

Registered in `apps/desktop/src-tauri/src/main.rs`:

- `open_reader_document`
- `get_reader_chapter`
- `start_reading_session`
- `save_reading_progress` (debounced after chapter loading)
- `complete_reading_session` (on reader close)

The minimum content path uses the first two reader commands plus the session/progress commands as side effects.

`apps/desktop/src-tauri/src/commands/reader.rs`:

- `open_reader_document(State<LumaAppContext>, book_id, file_id)` parses IDs and calls `ctx.reader_service.open_document`.
- `get_reader_chapter(State<LumaAppContext>, book_id, spine_index)` parses the book ID and calls `ctx.reader_service.get_chapter`.

## 7. Rust service called

`apps/desktop/src-tauri/src/context.rs` constructs `ReaderService` with the application `Database` and `CacheManager`.

`crates/luma-storage/src/services/reader_service.rs`:

### `ReaderService::open_document`

1. Reads the `Book` from `BookRepository`.
2. Resolves the primary or requested `BookFile` through `BookFileRepository`.
3. Reads progress, annotations, bookmarks, and authors from SQLite repositories.
4. Converts `file.relative_path` to a `PathBuf`.
5. For EPUB, opens the file with `luma_reader::EpubDocument::open` through `ReflowableDocument::Epub`.
6. Reads spine count and TOC.
7. Stores the opened reflowable document in the bounded in-process session cache.
8. Attempts to open a canonical document for the same file.
9. Returns `OpenDocumentResult`.

### `ReaderService::get_chapter`

1. Checks the cached reflow session for the book.
2. Retrieves the requested spine chapter from the cached `ReflowableDocument`.
3. Returns the production `ChapterContent` containing spine index, ID, title, href, HTML content, and text content.

## 8. EPUB fixture

Repository fixture:

```text
tests/fixtures/sample_book.epub
```

The current production Tauri path does not automatically import this fixture. For it to be opened by `ReaderService`, application state must contain a `Book` and `BookFile` row pointing to a filesystem path that resolves to this EPUB (or the fixture must first be imported through the real import workflow).

## 9. Returned document representation

`OpenDocumentResult` is defined in `crates/luma-storage/src/services/reader_service.rs` and contains:

- `book: Book`
- `file: BookFile`
- `metadata: DocumentMetadata`
- `toc: Vec<TocItem>`
- `total_pages_or_spines: u32`
- `capabilities: FormatCapabilities`
- `initial_progress: Option<ReadingProgress>`
- `annotations: Vec<Annotation>`
- `bookmarks: Vec<Bookmark>`

`ChapterContent` is returned by `luma_reader` and consumed by the frontend. Its `html_content` becomes the rendered chapter DOM.

## 10. Final DOM rendering component

`apps/desktop/src/features/reader/EpubReaderView.tsx`:

```text
EpubReaderView
  -> currentChapter.html_content
  -> <div ref={contentRef} className="prose-reader ...">
  -> dangerouslySetInnerHTML
  -> browser DOM text nodes
```

The current selection listener is attached to the outer reader container and reads the browser Selection after `mouseup`. This document does not treat that handler or JSDOM tests as real selection acceptance evidence.

## 11. IPC boundaries

The browser/frontend-to-native boundaries in the open EPUB path are:

1. `LumaApiClient._call` to the configured `invoke` function.
2. Dynamic import of `@tauri-apps/api/core.invoke`.
3. Tauri IPC command `open_reader_document`.
4. Tauri IPC command `get_reader_chapter`.
5. Tauri IPC commands for reading-session/progress side effects.
6. Rust command handlers to `LumaAppContext`.
7. `LumaAppContext.reader_service` to SQLite repositories and `luma_reader`.
8. `ReaderService` to the filesystem path stored in `BookFile.relative_path`.
9. Returned serialized Rust structures back through Tauri IPC into the frontend store.

No HTTP reader endpoint was found in the inspected production path. The frontend's non-Tauri fallback is mock data, not a real backend transport.

## 12. Required filesystem/database state

A real production EPUB browser/desktop run requires:

- Tauri runtime/WebView with Tauri internals available.
- `LumaAppContext` initialized by the desktop binary.
- Writable application data directory.
- SQLite database at the configured data directory's `luma.db`.
- A valid `Book` row with a valid `primary_file_id` or a selected file ID.
- A matching `BookFile` row with `format = epub`.
- `BookFile.relative_path` resolving to the actual EPUB file.
- The real EPUB available at that path; for this task the intended source is `tests/fixtures/sample_book.epub`.
- Optional but normally expected progress, annotation, bookmark, author, and session tables/rows.
- Tauri command registration from `apps/desktop/src-tauri/src/main.rs`.

## Execution classifications

| Path | Classification | Reason |
|---|---|---|
| JSDOM/Vitest selection harness | `UNIT-TESTED` | Synthetic DOM and Selection APIs; no browser geometry proof. |
| Vite page without Tauri | `BROWSER-TESTED` only for UI that does not need native data | `LumaApiClient` defaults to mock mode outside Tauri. It is not the real EPUB backend path. |
| Vite page with a custom invoke transport | Not present | No transport adapter was added; adding one would require explicit test-only design and must still call real Rust reader code. |
| Real Tauri desktop binary/WebView2 | Required for `TAURI-RUNTIME-PROVEN` | Provides actual IPC, `LumaAppContext`, SQLite, filesystem, Rust reader, and production frontend together. |

## Current smallest legitimate path

The smallest path that preserves all production behavior is:

```text
real luma desktop binary
  -> real WebView2
  -> production frontend
  -> Tauri invoke
  -> LumaAppContext / SQLite / filesystem
  -> ReaderService
  -> EpubDocument
  -> ChapterContent
  -> EpubReaderView DOM
```

A Playwright Chromium browser alone cannot be classified as Tauri runtime proof. It can only become `BROWSER-PRODUCTION-CODE-TESTED` if an explicitly test-only IPC transport invokes the real Rust reader/service path without replacing the reader UI or EPUB parser. No such existing transport was found during this mapping pass.
