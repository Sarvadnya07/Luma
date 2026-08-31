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
  deleteMockAnnotation,
  deleteMockBookmark,
  BOOK_AUTHORS_MAP,
  GATSBY_CHAPTER_3_HTML,
  MEDITATIONS_BOOK_2_HTML,
} from "./mockData";

export const isTauri = () =>
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);


export const LumaApi = {

  async listBooks(filter?: LibraryFilterOptions, sort?: LibrarySortOptions, page?: number, pageSize?: number): Promise<Book[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Book[]>("list_books", { filter, sort, page, pageSize });
    }
    let res = [...mockBooks];
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
  },

  async getBookDetails(bookId: string): Promise<BookDetailViewData | null> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BookDetailViewData | null>("get_book_details", { bookId });
    }
    const book = mockBooks.find((b) => b.id === bookId);
    if (!book) return null;

    const authorName = BOOK_AUTHORS_MAP[book.id] || "Unknown Author";

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
      tags: mockTags,
      collections: mockCollections.filter((c) => c.book_ids.includes(bookId)),
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
  },

  async openReaderDocument(bookId: string, fileId?: string): Promise<OpenDocumentResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<OpenDocumentResult>("open_reader_document", { bookId, fileId });
    }
    const book = mockBooks.find((b) => b.id === bookId) || {
      id: bookId,
      title: bookId.startsWith("book_01918") ? "The Rust Programming Language" : mockBooks[0]!.title,
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
    const authorName = BOOK_AUTHORS_MAP[book.id] || "Unknown Author";

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
    };
  },

  async getReaderChapter(bookId: string, spineIndex: number): Promise<ChapterContent> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<ChapterContent>("get_reader_chapter", { bookId, spineIndex });
    }

    if (bookId === "book_great_gatsby") {
      return {
        spine_index: spineIndex,
        id: `gatsby_ch_${spineIndex + 1}`,
        title: `Chapter ${["I", "II", "III", "IV", "V"][spineIndex] || spineIndex + 1}`,
        href: `text/ch${spineIndex + 1}.xhtml`,
        html_content: GATSBY_CHAPTER_3_HTML,
        text_content: "Chapter III. There was music from my neighbor's house through the summer nights. In his blue gardens men and girls came and went like moths among the whisperings and the champagne and the stars.",
      };
    }

    if (bookId === "book_meditations") {
      return {
        spine_index: spineIndex,
        id: `meditations_book_${spineIndex + 1}`,
        title: `Book ${["One", "Two", "Three", "Four", "Five"][spineIndex] || spineIndex + 1}`,
        href: `text/book${spineIndex + 1}.xhtml`,
        html_content: MEDITATIONS_BOOK_2_HTML,
        text_content: "Book Two. Begin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. The third then is the ruling part: consider thus: Thou art an old man.",
      };
    }

    return {
      spine_index: spineIndex,
      id: `ch_${spineIndex + 1}`,
      title: `The Architecture of Stillness`,
      href: `text/ch${spineIndex + 1}.xhtml`,
      html_content: GATSBY_CHAPTER_3_HTML,
      text_content: "In this profound exploration of spatial dynamics within literature, the author examines how the physical environments constructed by modernist writers serve as vessels for silence and psychological depth.",
    };
  },

  async getReaderPdfPage(bookId: string, pageNumber: number): Promise<PdfPageData> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<PdfPageData>("get_reader_pdf_page", { bookId, pageNumber });
    }
    return {
      page_number: pageNumber,
      width_pt: 595.0,
      height_pt: 842.0,
      text_content: `PDF Page ${pageNumber} content for local reading. Annotation integrity remains preserved.`,
    };
  },

  async searchDocument(bookId: string, query: string): Promise<DocumentSearchMatch[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<DocumentSearchMatch[]>("search_document", { bookId, query });
    }
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
  },

  async listBookmarks(bookId: string): Promise<Bookmark[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Bookmark[]>("list_bookmarks", { bookId });
    }
    return mockBookmarks.filter((b) => b.book_id === bookId);
  },

  async createBookmark(
    bookId: string,
    locator: string,
    title?: string | null,
    chapterTitle?: string | null,
    pageNumber?: number | null
  ): Promise<Bookmark> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Bookmark>("create_bookmark", { bookId, locator, title, chapterTitle, pageNumber });
    }
    const newBmk: Bookmark = {
      id: `bmk_${Date.now()}`,
      book_id: bookId,
      locator,
      title: title || null,
      chapter_title: chapterTitle || null,
      page_number: pageNumber || null,
      sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
    };
    mockBookmarks.push(newBmk);
    return newBmk;
  },

  async deleteBookmark(bookmarkId: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("delete_bookmark", { bookmarkId });
    }
    deleteMockBookmark(bookmarkId);
  },

  async listAnnotations(bookId: string): Promise<Annotation[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Annotation[]>("list_annotations", { bookId });
    }
    return mockAnnotations.filter((a) => a.book_id === bookId);
  },

  async saveAnnotation(annotation: Annotation): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("save_annotation", { annotation });
    }
    const idx = mockAnnotations.findIndex((a) => a.id === annotation.id);
    if (idx >= 0) {
      mockAnnotations[idx] = annotation;
    } else {
      mockAnnotations.push(annotation);
    }
  },

  async deleteAnnotation(annotationId: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("delete_annotation", { annotationId });
    }
    deleteMockAnnotation(annotationId);
  },

  async updateAnnotationNote(annotationId: string, note: string | null): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("update_annotation_note", { annotationId, note });
    }
    const target = mockAnnotations.find((a) => a.id === annotationId);

    if (target) {
      target.note = note;
      target.sync.updated_at = new Date().toISOString();
      target.sync.version += 1;
    }
  },

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
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("update_book_metadata", { bookId, metadata });
    }
    const idx = mockBooks.findIndex((b) => b.id === bookId);
    if (idx !== -1 && mockBooks[idx]) {
      const b = mockBooks[idx]!;
      mockBooks[idx] = {
        ...b,
        ...metadata,
        sync: { ...b.sync, updated_at: new Date().toISOString(), version: b.sync.version + 1 },
      };
    }
  },

  async setReadingStatus(bookId: string, status: ReadingStatus): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("set_reading_status", { bookId, status });
    }
    const idx = mockBooks.findIndex((b) => b.id === bookId);
    if (idx !== -1 && mockBooks[idx]) {
      mockBooks[idx]!.reading_status = status;
    }
  },

  async trashBook(bookId: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("trash_book", { bookId });
    }
    const idx = mockBooks.findIndex((b) => b.id === bookId);
    if (idx !== -1 && mockBooks[idx]) {
      mockBooks[idx]!.library_state = "trashed";
      mockBooks[idx]!.trashed_at = new Date().toISOString();
    }
  },

  async restoreBook(bookId: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("restore_book", { bookId });
    }
    const idx = mockBooks.findIndex((b) => b.id === bookId);
    if (idx !== -1 && mockBooks[idx]) {
      mockBooks[idx]!.library_state = "active";
      mockBooks[idx]!.trashed_at = null;
    }
  },

  async deleteBookPermanently(bookId: string, deleteFiles: boolean): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("delete_book_permanently", { bookId, deleteFiles });
    }
    const idx = mockBooks.findIndex((b) => b.id === bookId);
    if (idx !== -1) {
      mockBooks.splice(idx, 1);
    }
  },

  async pickImportFiles(): Promise<string[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string[]>("pick_import_files");
    }
    return [];
  },

  async pickImportDirectory(): Promise<string | null> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string | null>("pick_import_directory");
    }
    return null;
  },

  async importFileBytes(filename: string, data: Uint8Array): Promise<ImportJob> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<ImportJob>("import_file_bytes", { filename, data: Array.from(data) });
    }
    return this.importFiles([filename]);
  },

  async importFiles(filePaths: string[]): Promise<ImportJob> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<ImportJob>("import_files", { filePaths });
    }
    const newItems = filePaths.map((fp, i) => {
      const name = fp.split(/[\\/]/).pop() || `Imported Book ${mockBooks.length + 1}`;
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
      mockBooks.push(newBook);
      return {
        source_path: fp,
        original_filename: name,
        status: "success",
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
      status: "completed",
      items: newItems,
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    };
  },

  async importDirectory(dirPath: string, recursive: boolean): Promise<ImportJob> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<ImportJob>("import_directory", { dirPath, recursive });
    }
    return this.importFiles([`${dirPath}/sample_epub.epub`, `${dirPath}/sample_pdf.pdf`]);
  },


  async listCollections(): Promise<Collection[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Collection[]>("list_collections");
    }
    return mockCollections;
  },

  async createCollection(name: string, description?: string): Promise<Collection> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Collection>("create_collection", { name, description });
    }
    const newCol: Collection = {
      id: `col_${Date.now()}`,
      name,
      description: description || null,
      book_ids: [],
      sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
    };
    mockCollections.push(newCol);
    return newCol;
  },

  async addBooksToCollection(collectionId: string, bookIds: string[]): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("add_books_to_collection", { collectionId, bookIds });
    }
    const col = mockCollections.find((c) => c.id === collectionId);
    if (col) {
      for (const bid of bookIds) {
        if (!col.book_ids.includes(bid)) col.book_ids.push(bid);
      }
    }
  },

  async listTags(): Promise<Tag[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Tag[]>("list_tags");
    }
    return mockTags;
  },

  async addTagToBook(bookId: string, tagName: string): Promise<Tag> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Tag>("add_tag_to_book", { bookId, tagName });
    }
    let tag = mockTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
    if (!tag) {
      tag = {
        id: `tag_${Date.now()}`,
        name: tagName,
        color_hex: "#38bdf8",
        sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
      };
      mockTags.push(tag);
    }
    return tag;
  },

  async removeTagFromBook(bookId: string, tagId: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("remove_tag_from_book", { bookId, tagId });
    }
  },

  async listAuthors(): Promise<Author[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Author[]>("list_authors");
    }
    return [];
  },

  async listSeries(): Promise<Series[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Series[]>("list_series");
    }
    return [];
  },

  async reconcileLibraryFiles(): Promise<number> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<number>("reconcile_library_files");
    }
    return 0;
  },

  async getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<ReadingProgress | null>("get_reading_progress", { bookId });
    }
    return null;
  },

  async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("save_reading_progress", { progress });
    }
  },

  async resolveAnchor(
    exact: string,
    prefix: string | null,
    suffix: string | null,
    documentText: string
  ): Promise<ResolutionResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<ResolutionResult>("resolve_anchor", {
        exact,
        prefix,
        suffix,
        documentText,
      });
    }

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
  },

  // Bulk Operations
  async bulkAddTags(bookIds: string[], tagNames: string[]): Promise<BulkOperationResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BulkOperationResult>("bulk_add_tags", { payload: { book_ids: bookIds, tag_names: tagNames } });
    }
    const count = bookIds.length * tagNames.length;
    return { total: count, successful: count, failed: 0 };
  },

  async bulkAddToCollection(collectionId: string, bookIds: string[]): Promise<BulkOperationResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BulkOperationResult>("bulk_add_to_collection", { payload: { collection_id: collectionId, book_ids: bookIds } });
    }
    return { total: bookIds.length, successful: bookIds.length, failed: 0 };
  },

  async bulkTrashBooks(bookIds: string[]): Promise<BulkOperationResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BulkOperationResult>("bulk_trash_books", { bookIds });
    }
    return { total: bookIds.length, successful: bookIds.length, failed: 0 };
  },

  async bulkSetReadingStatus(bookIds: string[], status: ReadingStatus): Promise<BulkOperationResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BulkOperationResult>("bulk_set_reading_status", { payload: { book_ids: bookIds, status } });
    }
    return { total: bookIds.length, successful: bookIds.length, failed: 0 };
  },

  // Search
  async searchLibrary(query: string, bookIdFilter?: string | null, maxResults?: number): Promise<{ hits: DocumentSearchMatch[]; total_count: number; query_duration_ms: number }> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("search_library", { query, bookIdFilter, maxResults });
    }
    return { hits: [], total_count: 0, query_duration_ms: 0 };
  },

  // Settings
  async getSetting<T = unknown>(key: string): Promise<T | null> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<T | null>("get_setting", { key });
    }
    try {
      if (typeof localStorage !== "undefined") {
        const val = localStorage.getItem(`luma_setting_${key}`);
        if (val) return JSON.parse(val);
      }
    } catch {
      // ignore
    }
    return (mockSettings[key] as T) ?? null;
  },

  async setSetting(key: string, value: unknown): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("set_setting", { key, value });
    }
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`luma_setting_${key}`, JSON.stringify(value));
      }
    } catch {
      // ignore
    }
    mockSettings[key] = value;
  },

  async getAllSettings(): Promise<Record<string, unknown>> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<Record<string, unknown>>("get_all_settings");
    }
    return { ...mockSettings };
  },

  // Backup & Restore
  async createBackup(prefix?: string): Promise<BackupRecord> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BackupRecord>("create_backup", { prefix });
    }
    const pfx = prefix || "luma_backup";
    return {
      id: `backup_${Date.now()}`,
      backup_name: `${pfx}_${Date.now()}.luma-backup`,
      file_path: `/data/backups/${pfx}_${Date.now()}.luma-backup`,
      file_size_bytes: 1048576,
      sha256_hash: "mockhash",
      books_count: mockBooks.length,
      annotations_count: mockAnnotations.length,
      bookmarks_count: mockBookmarks.length,
      created_at: new Date().toISOString(),
    };
  },


  async listBackups(): Promise<BackupRecord[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BackupRecord[]>("list_backups");
    }
    return [];
  },

  async inspectBackup(backupPath: string): Promise<BackupPreview> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BackupPreview>("inspect_backup", { backupPath });
    }
    return {
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
    };
  },

  async restoreBackup(backupPath: string): Promise<BackupManifest> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<BackupManifest>("restore_backup", { backupPath });
    }
    return {
      version: 1,
      created_at: new Date().toISOString(),
      books_count: 5,
      annotations_count: 10,
      bookmarks_count: 3,
      settings_count: 2,
    };
  },

  // Maintenance
  async reconcileFiles(): Promise<MaintenanceResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<MaintenanceResult>("maintenance_reconcile_files");
    }
    return { operation: "reconcile_files", items_processed: 0, duration_ms: 5, message: "OK" };
  },

  async rebuildSearchIndex(): Promise<MaintenanceResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<MaintenanceResult>("maintenance_rebuild_search_index");
    }
    return { operation: "rebuild_search_index", items_processed: mockBooks.length, duration_ms: 10, message: "OK" };
  },

  async cleanupCaches(): Promise<MaintenanceResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<MaintenanceResult>("maintenance_cleanup_caches");
    }
    return { operation: "cleanup_caches", items_processed: 0, duration_ms: 2, message: "OK" };
  },

  async vacuumDatabase(): Promise<MaintenanceResult> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<MaintenanceResult>("maintenance_vacuum_database");
    }
    return { operation: "vacuum_database", items_processed: 1, duration_ms: 15, message: "OK" };
  },

  // Diagnostics
  async runDiagnostics(): Promise<DiagnosticsReport> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<DiagnosticsReport>("run_diagnostics");
    }
    return {
      overall_status: "healthy",
      timestamp: new Date().toISOString(),
      subsystems: [
        { name: "Database", status: "healthy", details: "Mock in-memory database" },
        { name: "Filesystem", status: "healthy", details: "Mock storage" },
        { name: "Search", status: "healthy", details: "Mock FTS5" },
        { name: "Cache", status: "healthy", details: "Mock cache" },
        { name: "Jobs", status: "healthy", details: "0 active" },
      ],
      metrics: { total_books: mockBooks.length },
    };
  },

  // Jobs
  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<JobProgress | null>("get_job_progress", { jobId });
    }
    return null;
  },

  async cancelJob(jobId: string): Promise<boolean> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<boolean>("cancel_job", { jobId });
    }
    return true;
  },

  async listRecentJobs(limit?: number): Promise<JobProgress[]> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<JobProgress[]>("list_recent_jobs", { limit });
    }
    return [];
  },

  // Event Listeners
  async onDomainEvent<T = unknown>(event: string, callback: (payload: T) => void): Promise<() => void> {
    if (isTauri()) {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen<T>(event, (e) => callback(e.payload));
      return unlisten;
    }
    return () => {};
  },

  async onJobProgress(callback: (progress: JobProgress) => void): Promise<() => void> {
    return this.onDomainEvent("luma://job/progress", callback);
  },

  async onBookImported(callback: (event: unknown) => void): Promise<() => void> {
    return this.onDomainEvent("luma://library/book-imported", callback);
  },

  async onReadingProgressChanged(callback: (event: unknown) => void): Promise<() => void> {
    return this.onDomainEvent("luma://reading/progress-changed", callback);
  },

  async onAnnotationChanged(callback: (event: unknown) => void): Promise<() => void> {
    return this.onDomainEvent("luma://annotation/changed", callback);
  },
};
