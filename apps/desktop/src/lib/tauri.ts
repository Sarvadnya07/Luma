import {
  Book,
  BookDetailViewData,
  Collection,
  Author,
  Series,
  Tag,
  ImportJob,
  LibraryFilterOptions,
  LibrarySortOptions,
  ReadingProgress,
  Annotation,
  ResolutionResult,
  OpenDocumentResult,
  ChapterContent,
  PdfPageData,
  DocumentSearchMatch,
  Bookmark,
  TocItem,
  ReadingStatus,
  BackupManifest,
  BackupPreview,
  BackupRecord,
  BulkOperationResult,
  DiagnosticsReport,
  JobProgress,
  MaintenanceResult,
} from "@luma/shared-types";

import {
  mockBooks,
  mockAnnotations,
  mockBookmarks,
  mockCollections,
  mockTags,
  mockSettings,
  BOOK_AUTHORS_MAP,
  GATSBY_CHAPTER_3_HTML,
  MEDITATIONS_BOOK_2_HTML,
} from "./mockData";

// ============================================================================
// 1. Types & Configuration
// ============================================================================

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface DefaultLabels {
  unknownAuthor?: string;
  readingStatusLabel?: string;
  inProgressLabel?: string;
  availableLabel?: string;
}

export interface MockDataProvider {
  books: Book[];
  collections: Collection[];
  tags: Tag[];
  annotations: Annotation[];
  bookmarks: Bookmark[];
  settings: Record<string, unknown>;
  authorMap: Record<string, string>;
  chapterHtml: Record<string, string>;
}

export interface LumaApiConfig {
  /** If true, force mock implementation even when Tauri runtime is detected. */
  useMock?: boolean;
  /** Custom invoke function (defaults to dynamic `@tauri-apps/api/core` invoke). */
  invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  /** Custom mock data store. */
  mockData?: MockDataProvider;
  /** Custom logger instance. */
  logger?: Logger;
  /** Default fallback labels. */
  defaultLabels?: DefaultLabels;
}

// ============================================================================
// 2. Default Logger & Tauri Detection
// ============================================================================

class ConsoleLogger implements Logger {
  debug(...args: unknown[]) {
    console.debug(...args);
  }
  info(...args: unknown[]) {
    console.info(...args);
  }
  warn(...args: unknown[]) {
    console.warn(...args);
  }
  error(...args: unknown[]) {
    console.error(...args);
  }
}

export const isTauri = (): boolean =>
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

// ============================================================================
// 3. Mock Data Store
// ============================================================================

export class MockDataStore implements MockDataProvider {
  public books: Book[];
  public collections: Collection[];
  public tags: Tag[];
  public annotations: Annotation[];
  public bookmarks: Bookmark[];
  public settings: Record<string, unknown>;
  public authorMap: Record<string, string>;
  public chapterHtml: Record<string, string>;

  constructor(initialData?: Partial<MockDataProvider>) {
    this.books = initialData?.books ?? [...mockBooks];
    this.collections = initialData?.collections ?? [...mockCollections];
    this.tags = initialData?.tags ?? [...mockTags];
    this.annotations = initialData?.annotations ?? [...mockAnnotations];
    this.bookmarks = initialData?.bookmarks ?? [...mockBookmarks];
    this.settings = initialData?.settings ?? { ...mockSettings };
    this.authorMap = initialData?.authorMap ?? { ...BOOK_AUTHORS_MAP };
    this.chapterHtml = initialData?.chapterHtml ?? {
      gatsby: GATSBY_CHAPTER_3_HTML,
      meditations: MEDITATIONS_BOOK_2_HTML,
    };
  }
}

// ============================================================================
// 4. Main LumaApiClient
// ============================================================================

export class LumaApiClient {
  private config: Required<Omit<LumaApiConfig, "invoke">> & {
    invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  };
  private logger: Logger;
  private mockStore: MockDataStore;

  constructor(config: LumaApiConfig = {}) {
    const defaultLabels: DefaultLabels = {
      unknownAuthor: "Unknown Author",
      readingStatusLabel: "Reading",
      inProgressLabel: "In Progress",
      availableLabel: "Available",
    };

    const mockStore = (config.mockData as MockDataStore) ?? new MockDataStore();
    const logger = config.logger ?? new ConsoleLogger();

    const defaultInvoke = async <T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<T>(cmd, args);
    };

    this.config = {
      useMock: config.useMock ?? !isTauri(),
      invoke: config.invoke ?? defaultInvoke,
      mockData: mockStore,
      logger,
      defaultLabels: { ...defaultLabels, ...config.defaultLabels },
    };

    this.logger = logger;
    this.mockStore = mockStore;
  }

  private isMock(): boolean {
    if (this.config.useMock) return true;
    return !isTauri();
  }

  private async _call<T>(cmd: string, args?: Record<string, unknown>, mockFn?: () => T | Promise<T>): Promise<T> {
    if (this.isMock() && mockFn) {
      return mockFn();
    }
    try {
      return await this.config.invoke<T>(cmd, args);
    } catch (err) {
      this.logger.error(`Tauri invoke failed for [${cmd}]:`, err);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Library API
  // --------------------------------------------------------------------------

  async listBooks(filter?: LibraryFilterOptions, sort?: LibrarySortOptions, page?: number, pageSize?: number): Promise<Book[]> {
    return this._call(
      "list_books",
      { filter, sort, page, pageSize },
      () => {
        let res = [...this.mockStore.books];
        if (filter?.library_state) {
          res = res.filter((b) => b.library_state === filter.library_state);
        } else {
          res = res.filter((b) => b.library_state === "active");
        }
        if (filter?.reading_status) {
          res = res.filter((b) => b.reading_status === filter.reading_status);
        }
        if (filter?.search_query) {
          const q = filter.search_query.toLowerCase();
          res = res.filter((b) => b.title.toLowerCase().includes(q) || (b.description && b.description.toLowerCase().includes(q)));
        }
        return res;
      }
    );
  }

  async getBookCoverDataUrl(bookId: string): Promise<string | null> {
    return this._call(
      "get_book_cover_data_url",
      { bookId },
      () => {
        const book = this.mockStore.books.find((b) => b.id === bookId);
        return book?.cover_image_path || null;
      }
    );
  }

  async getBookDetails(bookId: string): Promise<BookDetailViewData | null> {
    return this._call(
      "get_book_details",
      { bookId },
      () => {
        const book = this.mockStore.books.find((b) => b.id === bookId);
        if (!book) return null;

        const authorName = this.mockStore.authorMap[book.id] || this.config.defaultLabels.unknownAuthor || "Unknown Author";

        return {
          book,
          files: [
            {
              id: book.primary_file_id ?? "file_01",
              book_id: book.id,
              original_filename: `${book.title.replace(/\s+/g, "_")}.epub`,
              relative_path: `library/${book.title.replace(/\s+/g, "_")}.epub`,
              canonical_path: `/Users/luma/Documents/${book.title}.epub`,
              format: book.id === "book_design_everyday" ? "pdf" : "epub",
              mime_type: book.id === "book_design_everyday" ? "application/pdf" : "application/epub+zip",
              file_size_bytes: 4829104,
              sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              imported_at: book.sync.created_at,
              availability: "available",
            },
          ],
          authors: [
            {
              id: "auth_01",
              name: authorName,
              sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
            },
          ],
          series: book.series_id ? { id: book.series_id, title: "Foundation", sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false } } : null,
          tags: this.mockStore.tags,
          collections: this.mockStore.collections.filter((c) => c.book_ids.includes(bookId)),
          reading_progress: {
            book_id: book.id,
            progress_percentage: book.id === "book_arch_stillness" ? 0.75 : book.id === "book_great_gatsby" ? 0.66 : book.id === "book_meditations" ? 0.15 : book.id === "book_foundation" ? 1.0 : book.id === "book_design_everyday" ? 0.12 : 0,
            current_locator: "epubcfi(/6/4[chapter-1]!/4/2/10)",
            current_chapter_title: book.id === "book_meditations" ? "Book Two" : book.id === "book_great_gatsby" ? "Chapter III" : "Chapter 1",
            current_page_number: 1,
            total_pages: 12,
            last_read_at: new Date().toISOString(),
            sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
          },
        };
      }
    );
  }

  async openReaderDocument(bookId: string, fileId?: string): Promise<OpenDocumentResult> {
    return this._call(
      "open_reader_document",
      { bookId, fileId },
      () => {
        const book = this.mockStore.books.find((b) => b.id === bookId) || {
          id: bookId,
          title: bookId.startsWith("book_01918") ? "The Rust Programming Language" : this.mockStore.books[0]?.title || "Book Title",
          subtitle: null,
          author_ids: [],
          series_id: null,
          series_index: null,
          description: "Document reader content",
          publisher: null,
          published_date: null,
          language: "en",
          isbn: null,
          cover_image_id: null,
          cover_image_path: null,
          primary_file_id: fileId ?? "file_01",
          reading_status: "reading" as const,
          library_state: "active" as const,
          trashed_at: null,
          sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
        };
        const authorName = this.mockStore.authorMap[book.id] || this.config.defaultLabels.unknownAuthor || "Unknown Author";

        let toc: TocItem[] = [
          { title: "Chapter 1: The Principle of Architecture", locator: "epubcfi(/6/2!/4/1:0)", play_order: 1, children: [] },
          { title: "Chapter 2: Data Autonomy & Sync", locator: "epubcfi(/6/4!/4/1:0)", play_order: 2, children: [] },
          { title: "Chapter 3: Resilient Annotation Anchoring", locator: "epubcfi(/6/6!/4/1:0)", play_order: 3, children: [] },
          { title: "Chapter 4: Conclusion & Knowledge Mesh", locator: "epubcfi(/6/8!/4/1:0)", play_order: 4, children: [] },
        ];

        if (book.id === "book_great_gatsby") {
          toc = [
            { title: "Chapter I", locator: "epubcfi(/6/2!/4/1:0)", play_order: 1, children: [] },
            { title: "Chapter II", locator: "epubcfi(/6/4!/4/1:0)", play_order: 2, children: [] },
            { title: "Chapter III", locator: "epubcfi(/6/6!/4/1:0)", play_order: 3, children: [] },
            { title: "Chapter IV", locator: "epubcfi(/6/8!/4/1:0)", play_order: 4, children: [] },
            { title: "Chapter V", locator: "epubcfi(/6/10!/4/1:0)", play_order: 5, children: [] },
          ];
        } else if (book.id === "book_meditations") {
          toc = [
            { title: "Book One", locator: "epubcfi(/6/2!/4/1:0)", play_order: 1, children: [] },
            {
              title: "Book Two",
              locator: "epubcfi(/6/4!/4/1:0)",
              play_order: 2,
              children: [
                { title: "Section 1", locator: "epubcfi(/6/4!/4/2:0)", play_order: 1, children: [] },
                { title: "Section 2", locator: "epubcfi(/6/4!/4/4:0)", play_order: 2, children: [] },
                { title: "Section 3", locator: "epubcfi(/6/4!/4/6:0)", play_order: 3, children: [] },
              ],
            },
            { title: "Book Three", locator: "epubcfi(/6/6!/4/1:0)", play_order: 42, children: [] },
            { title: "Book Four", locator: "epubcfi(/6/8!/4/1:0)", play_order: 58, children: [] },
            { title: "Book Five", locator: "epubcfi(/6/10!/4/1:0)", play_order: 74, children: [] },
          ];
        }

        const isPdf = book.id === "book_design_everyday";

        return {
          book,
          file: {
            id: book.primary_file_id ?? "file_01",
            book_id: book.id,
            original_filename: `${book.title}.epub`,
            relative_path: `library/${book.title}.epub`,
            canonical_path: `/Users/luma/${book.title}.epub`,
            format: isPdf ? "pdf" : "epub",
            mime_type: isPdf ? "application/pdf" : "application/epub+zip",
            file_size_bytes: 3429104,
            sha256_hash: "mocksha256",
            imported_at: new Date().toISOString(),
            availability: "available",
          },
          metadata: {
            title: book.title,
            authors: [authorName],
            language: "en",
            publisher: book.publisher || "Publisher",
            description: book.description,
            isbn: book.isbn,
            format: isPdf ? "pdf" : "epub",
            total_pages_or_spines: toc.length,
          },
          toc,
          total_pages_or_spines: toc.length,
          capabilities: {
            supports_reflow: !isPdf,
            supports_fixed_layout: isPdf,
            supports_cfi: !isPdf,
            supports_page_coordinates: isPdf,
            supports_embedded_fonts: true,
            supports_text_extraction: true,
          },
          initial_progress: {
            book_id: book.id,
            progress_percentage: book.id === "book_great_gatsby" ? 0.66 : book.id === "book_meditations" ? 0.15 : 0.75,
            current_locator: book.id === "book_meditations" ? "epubcfi(/6/4!/4/6:0)" : "epubcfi(/6/6!/4/1:0)",
            current_chapter_title: book.id === "book_meditations" ? "Book Two" : book.id === "book_great_gatsby" ? "Chapter III" : "Chapter 1",
            current_page_number: 1,
            total_pages: toc.length,
            last_read_at: new Date().toISOString(),
            sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
          },
          annotations: this.mockStore.annotations.filter((a) => a.book_id === bookId),
          bookmarks: this.mockStore.bookmarks.filter((b) => b.book_id === bookId),
        };
      }
    );
  }

  async getReaderChapter(bookId: string, spineIndex: number): Promise<ChapterContent> {
    return this._call(
      "get_reader_chapter",
      { bookId, spineIndex },
      () => {
        if (bookId === "book_great_gatsby") {
          return {
            spine_index: spineIndex,
            id: `gatsby_ch_${spineIndex + 1}`,
            title: `Chapter ${["I", "II", "III", "IV", "V"][spineIndex] || spineIndex + 1}`,
            href: `text/ch${spineIndex + 1}.xhtml`,
            html_content: this.mockStore.chapterHtml.gatsby || GATSBY_CHAPTER_3_HTML,
            text_content: "Chapter III. There was music from my neighbor's house through the summer nights. In his blue gardens men and girls came and went like moths among the whisperings and the champagne and the stars.",
          };
        }

        if (bookId === "book_meditations") {
          return {
            spine_index: spineIndex,
            id: `meditations_book_${spineIndex + 1}`,
            title: `Book ${["One", "Two", "Three", "Four", "Five"][spineIndex] || spineIndex + 1}`,
            href: `text/book${spineIndex + 1}.xhtml`,
            html_content: this.mockStore.chapterHtml.meditations || MEDITATIONS_BOOK_2_HTML,
            text_content: "Book Two. Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. The third then is the ruling part: consider thus: Thou art an old man.",
          };
        }

        return {
          spine_index: spineIndex,
          id: `ch_${spineIndex + 1}`,
          title: `The Architecture of Stillness`,
          href: `text/ch${spineIndex + 1}.xhtml`,
          html_content: this.mockStore.chapterHtml.gatsby || GATSBY_CHAPTER_3_HTML,
          text_content: "In this profound exploration of spatial dynamics within literature, the author examines how the physical environments constructed by modernist writers serve as vessels for silence and psychological depth.",
        };
      }
    );
  }

  async getReaderPdfPage(bookId: string, pageNumber: number): Promise<PdfPageData> {
    return this._call(
      "get_reader_pdf_page",
      { bookId, pageNumber },
      () => ({
        page_number: pageNumber,
        width_pt: 595.0,
        height_pt: 842.0,
        text_content: `PDF Page ${pageNumber} content for local reading. Annotation integrity remains preserved.`,
      })
    );
  }

  async getBookFileBytes(bookId: string, fileId?: string): Promise<Uint8Array> {
    return this._call(
      "get_book_file_bytes",
      { bookId, fileId },
      async () => {
        if (isTauri()) {
          const { invoke } = await import("@tauri-apps/api/core");
          const bytes = await invoke<number[]>("get_book_file_bytes", { bookId, fileId });
          return new Uint8Array(bytes);
        }
        return new Uint8Array();
      }
    );
  }

  async searchDocument(bookId: string, query: string): Promise<DocumentSearchMatch[]> {
    return this._call(
      "search_document",
      { bookId, query },
      () => {
        const q = query.toLowerCase();
        if ("annotation integrity".includes(q) || "architecture".includes(q) || "systems".includes(q)) {
          return [
            {
              spine_index: 0,
              chapter_title: "Chapter 1: The Principle of Architecture",
              locator: "epubcfi(/6/2!/4/100:0)",
              snippet: "...Annotation integrity is the cornerstone of any serious reading system...",
              match_char_offset: 120,
            },
          ];
        }
        return [];
      }
    );
  }

  async listBookmarks(bookId: string): Promise<Bookmark[]> {
    return this._call(
      "list_bookmarks",
      { bookId },
      () => this.mockStore.bookmarks.filter((b) => b.book_id === bookId)
    );
  }

  async createBookmark(
    bookId: string,
    locator: string,
    title?: string | null,
    chapterTitle?: string | null,
    pageNumber?: number | null
  ): Promise<Bookmark> {
    return this._call(
      "create_bookmark",
      { bookId, locator, title, chapterTitle, pageNumber },
      () => {
        const newBmk: Bookmark = {
          id: `bmk_${Date.now()}`,
          book_id: bookId,
          locator,
          title: title || null,
          chapter_title: chapterTitle || null,
          page_number: pageNumber || null,
          sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
        };
        this.mockStore.bookmarks.push(newBmk);
        return newBmk;
      }
    );
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    return this._call(
      "delete_bookmark",
      { bookmarkId },
      () => {
        this.mockStore.bookmarks = this.mockStore.bookmarks.filter((b) => b.id !== bookmarkId);
      }
    );
  }

  async listAnnotations(bookId: string): Promise<Annotation[]> {
    return this._call(
      "list_annotations",
      { bookId },
      () => this.mockStore.annotations.filter((a) => a.book_id === bookId)
    );
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    return this._call(
      "save_annotation",
      { annotation },
      () => {
        const idx = this.mockStore.annotations.findIndex((a) => a.id === annotation.id);
        if (idx >= 0) {
          this.mockStore.annotations[idx] = annotation;
        } else {
          this.mockStore.annotations.push(annotation);
        }
      }
    );
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    return this._call(
      "delete_annotation",
      { annotationId },
      () => {
        this.mockStore.annotations = this.mockStore.annotations.filter((a) => a.id !== annotationId);
      }
    );
  }

  async updateAnnotationNote(annotationId: string, note: string | null): Promise<void> {
    return this._call(
      "update_annotation_note",
      { annotationId, note },
      () => {
        const target = this.mockStore.annotations.find((a) => a.id === annotationId);
        if (target) {
          target.note = note;
          target.sync.updated_at = new Date().toISOString();
          target.sync.version += 1;
        }
      }
    );
  }

  async updateBookMetadata(
    bookId: string,
    metadata: {
      title: string;
      subtitle?: string | null;
      description?: string | null;
      publisher?: string | null;
      published_date?: string | null;
      language?: string | null;
      isbn?: string | null;
    }
  ): Promise<void> {
    return this._call(
      "update_book_metadata",
      { bookId, metadata },
      () => {
        const idx = this.mockStore.books.findIndex((b) => b.id === bookId);
        if (idx !== -1 && this.mockStore.books[idx]) {
          const b = this.mockStore.books[idx]!;
          this.mockStore.books[idx] = {
            ...b,
            ...metadata,
            sync: { ...b.sync, updated_at: new Date().toISOString(), version: b.sync.version + 1 },
          };
        }
      }
    );
  }

  async setReadingStatus(bookId: string, status: ReadingStatus): Promise<void> {
    return this._call(
      "set_reading_status",
      { bookId, status },
      () => {
        const idx = this.mockStore.books.findIndex((b) => b.id === bookId);
        if (idx !== -1 && this.mockStore.books[idx]) {
          this.mockStore.books[idx]!.reading_status = status;
        }
      }
    );
  }

  async trashBook(bookId: string): Promise<void> {
    return this._call(
      "trash_book",
      { bookId },
      () => {
        const idx = this.mockStore.books.findIndex((b) => b.id === bookId);
        if (idx !== -1 && this.mockStore.books[idx]) {
          this.mockStore.books[idx]!.library_state = "trashed";
          this.mockStore.books[idx]!.trashed_at = new Date().toISOString();
        }
      }
    );
  }

  async restoreBook(bookId: string): Promise<void> {
    return this._call(
      "restore_book",
      { bookId },
      () => {
        const idx = this.mockStore.books.findIndex((b) => b.id === bookId);
        if (idx !== -1 && this.mockStore.books[idx]) {
          this.mockStore.books[idx]!.library_state = "active";
          this.mockStore.books[idx]!.trashed_at = null;
        }
      }
    );
  }

  async deleteBookPermanently(bookId: string, deleteFiles: boolean): Promise<void> {
    return this._call(
      "delete_book_permanently",
      { bookId, deleteFiles },
      () => {
        const idx = this.mockStore.books.findIndex((b) => b.id === bookId);
        if (idx !== -1) {
          this.mockStore.books.splice(idx, 1);
        }
      }
    );
  }

  async pickImportFiles(): Promise<string[]> {
    return this._call(
      "pick_import_files",
      undefined,
      () => []
    );
  }

  async pickImportDirectory(): Promise<string | null> {
    return this._call(
      "pick_import_directory",
      undefined,
      () => null
    );
  }

  async importFileBytes(filename: string, data: Uint8Array): Promise<ImportJob> {
    return this._call(
      "import_file_bytes",
      { filename, data: Array.from(data) },
      () => this.importFiles([filename])
    );
  }

  async importFiles(filePaths: string[]): Promise<ImportJob> {
    return this._call(
      "import_files",
      { filePaths },
      () => {
        const newItems = filePaths.map((fp, i) => {
          const name = fp.split(/[\\/]/).pop() || `Imported Book ${this.mockStore.books.length + 1}`;
          const newBook: Book = {
            id: `book_mock_${Date.now()}_${i}`,
            title: name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "),
            subtitle: null,
            author_ids: [],
            series_id: null,
            series_index: null,
            description: "Locally imported digital publication.",
            publisher: "Independent",
            published_date: "2024",
            language: "en",
            isbn: null,
            cover_image_id: null,
            cover_image_path: null,
            primary_file_id: `file_mock_${Date.now()}_${i}`,
            reading_status: "unread",
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
          this.mockStore.books.push(newBook);
          return {
            source_path: fp,
            original_filename: name,
            status: "success" as const,
            book_id: newBook.id,
            file_id: newBook.primary_file_id,
            duplicate_level: "unrelated" as const,
            error_message: null,
          };
        });

        return {
          id: `job_${Date.now()}`,
          total_files: filePaths.length,
          completed_count: filePaths.length,
          failed_count: 0,
          skipped_count: 0,
          status: "completed" as const,
          items: newItems,
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
        };
      }
    );
  }

  async importDirectory(dirPath: string, recursive: boolean): Promise<ImportJob> {
    return this._call(
      "import_directory",
      { dirPath, recursive },
      () => this.importFiles([`${dirPath}/sample_epub.epub`, `${dirPath}/sample_pdf.pdf`])
    );
  }

  async listCollections(): Promise<Collection[]> {
    return this._call(
      "list_collections",
      undefined,
      () => this.mockStore.collections
    );
  }

  async createCollection(name: string, description?: string): Promise<Collection> {
    return this._call(
      "create_collection",
      { name, description },
      () => {
        const newCol: Collection = {
          id: `col_${Date.now()}`,
          name,
          description: description || null,
          book_ids: [],
          sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
        };
        this.mockStore.collections.push(newCol);
        return newCol;
      }
    );
  }

  async addBooksToCollection(collectionId: string, bookIds: string[]): Promise<void> {
    return this._call(
      "add_books_to_collection",
      { collectionId, bookIds },
      () => {
        const col = this.mockStore.collections.find((c) => c.id === collectionId);
        if (col) {
          for (const bid of bookIds) {
            if (!col.book_ids.includes(bid)) col.book_ids.push(bid);
          }
        }
      }
    );
  }

  async listTags(): Promise<Tag[]> {
    return this._call(
      "list_tags",
      undefined,
      () => this.mockStore.tags
    );
  }

  async addTagToBook(bookId: string, tagName: string): Promise<Tag> {
    return this._call(
      "add_tag_to_book",
      { bookId, tagName },
      () => {
        let tag = this.mockStore.tags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
        if (!tag) {
          tag = {
            id: `tag_${Date.now()}`,
            name: tagName,
            color_hex: "#38bdf8",
            sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
          };
          this.mockStore.tags.push(tag);
        }
        return tag;
      }
    );
  }

  async removeTagFromBook(bookId: string, tagId: string): Promise<void> {
    return this._call(
      "remove_tag_from_book",
      { bookId, tagId },
      () => {}
    );
  }

  async listAuthors(): Promise<Author[]> {
    return this._call(
      "list_authors",
      undefined,
      () => []
    );
  }

  async listSeries(): Promise<Series[]> {
    return this._call(
      "list_series",
      undefined,
      () => []
    );
  }

  async reconcileLibraryFiles(): Promise<number> {
    return this._call(
      "reconcile_library_files",
      undefined,
      () => 0
    );
  }

  async getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
    return this._call(
      "get_reading_progress",
      { bookId },
      () => null
    );
  }

  async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    return this._call(
      "save_reading_progress",
      { progress },
      () => {}
    );
  }

  async resolveAnchor(
    exact: string,
    prefix: string | null,
    suffix: string | null,
    documentText: string
  ): Promise<ResolutionResult> {
    return this._call(
      "resolve_anchor",
      { exact, prefix, suffix, documentText },
      () => {
        const idx = documentText.indexOf(exact);
        if (idx !== -1) {
          return {
            status: "highconfidence",
            data: {
              start_char: idx,
              end_char: idx + exact.length,
              matched_text: exact,
              confidence_score: 1.0,
              exact_text_matched: true,
              prefix_matched: true,
              suffix_matched: true,
              fuzzy_similarity: 1.0,
            },
          };
        }

        return {
          status: "failed",
          data: {
            reason: "Anchor text not found in document",
          },
        };
      }
    );
  }

  // Bulk Operations
  async bulkAddTags(bookIds: string[], tagNames: string[]): Promise<BulkOperationResult> {
    return this._call(
      "bulk_add_tags",
      { payload: { book_ids: bookIds, tag_names: tagNames } },
      () => {
        const count = bookIds.length * tagNames.length;
        return { total: count, successful: count, failed: 0 };
      }
    );
  }

  async bulkAddToCollection(collectionId: string, bookIds: string[]): Promise<BulkOperationResult> {
    return this._call(
      "bulk_add_to_collection",
      { payload: { collection_id: collectionId, book_ids: bookIds } },
      () => ({ total: bookIds.length, successful: bookIds.length, failed: 0 })
    );
  }

  async bulkTrashBooks(bookIds: string[]): Promise<BulkOperationResult> {
    return this._call(
      "bulk_trash_books",
      { bookIds },
      () => ({ total: bookIds.length, successful: bookIds.length, failed: 0 })
    );
  }

  async bulkSetReadingStatus(bookIds: string[], status: ReadingStatus): Promise<BulkOperationResult> {
    return this._call(
      "bulk_set_reading_status",
      { payload: { book_ids: bookIds, status } },
      () => ({ total: bookIds.length, successful: bookIds.length, failed: 0 })
    );
  }

  // Search
  async searchLibrary(query: string, bookIdFilter?: string | null, maxResults?: number): Promise<{ hits: DocumentSearchMatch[]; total_count: number; query_duration_ms: number }> {
    return this._call(
      "search_library",
      { query, bookIdFilter, maxResults },
      () => ({ hits: [], total_count: 0, query_duration_ms: 0 })
    );
  }

  // Settings
  async getSetting<T = unknown>(key: string): Promise<T | null> {
    return this._call(
      "get_setting",
      { key },
      () => {
        try {
          if (typeof localStorage !== "undefined") {
            const val = localStorage.getItem(`luma_setting_${key}`);
            if (val) return JSON.parse(val);
          }
        } catch {
          // ignore
        }
        return (this.mockStore.settings[key] as T) ?? null;
      }
    );
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    return this._call(
      "set_setting",
      { key, value },
      () => {
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(`luma_setting_${key}`, JSON.stringify(value));
          }
        } catch {
          // ignore
        }
        this.mockStore.settings[key] = value;
      }
    );
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    return this._call(
      "get_all_settings",
      undefined,
      () => ({ ...this.mockStore.settings })
    );
  }

  // Backup & Restore
  async createBackup(prefix?: string): Promise<BackupRecord> {
    return this._call(
      "create_backup",
      { prefix },
      () => {
        const pfx = prefix || "luma_backup";
        return {
          id: `backup_${Date.now()}`,
          backup_name: `${pfx}_${Date.now()}.luma-backup`,
          file_path: `/data/backups/${pfx}_${Date.now()}.luma-backup`,
          file_size_bytes: 1048576,
          sha256_hash: "mockhash",
          books_count: this.mockStore.books.length,
          annotations_count: this.mockStore.annotations.length,
          bookmarks_count: this.mockStore.bookmarks.length,
          created_at: new Date().toISOString(),
        };
      }
    );
  }

  async listBackups(): Promise<BackupRecord[]> {
    return this._call(
      "list_backups",
      undefined,
      () => []
    );
  }

  async inspectBackup(backupPath: string): Promise<BackupPreview> {
    return this._call(
      "inspect_backup",
      { backupPath },
      () => ({
        manifest: {
          version: 1,
          created_at: new Date().toISOString(),
          books_count: 5,
          annotations_count: 10,
          bookmarks_count: 3,
          settings_count: 2,
        },
        file_size_bytes: 1048576,
        sha256_hash: "mockhash",
      })
    );
  }

  async restoreBackup(backupPath: string): Promise<BackupManifest> {
    return this._call(
      "restore_backup",
      { backupPath },
      () => ({
        version: 1,
        created_at: new Date().toISOString(),
        books_count: 5,
        annotations_count: 10,
        bookmarks_count: 3,
        settings_count: 2,
      })
    );
  }

  // Maintenance
  async reconcileFiles(): Promise<MaintenanceResult> {
    return this._call(
      "maintenance_reconcile_files",
      undefined,
      () => ({ operation: "reconcile_files", items_processed: 0, duration_ms: 5, message: "OK" })
    );
  }

  async rebuildSearchIndex(): Promise<MaintenanceResult> {
    return this._call(
      "maintenance_rebuild_search_index",
      undefined,
      () => ({ operation: "rebuild_search_index", items_processed: this.mockStore.books.length, duration_ms: 10, message: "OK" })
    );
  }

  async cleanupCaches(): Promise<MaintenanceResult> {
    return this._call(
      "maintenance_cleanup_caches",
      undefined,
      () => ({ operation: "cleanup_caches", items_processed: 0, duration_ms: 2, message: "OK" })
    );
  }

  async vacuumDatabase(): Promise<MaintenanceResult> {
    return this._call(
      "maintenance_vacuum_database",
      undefined,
      () => ({ operation: "vacuum_database", items_processed: 1, duration_ms: 15, message: "OK" })
    );
  }

  async maintenanceReconcileFiles(): Promise<MaintenanceResult> {
    return this.reconcileFiles();
  }
  async maintenanceRebuildSearchIndex(): Promise<MaintenanceResult> {
    return this.rebuildSearchIndex();
  }
  async maintenanceCleanupCaches(): Promise<MaintenanceResult> {
    return this.cleanupCaches();
  }
  async maintenanceVacuumDatabase(): Promise<MaintenanceResult> {
    return this.vacuumDatabase();
  }

  // Diagnostics
  async runDiagnostics(): Promise<DiagnosticsReport> {
    return this._call(
      "run_diagnostics",
      undefined,
      () => ({
        overall_status: "healthy",
        timestamp: new Date().toISOString(),
        subsystems: [
          { name: "Database", status: "healthy", details: "Mock in-memory database" },
          { name: "Filesystem", status: "healthy", details: "Mock storage" },
          { name: "Search", status: "healthy", details: "Mock FTS5" },
          { name: "Cache", status: "healthy", details: "Mock cache" },
          { name: "Jobs", status: "healthy", details: "0 active" },
        ],
        metrics: { total_books: this.mockStore.books.length },
      })
    );
  }

  // Jobs
  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    return this._call(
      "get_job_progress",
      { jobId },
      () => null
    );
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return this._call(
      "cancel_job",
      { jobId },
      () => true
    );
  }

  async listRecentJobs(limit?: number): Promise<JobProgress[]> {
    return this._call(
      "list_recent_jobs",
      { limit },
      () => []
    );
  }

  // Event Listeners
  async onDomainEvent<T = unknown>(event: string, callback: (payload: T) => void): Promise<() => void> {
    if (this.isMock()) {
      return () => {};
    }
    try {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen<T>(event, (e) => callback(e.payload));
      return unlisten;
    } catch (err) {
      this.logger.error(`Failed to listen to event [${event}]:`, err);
      return () => {};
    }
  }

  async onJobProgress(callback: (progress: JobProgress) => void): Promise<() => void> {
    return this.onDomainEvent("luma://job/progress", callback);
  }

  async onBookImported(callback: (event: unknown) => void): Promise<() => void> {
    return this.onDomainEvent("luma://library/book-imported", callback);
  }

  async onReadingProgressChanged(callback: (event: unknown) => void): Promise<() => void> {
    return this.onDomainEvent("luma://reading/progress-changed", callback);
  }

  async onAnnotationChanged(callback: (event: unknown) => void): Promise<() => void> {
    return this.onDomainEvent("luma://annotation/changed", callback);
  }
}

// ============================================================================
// 5. Singleton Factory & Exports (100% Backward-Compatible)
// ============================================================================

let _instance: LumaApiClient | null = null;

export function createLumaApi(config?: LumaApiConfig): LumaApiClient {
  if (!_instance || config) {
    _instance = new LumaApiClient(config);
  }
  return _instance;
}

export function resetLumaApi(): void {
  _instance = null;
}

export const LumaApi = createLumaApi();
