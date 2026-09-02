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
  PdfPageData,
  SyncMetadata,
} from "@luma/shared-types";
import { DEFAULT_READER_SETTINGS } from "@luma/reader-ui";
import { LumaApi } from "../lib/tauri";
import { perfTelemetry } from "../lib/perfTelemetry";

// ----------------------------------------------------------------------------
// 1. Types
// ----------------------------------------------------------------------------

export type ReaderSidebarTab = "toc" | "annotations" | "bookmarks" | "search" | null;

export interface ReaderStoreState {
  currentBook: Book | null;
  documentData: OpenDocumentResult | null;
  currentChapter: ChapterContent | null;
  currentSpineIndex: number;
  currentPdfPage: number;
  leftPdfPageData: PdfPageData | null;
  rightPdfPageData: PdfPageData | null;
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

  // Actions (same as before, but now use injected dependencies)
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

// ----------------------------------------------------------------------------
// 2. Configuration & Labels
// ----------------------------------------------------------------------------

export interface ReaderStoreLabels {
  deviceId?: string;
  defaultChapterTitle?: string;
  highlightCreated?: string;
  bookmarkAdded?: string;
  bookmarkRemoved?: string;
  annotationDeleted?: string;
  statusClearedAfterMs?: number;
  pagePrefix?: string;
  openFailedMessage?: string;
}

export interface ReaderStoreConfig {
  /** API client (defaults to global LumaApi) */
  api?: typeof LumaApi;
  /** Logger instance (defaults to console) */
  logger?: Pick<Console, "debug" | "info" | "warn" | "error">;
  /** Debounce delay for saving progress (ms) */
  debounceDelay?: number;
  /** Labels for UI messages and defaults */
  labels?: ReaderStoreLabels;
  /** Default sync metadata for new entities */
  syncDefaults?: Partial<SyncMetadata>;
  /** Performance telemetry instance (defaults to perfTelemetry) */
  perfTelemetry?: typeof perfTelemetry;
}

// ----------------------------------------------------------------------------
// 3. Defaults
// ----------------------------------------------------------------------------

const DEFAULT_LABELS: Required<ReaderStoreLabels> = {
  deviceId: "dev_01",
  defaultChapterTitle: "Untitled Chapter",
  highlightCreated: "Highlight created & anchored.",
  bookmarkAdded: "Bookmark added.",
  bookmarkRemoved: "Bookmark removed.",
  annotationDeleted: "Annotation deleted.",
  statusClearedAfterMs: 3000,
  pagePrefix: "Page ",
  openFailedMessage: "Failed to open document: ",
};

const DEFAULT_SYNC_DEFAULTS: Partial<SyncMetadata> = {
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  device_id: DEFAULT_LABELS.deviceId,
  is_deleted: false,
};


// ----------------------------------------------------------------------------
// 4. Factory Function
// ----------------------------------------------------------------------------

export function createReaderStore(config: ReaderStoreConfig = {}) {
  const {
    api = LumaApi,
    logger = console,
    debounceDelay = 400,
    labels = {},
    syncDefaults = {},
    perfTelemetry: perf = perfTelemetry,
  } = config;

  const mergedLabels: Required<ReaderStoreLabels> = {
    ...DEFAULT_LABELS,
    ...labels,
  };

  const mergedSyncDefaults: SyncMetadata = {
    ...DEFAULT_SYNC_DEFAULTS,
    ...syncDefaults,
  } as SyncMetadata;

  // Helper to create sync metadata with current timestamps
  function createSyncMeta(): SyncMetadata {
    const now = new Date().toISOString();
    return {
      version: mergedSyncDefaults.version ?? 1,
      created_at: now,
      updated_at: now,
      device_id: mergedSyncDefaults.device_id ?? mergedLabels.deviceId,
      is_deleted: false,
    };
  }

  let progressDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function debouncedSaveProgress(progress: ReadingProgress) {
    if (progressDebounceTimer) {
      clearTimeout(progressDebounceTimer);
    }
    progressDebounceTimer = setTimeout(() => {
      api.saveReadingProgress(progress).catch((err) => {
        logger.warn("[readerStore] Failed to persist reading progress:", err);
      });
      progressDebounceTimer = null;
    }, debounceDelay);
  }

  return create<ReaderStoreState>((set, get) => ({
    currentBook: null,
    documentData: null,
    currentChapter: null,
    currentSpineIndex: 0,
    currentPdfPage: 1,
    leftPdfPageData: null,
    rightPdfPageData: null,
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

    // ------------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------------
    setCurrentBook: (book) => {
      if (book) {
        get().openBook(book);
      } else {
        get().closeReader();
      }
    },

    openBook: async (book: Book, fileId?: string) => {
      set({ loading: true, currentBook: book, activeTab: "reader" });
      perf.mark("LUMA_PERF_READER_OPEN", { bookId: book.id, title: book.title });
      try {
        const docData = await api.openReaderDocument(book.id, fileId);
        const annotations = docData.annotations || [];
        const bookmarks = docData.bookmarks || [];

        set({
          documentData: docData,
          annotations,
          bookmarks,
          readingProgress: docData.initial_progress || null,
        });

        // Restore initial position
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
        logger.error("Failed to open book:", err);
        const msg = `${mergedLabels.openFailedMessage}${err}`;
        set({ statusMessage: msg });
      } finally {
        set({ loading: false });
      }
    },

    closeReader: () => {
      if (progressDebounceTimer) {
        clearTimeout(progressDebounceTimer);
        progressDebounceTimer = null;
        const curr = get().readingProgress;
        if (curr) {
          api.saveReadingProgress(curr).catch(() => {});
        }
      }
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
        const chapter = await api.getReaderChapter(currentBook.id, spineIndex);
        const total = documentData?.total_pages_or_spines || 1;
        const pct = (spineIndex + 1) / total;
        const locator = `epubcfi(/6/${(spineIndex + 1) * 2}!/4/1:0)`;

        const progress: ReadingProgress = {
          book_id: currentBook.id,
          progress_percentage: pct,
          current_locator: locator,
          current_chapter_title: chapter.title || mergedLabels.defaultChapterTitle,
          current_page_number: spineIndex + 1,
          total_pages: total,
          last_read_at: new Date().toISOString(),
          sync: createSyncMeta(),
        };

        set({
          currentChapter: chapter,
          currentSpineIndex: spineIndex,
          readingProgress: progress,
        });

        perf.mark("LUMA_PERF_EPUB_CONTENT_READY", { spineIndex, title: chapter.title });
        debouncedSaveProgress(progress);
      } catch (err) {
        logger.error("Failed to load chapter:", err);
      }
    },

    loadPdfPage: async (pageNumber: number) => {
      const { currentBook, documentData } = get();
      if (!currentBook) return;
      try {
        const total = documentData?.total_pages_or_spines || 1;
        const validPage = Math.max(1, Math.min(total, pageNumber));
        const leftPage = validPage % 2 === 0 ? validPage : Math.max(1, validPage - 1);
        const rightPage = leftPage + 1;

        const [leftData, rightData] = await Promise.all([
          api.getReaderPdfPage(currentBook.id, leftPage).catch(() => null),
          rightPage <= total ? api.getReaderPdfPage(currentBook.id, rightPage).catch(() => null) : Promise.resolve(null),
        ]);

        const pct = validPage / total;
        const locator = `page=${validPage}`;

        const progress: ReadingProgress = {
          book_id: currentBook.id,
          progress_percentage: pct,
          current_locator: locator,
          current_chapter_title: `${mergedLabels.pagePrefix}${validPage}`,
          current_page_number: validPage,
          total_pages: total,
          last_read_at: new Date().toISOString(),
          sync: createSyncMeta(),
        };

        set({
          currentPdfPage: validPage,
          leftPdfPageData: leftData,
          rightPdfPageData: rightData,
          readingProgress: progress,
        });

        debouncedSaveProgress(progress);
      } catch (err) {
        logger.error("Failed to load PDF page:", err);
      }
    },

    jumpToLocator: async (locator: string) => {
      const { documentData } = get();
      if (documentData?.file.format === "epub") {
        const match = locator.match(/epubcfi\(\/6\/(\d+)/);
        if (match && match[1]) {
          const spine = Math.floor(parseInt(match[1], 10) / 2) - 1;
          if (spine >= 0) {
            await get().loadChapter(spine);
            return;
          }
        }
        const found = documentData.toc.findIndex((t) => t.locator === locator);
        if (found !== -1) {
          await get().loadChapter(found);
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
        sync: createSyncMeta(),
      };

      await api.saveAnnotation(newAnn);
      const updated = await api.listAnnotations(currentBook.id);
      perf.mark("LUMA_PERF_ANNOTATION_SAVED", { bookId: currentBook.id });
      set({ annotations: updated, statusMessage: mergedLabels.highlightCreated });

      setTimeout(() => set({ statusMessage: null }), mergedLabels.statusClearedAfterMs);
    },

    deleteAnnotation: async (id: string) => {
      const { currentBook } = get();
      if (!currentBook) return;
      await api.deleteAnnotation(id);
      const updated = await api.listAnnotations(currentBook.id);
      set({ annotations: updated, statusMessage: mergedLabels.annotationDeleted });
      setTimeout(() => set({ statusMessage: null }), mergedLabels.statusClearedAfterMs);
    },

    updateAnnotationNote: async (id: string, note: string) => {
      const { currentBook } = get();
      if (!currentBook) return;
      await api.updateAnnotationNote(id, note || null);
      const updated = await api.listAnnotations(currentBook.id);
      set({ annotations: updated });
    },

    toggleBookmark: async () => {
      const { currentBook, readingProgress, bookmarks } = get();
      if (!currentBook || !readingProgress) return;

      const existing = bookmarks.find((b) => b.locator === readingProgress.current_locator);
      if (existing) {
        await api.deleteBookmark(existing.id);
        const updated = await api.listBookmarks(currentBook.id);
        set({ bookmarks: updated, statusMessage: mergedLabels.bookmarkRemoved });
      } else {
        const bmk = await api.createBookmark(
          currentBook.id,
          readingProgress.current_locator,
          readingProgress.current_chapter_title || `${mergedLabels.pagePrefix}${readingProgress.current_page_number || 1}`,
          readingProgress.current_chapter_title,
          readingProgress.current_page_number
        );
        set({ bookmarks: [bmk, ...bookmarks], statusMessage: mergedLabels.bookmarkAdded });
      }
      setTimeout(() => set({ statusMessage: null }), mergedLabels.statusClearedAfterMs);
    },

    deleteBookmark: async (id: string) => {
      const { currentBook } = get();
      if (!currentBook) return;
      await api.deleteBookmark(id);
      const updated = await api.listBookmarks(currentBook.id);
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
        const results = await api.searchDocument(currentBook.id, query);
        set({ searchResults: results });
      } catch (err) {
        logger.error("In-doc search failed:", err);
      }
    },

    clearSearch: () => {
      set({ searchQuery: "", searchResults: [] });
    },

    setStatusMessage: (msg) => {
      set({ statusMessage: msg });
    },
  }));
}

// ----------------------------------------------------------------------------
// 5. Default Export (Singleton)
// ----------------------------------------------------------------------------

export const useReaderStore = createReaderStore();