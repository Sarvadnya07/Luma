import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createReaderStoreForApi, useReaderStore } from "../readerState";
import { createLumaApi, type LumaApiClient } from "../../lib/tauri";
import { createInMemoryLibraryBackend } from "../../testing/inMemoryBackend";
import { Book, ChapterContent } from "@luma/shared-types";

const mockBook: Book = {
  id: "book_01918a23010170008000000000000001",
  title: "The Rust Programming Language",
  subtitle: "Covers Rust 2021 Edition",
  author_ids: ["auth_001"],
  series_id: null,
  series_index: null,
  description: "The official guide to learning the Rust systems programming language with memory safety guarantees.",
  publisher: "No Starch Press",
  published_date: "2023-02-15",
  language: "en",
  isbn: "978-1718503106",
  cover_image_id: null,
  cover_image_path: null,
  primary_file_id: "file_01918a23010170008000000000000002",
  reading_status: "reading",
  library_state: "active",
  trashed_at: null,
  sync: {
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    device_id: "dev_01",
    is_deleted: false,
  },
};

const isReflowable = mockBook.id.startsWith("book_01918");

/** Three synthetic chapters for `mockBook`, so the store has a real document. */
const mockChapters: Record<string, ChapterContent> = Object.fromEntries(
  [0, 1, 2].map((spineIndex) => [
    `${mockBook.id}:${spineIndex}`,
    {
      spine_index: spineIndex,
      id: `ch_${spineIndex}`,
      title: `Chapter ${spineIndex + 1}`,
      href: `text/ch${spineIndex + 1}.xhtml`,
      html_content: `<p>content ${spineIndex}</p>`,
      text_content: `Chapter ${spineIndex + 1} content`, // fixture text
    } satisfies ChapterContent,
  ])
);

describe("readerState store", () => {
  beforeEach(() => {
    // The module-level store resolves `LumaApi` lazily, so installing a backend
    // here is enough for it to read from an explicit in-memory store.
    createLumaApi({
      transport: createInMemoryLibraryBackend({
        books: [mockBook],
        files: [
          {
            id: mockBook.primary_file_id!,
            book_id: mockBook.id,
            original_filename: "rust.epub",
            relative_path: "library/rust.epub",
            canonical_path: null,
            format: isReflowable ? "epub" : "pdf",
            mime_type: null,
            file_size_bytes: 1024,
            sha256_hash: "fixture",
            imported_at: new Date().toISOString(),
            modified_at: null,
            availability: "available",
          },
        ],
        chapters: mockChapters,
      }).transport,
    });
    useReaderStore.getState().closeReader();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens a book and initializes session data", async () => {
    await useReaderStore.getState().openBook(mockBook);
    const state = useReaderStore.getState();

    expect(state.currentBook).toBeDefined();
    expect(state.currentBook?.id).toBe("book_01918a23010170008000000000000001");
    expect(state.activeTab).toBe("reader");
    expect(state.documentData).toBeDefined();
    expect(state.documentData?.metadata.title).toBe("The Rust Programming Language");
  });

  it("updates chapter and progress percentage accurately", async () => {
    await useReaderStore.getState().openBook(mockBook);
    await useReaderStore.getState().loadChapter(1);
    const state = useReaderStore.getState();

    expect(state.currentSpineIndex).toBe(1);
    expect(state.readingProgress).toBeDefined();
    expect(state.readingProgress?.current_locator).toContain("epubcfi");
    expect(state.readingProgress?.progress_percentage).toBeGreaterThan(0);
  });

  it("toggles and manages bookmarks", async () => {
    await useReaderStore.getState().openBook(mockBook);
    await useReaderStore.getState().toggleBookmark();
    let state = useReaderStore.getState();

    expect(state.bookmarks.length).toBeGreaterThan(0);

    const bmkId = state.bookmarks[0]!.id;
    await useReaderStore.getState().deleteBookmark(bmkId);
    state = useReaderStore.getState();
    expect(state.bookmarks.find((b) => b.id === bmkId)).toBeUndefined();
  });

  it("creates and manages highlights", async () => {
    await useReaderStore.getState().openBook(mockBook);
    await useReaderStore.getState().createHighlight(
      "#a855f7",
      "Every highlight must maintain multiple anchor signals.",
      "prefix context",
      "suffix context",
      "Key architecture requirement"
    );
    const state = useReaderStore.getState();

    expect(state.annotations.length).toBeGreaterThan(0);
    const ann = state.annotations.find(
      (a) => a.quote === "Every highlight must maintain multiple anchor signals."
    );
    expect(ann).toBeDefined();
    expect(ann?.color_hex).toBe("#a855f7");
    expect(ann?.note).toBe("Key architecture requirement");
  });

  it("updates reading presentation settings", () => {
    useReaderStore.getState().updateSettings({
      fontSize: 22,
      fontFamily: "sans",
      theme: "sepia",
      lineHeight: 1.8,
    });
    const state = useReaderStore.getState();

    expect(state.settings.fontSize).toBe(22);
    expect(state.settings.fontFamily).toBe("sans");
    expect(state.settings.theme).toBe("sepia");
    expect(state.settings.lineHeight).toBe(1.8);
  });

  it("closes reader and clears ephemeral state", async () => {
    await useReaderStore.getState().openBook(mockBook);
    useReaderStore.getState().closeReader();
    const state = useReaderStore.getState();

    expect(state.currentBook).toBeNull();
    expect(state.documentData).toBeNull();
    expect(state.activeTab).toBe("library");
  });

  // ------------------------------------------------------------------
  // Load-failure state (FE-CRIT-1) and ownership/consistency guards
  // (ARCH-02). These use an isolated store through the injected API seam.
  // ------------------------------------------------------------------

  it("surfaces an open failure as loadError and clears it on a successful retry", async () => {
    const api = makeStubApi();
    api.openReaderDocument.mockRejectedValueOnce(new Error("file is missing on disk"));
    const store = createReaderStoreForApi(api as unknown as LumaApiClient);

    await store.getState().openBook(mockBook);
    expect(store.getState().loadError).toContain("file is missing on disk");
    expect(store.getState().documentData).toBeNull();

    await store.getState().retryLoad();
    expect(store.getState().loadError).toBeNull();
    expect(store.getState().documentData).not.toBeNull();
  });

  it("surfaces a chapter failure and keeps the previously loaded chapter valid", async () => {
    const api = makeStubApi();
    const store = createReaderStoreForApi(api as unknown as LumaApiClient);
    await store.getState().openBook(mockBook);
    expect(store.getState().loadError).toBeNull();

    api.getReaderChapter.mockRejectedValueOnce(new Error("corrupt spine"));
    await store.getState().loadChapter(2);

    expect(store.getState().loadError).toContain("Could not load this chapter");
    expect(store.getState().loadError).toContain("corrupt spine");

    store.getState().clearLoadError();
    expect(store.getState().loadError).toBeNull();
  });

  it("flushes the final reading position on close even after the debounce window elapsed", async () => {
    vi.useFakeTimers();
    try {
      const api = makeStubApi();
      const store = createReaderStoreForApi(api as unknown as LumaApiClient);

      await store.getState().openBook(mockBook);
      await store.getState().loadChapter(1);

      // Let the debounce fire first: the old implementation only flushed on
      // close when a timer happened to still be pending, so this exact sequence
      // used to lose the last position.
      vi.advanceTimersByTime(1000);
      const beforeClose = api.saveReadingProgress.mock.calls.length;
      expect(beforeClose).toBeGreaterThan(0);

      store.getState().closeReader();
      expect(api.saveReadingProgress.mock.calls.length).toBe(beforeClose + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not write the chrome theme to the document or to storage", () => {
    // Single-owner guard for FE-HIGH-2: `App` + `lib/theme.ts` own the chrome
    // theme. If a DOM/localStorage write is reintroduced here this fails.
    const classList = { toggle: vi.fn(), add: vi.fn(), remove: vi.fn(), contains: vi.fn() };
    Object.defineProperty(globalThis, "document", {
      value: { documentElement: { classList, style: {} } },
      configurable: true,
    });
    const setItem = vi.fn();
    Object.defineProperty(globalThis, "localStorage", {
      value: { getItem: vi.fn(() => null), setItem },
      configurable: true,
    });

    try {
      useReaderStore.getState().updateSettings({ theme: "dark" });
      expect(useReaderStore.getState().settings.theme).toBe("dark");
      expect(classList.toggle).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(globalThis as object, "document");
      Reflect.deleteProperty(globalThis as object, "localStorage");
    }
  });
});

/** Minimal injected API double covering the reader-store call surface. */
function makeStubApi() {
  return {
    openReaderDocument: vi.fn(async () => ({
      file: { id: "file_1", book_id: mockBook.id, format: "txt" },
      metadata: { title: mockBook.title },
      total_pages_or_spines: 3,
      toc: [],
      annotations: [],
      bookmarks: [],
      initial_progress: null,
    })),
    getReaderChapter: vi.fn(async (bookId: string, spineIndex: number) => ({
      book_id: bookId,
      spine_index: spineIndex,
      title: `Chapter ${spineIndex + 1}`,
      html_content: "<p>content</p>",
    })),
    getReaderPdfPage: vi.fn(async () => null),
    startReadingSession: vi.fn(async () => ({ id: "session_1" })),
    completeReadingSession: vi.fn(async () => undefined),
    saveReadingProgress: vi.fn(async () => undefined),
    listAnnotations: vi.fn(async () => []),
    listBookmarks: vi.fn(async () => []),
    saveAnnotation: vi.fn(async () => undefined),
    deleteAnnotation: vi.fn(async () => undefined),
    updateAnnotationNote: vi.fn(async () => undefined),
    createBookmark: vi.fn(async () => ({ id: "bmk_1", locator: "page=1" })),
    deleteBookmark: vi.fn(async () => undefined),
    searchDocument: vi.fn(async () => []),
  };
}
