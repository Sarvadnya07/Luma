import { create } from "zustand";
import {
  Book,
  Annotation,
  ReadingProgress,
  OpenDocumentResult,
  ChapterContent,
  Bookmark,
  DocumentSearchMatch,
  ReaderSettings,
} from "@luma/shared-types";
import { DEFAULT_READER_SETTINGS } from "@luma/reader-ui";
import { LumaApi } from "../lib/tauri";

export type ReaderSidebarTab = "toc" | "annotations" | "bookmarks" | "search" | null;

interface ReaderStoreState {
  currentBook: Book | null;
  documentData: OpenDocumentResult | null;
  currentChapter: ChapterContent | null;
  currentSpineIndex: number;
  currentPdfPage: number;
  readingProgress: ReadingProgress | null;
  annotations: Annotation[];
  bookmarks: Bookmark[];
  settings: ReaderSettings;
  sidebarTab: ReaderSidebarTab;
  isTypographyOpen: boolean;
  searchQuery: string;
  searchResults: DocumentSearchMatch[];
  activeTab: "library" | "reader";
  loading: boolean;
  statusMessage: string | null;

  // Actions
  setCurrentBook: (book: Book | null) => void;
  openBook: (book: Book, fileId?: string) => Promise<void>;
  closeReader: () => void;
  loadChapter: (spineIndex: number) => Promise<void>;
  loadPdfPage: (pageNumber: number) => Promise<void>;
  jumpToLocator: (locator: string) => Promise<void>;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  setSidebarTab: (tab: ReaderSidebarTab) => void;
  toggleTypography: () => void;
  createHighlight: (colorHex: string, quote: string, prefix?: string, suffix?: string, note?: string) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  updateAnnotationNote: (id: string, note: string) => Promise<void>;
  toggleBookmark: () => Promise<void>;
  deleteBookmark: (id: string) => Promise<void>;
  searchInDoc: (query: string) => Promise<void>;
  clearSearch: () => void;
  setStatusMessage: (msg: string | null) => void;
}

export const useReaderStore = create<ReaderStoreState>((set, get) => ({
  currentBook: null,
  documentData: null,
  currentChapter: null,
  currentSpineIndex: 0,
  currentPdfPage: 1,
  readingProgress: null,
  annotations: [],
  bookmarks: [],
  settings: DEFAULT_READER_SETTINGS,
  sidebarTab: null,
  isTypographyOpen: false,
  searchQuery: "",
  searchResults: [],
  activeTab: "library",
  loading: false,
  statusMessage: null,

  setCurrentBook: (book) => {
    if (book) {
      get().openBook(book);
    } else {
      get().closeReader();
    }
  },

  openBook: async (book: Book, fileId?: string) => {
    set({ loading: true, currentBook: book, activeTab: "reader" });
    try {
      const docData = await LumaApi.openReaderDocument(book.id, fileId);
      const [annotations, bookmarks] = await Promise.all([
        LumaApi.listAnnotations(book.id),
        LumaApi.listBookmarks(book.id),
      ]);

      set({
        documentData: docData,
        annotations,
        bookmarks,
        readingProgress: docData.initial_progress || null,
      });

      // Restore initial position or load first chapter/page
      if (docData.file.format === "epub") {
        let initialIndex = 0;
        if (docData.initial_progress?.current_locator) {
          const match = docData.initial_progress.current_locator.match(/epubcfi\(\/6\/(\d+)/);
          if (match && match[1]) {
            const parsedSpine = Math.floor(parseInt(match[1], 10) / 2) - 1;
            if (parsedSpine >= 0 && parsedSpine < (docData.total_pages_or_spines || 1)) {
              initialIndex = parsedSpine;
            }
          }
        }
        await get().loadChapter(initialIndex);
      } else if (docData.file.format === "pdf") {
        let initialPage = 1;
        if (docData.initial_progress?.current_page_number) {
          initialPage = docData.initial_progress.current_page_number;
        }
        await get().loadPdfPage(initialPage);
      }
    } catch (err) {
      console.error("Failed to open book:", err);
      set({ statusMessage: `Failed to open document: ${err}` });
    } finally {
      set({ loading: false });
    }
  },

  closeReader: () => {
    set({
      currentBook: null,
      documentData: null,
      currentChapter: null,
      activeTab: "library",
      sidebarTab: null,
      isTypographyOpen: false,
    });
  },

  loadChapter: async (spineIndex: number) => {
    const { currentBook, documentData } = get();
    if (!currentBook) return;
    try {
      const chapter = await LumaApi.getReaderChapter(currentBook.id, spineIndex);
      const total = documentData?.total_pages_or_spines || 1;
      const pct = (spineIndex + 1) / total;
      const locator = `epubcfi(/6/${(spineIndex + 1) * 2}!/4/1:0)`;

      const progress: ReadingProgress = {
        book_id: currentBook.id,
        progress_percentage: pct,
        current_locator: locator,
        current_chapter_title: chapter.title,
        current_page_number: spineIndex + 1,
        total_pages: total,
        last_read_at: new Date().toISOString(),
        sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
      };

      set({
        currentChapter: chapter,
        currentSpineIndex: spineIndex,
        readingProgress: progress,
      });

      await LumaApi.saveReadingProgress(progress);
    } catch (err) {
      console.error("Failed to load chapter:", err);
    }
  },

  loadPdfPage: async (pageNumber: number) => {
    const { currentBook, documentData } = get();
    if (!currentBook) return;
    try {
      const total = documentData?.total_pages_or_spines || 1;
      const pct = pageNumber / total;
      const locator = `page=${pageNumber}`;

      const progress: ReadingProgress = {
        book_id: currentBook.id,
        progress_percentage: pct,
        current_locator: locator,
        current_chapter_title: `Page ${pageNumber}`,
        current_page_number: pageNumber,
        total_pages: total,
        last_read_at: new Date().toISOString(),
        sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
      };

      set({
        currentPdfPage: pageNumber,
        readingProgress: progress,
      });

      await LumaApi.saveReadingProgress(progress);
    } catch (err) {
      console.error("Failed to load PDF page:", err);
    }
  },

  jumpToLocator: async (locator: string) => {
    const { documentData } = get();
    if (documentData?.file.format === "epub") {
      // Parse spine index from CFI or match TOC item
      const match = locator.match(/epubcfi\(\/6\/(\d+)/);
      if (match && match[1]) {
        const spine = Math.floor(parseInt(match[1], 10) / 2) - 1;
        if (spine >= 0) {
          await get().loadChapter(spine);
        }
      } else {
        const found = documentData.toc.findIndex((t) => t.locator === locator);
        if (found !== -1) {
          await get().loadChapter(found);
        }
      }
    } else if (documentData?.file.format === "pdf") {
      const match = locator.match(/page=(\d+)/);
      if (match && match[1]) {
        const page = parseInt(match[1], 10);
        await get().loadPdfPage(page);
      }
    }
  },

  updateSettings: (newSettings) => {
    set((state) => ({ settings: { ...state.settings, ...newSettings } }));
  },

  setSidebarTab: (tab) => {
    set({ sidebarTab: tab });
  },

  toggleTypography: () => {
    set((state) => ({ isTypographyOpen: !state.isTypographyOpen }));
  },

  createHighlight: async (colorHex, quote, prefix, suffix, note) => {
    const { currentBook, currentSpineIndex } = get();
    if (!currentBook) return;

    const payload = JSON.stringify({
      exact: quote,
      prefix: prefix || null,
      suffix: suffix || null,
      normalized_exact: quote.toLowerCase().replace(/\s+/g, " "),
      spine_index: currentSpineIndex,
    });

    const newAnn: Annotation = {
      id: `ann_${Date.now()}`,
      book_id: currentBook.id,
      annotation_type: note ? "note" : "highlight",
      color_hex: colorHex,
      quote,
      note: note || null,
      anchor_payload_json: payload,
      sync: {
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        device_id: "dev_01",
        is_deleted: false,
      },
    };

    await LumaApi.saveAnnotation(newAnn);
    const updated = await LumaApi.listAnnotations(currentBook.id);
    set({ annotations: updated, statusMessage: "Highlight created & anchored." });
    setTimeout(() => set({ statusMessage: null }), 3000);
  },

  deleteAnnotation: async (id: string) => {
    const { currentBook } = get();
    if (!currentBook) return;
    await LumaApi.deleteAnnotation(id);
    const updated = await LumaApi.listAnnotations(currentBook.id);
    set({ annotations: updated });
  },

  updateAnnotationNote: async (id: string, note: string) => {
    const { currentBook } = get();
    if (!currentBook) return;
    await LumaApi.updateAnnotationNote(id, note || null);
    const updated = await LumaApi.listAnnotations(currentBook.id);
    set({ annotations: updated });
  },

  toggleBookmark: async () => {
    const { currentBook, readingProgress, bookmarks } = get();
    if (!currentBook || !readingProgress) return;

    const existing = bookmarks.find((b) => b.locator === readingProgress.current_locator);
    if (existing) {
      await LumaApi.deleteBookmark(existing.id);
      const updated = await LumaApi.listBookmarks(currentBook.id);
      set({ bookmarks: updated, statusMessage: "Bookmark removed." });
    } else {
      const bmk = await LumaApi.createBookmark(
        currentBook.id,
        readingProgress.current_locator,
        readingProgress.current_chapter_title || `Page ${readingProgress.current_page_number || 1}`,
        readingProgress.current_chapter_title,
        readingProgress.current_page_number
      );
      set({ bookmarks: [bmk, ...bookmarks], statusMessage: "Bookmark added." });
    }
    setTimeout(() => set({ statusMessage: null }), 2500);
  },

  deleteBookmark: async (id: string) => {
    const { currentBook } = get();
    if (!currentBook) return;
    await LumaApi.deleteBookmark(id);
    const updated = await LumaApi.listBookmarks(currentBook.id);
    set({ bookmarks: updated });
  },

  searchInDoc: async (query: string) => {
    const { currentBook } = get();
    if (!currentBook || !query.trim()) {
      set({ searchQuery: "", searchResults: [] });
      return;
    }
    set({ searchQuery: query });
    try {
      const results = await LumaApi.searchDocument(currentBook.id, query);
      set({ searchResults: results });
    } catch (err) {
      console.error("In-doc search failed:", err);
    }
  },

  clearSearch: () => {
    set({ searchQuery: "", searchResults: [] });
  },

  setStatusMessage: (msg) => {
    set({ statusMessage: msg });
  },
}));
