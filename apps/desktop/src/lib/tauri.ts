import { Book, Annotation, ReadingProgress, ResolutionResult } from "@luma/shared-types";

// Tauri invoke wrapper with graceful fallback for standalone browser preview
async function invokeTauri<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(command, args);
  }

  // Standalone web development mock
  console.warn(`[Luma Tauri Mock] Invoking command: ${command}`, args);
  if (command === "list_books") {
    return [
      {
        id: "book_01j7b5w8e8z4t1a0b3c4d5e6f7",
        title: "The Architecture of Open Source Applications",
        subtitle: "Elegance, Evolution, and a Few Fearless Hacks",
        author_ids: [],
        sync: {
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          device_id: "dev_01j7b5w8e8z4t1a0b3c4d5e6f8",
          is_deleted: false,
        },
      } as unknown as Book,
    ] as unknown as T;
  }

  return {} as T;
}

export const LumaApi = {
  listBooks: () => invokeTauri<Book[]>("list_books"),
  getBook: (bookId: string) => invokeTauri<Book | null>("get_book", { bookId }),
  listAnnotations: (bookId: string) => invokeTauri<Annotation[]>("list_annotations", { bookId }),
  saveAnnotation: (annotation: Annotation) => invokeTauri<void>("save_annotation", { annotation }),
  getReadingProgress: (bookId: string) => invokeTauri<ReadingProgress | null>("get_reading_progress", { bookId }),
  saveReadingProgress: (progress: ReadingProgress) => invokeTauri<void>("save_reading_progress", { progress }),
  resolveAnchor: (quote: string, prefix: string | null, suffix: string | null, documentText: string) =>
    invokeTauri<ResolutionResult>("resolve_anchor", { quote, prefix, suffix, documentText }),
};
