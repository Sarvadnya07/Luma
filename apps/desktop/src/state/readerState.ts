import { create } from "zustand";
import { Book, Annotation, ReadingProgress } from "@luma/shared-types";
import { ReaderSettings, DEFAULT_READER_SETTINGS } from "@luma/reader-ui";

interface ReaderState {
  currentBook: Book | null;
  readingProgress: ReadingProgress | null;
  annotations: Annotation[];
  settings: ReaderSettings;
  sidebarOpen: boolean;
  activeTab: "library" | "reader";
  setCurrentBook: (book: Book | null) => void;
  setReadingProgress: (progress: ReadingProgress | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateSettings: (settings: Partial<ReaderSettings>) => void;
  toggleSidebar: () => void;
  setActiveTab: (tab: "library" | "reader") => void;
}

export const useReaderStore = create<ReaderState>((set) => ({
  currentBook: null,
  readingProgress: null,
  annotations: [],
  settings: DEFAULT_READER_SETTINGS,
  sidebarOpen: true,
  activeTab: "library",
  setCurrentBook: (book) => set({ currentBook: book, activeTab: book ? "reader" : "library" }),
  setReadingProgress: (progress) => set({ readingProgress: progress }),
  setAnnotations: (annotations) => set({ annotations }),
  addAnnotation: (annotation) =>
    set((state) => ({ annotations: [...state.annotations, annotation] })),
  updateSettings: (newSettings) =>
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
