import { describe, it, expect, beforeEach } from "vitest";
import { useReaderStore } from "../readerState";
import { Book } from "@luma/shared-types";

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

describe("readerState store", () => {
  beforeEach(() => {
    useReaderStore.getState().closeReader();
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
});
