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
} from "@luma/shared-types";

// In-memory mock store when Tauri IPC is not available in browser dev environment
const mockBooks: Book[] = [
  {
    id: "book_01918a23010170008000000000000001",
    title: "The Rust Programming Language",
    subtitle: "Covers Rust 2021 Edition",
    author_ids: [],
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
      deleted_at: null,
    },
  },
  {
    id: "book_01918a23010170008000000000000003",
    title: "Designing Data-Intensive Applications",
    subtitle: "The Big Ideas Behind Reliable, Scalable, and Maintainable Systems",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "An authoritative guide to data systems architecture, replication, partitioning, transactions, and consensus.",
    publisher: "O'Reilly Media",
    published_date: "2017-03-16",
    language: "en",
    isbn: "978-1449373320",
    cover_image_id: null,
    cover_image_path: null,
    primary_file_id: "file_01918a23010170008000000000000004",
    reading_status: "unread",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
      deleted_at: null,
    },
  },
];

let mockAnnotations: Annotation[] = [
  {
    id: "ann_01",
    book_id: "book_01918a23010170008000000000000001",
    annotation_type: "highlight",
    color_hex: "#38bdf8",
    quote: "Annotation integrity is the cornerstone of any serious reading system.",
    note: "P0 architectural differentiator for Luma.",
    anchor_payload_json: JSON.stringify({
      exact: "Annotation integrity is the cornerstone of any serious reading system.",
      prefix: "partitions occur without interruption. ",
      suffix: " If a highlight drifts",
      normalized_exact: "annotation integrity is the cornerstone of any serious reading system",
    }),
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
];

let mockBookmarks: Bookmark[] = [
  {
    id: "bmk_01",
    book_id: "book_01918a23010170008000000000000001",
    locator: "epubcfi(/6/4[ch1]!/4/2:0)",
    title: "Chapter 1: The Principle of Architecture",
    chapter_title: "Chapter 1",
    page_number: 1,
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
];

let mockCollections: Collection[] = [
  {
    id: "col_01",
    name: "Engineering & Architecture",
    description: "Core systems engineering books",
    book_ids: ["book_01918a23010170008000000000000001", "book_01918a23010170008000000000000003"],
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
];
let mockTags: Tag[] = [
  {
    id: "tag_01",
    name: "Systems",
    color_hex: "#38bdf8",
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
  {
    id: "tag_02",
    name: "Distributed",
    color_hex: "#a855f7",
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
];

const SAMPLE_CHAPTER_HTML = `
<div class="chapter-content">
  <h1 class="text-2xl font-bold mb-4">Chapter 1: The Principle of Architecture</h1>
  <p class="mb-4">In software engineering, local-first systems prioritize user ownership and data autonomy. When network partitions occur, the application continues to operate without interruption.</p>
  <p class="mb-4">Annotation integrity is the cornerstone of any serious reading system. If a highlight drifts or attaches to the wrong sentence after font changes, reader trust is permanently broken.</p>
  <p class="mb-4">Every highlight must maintain multiple anchor signals: exact text quote, surrounding prefix and suffix context, normalized character sequences, and format-specific coordinates.</p>
  <blockquote class="border-l-4 border-sky-500 pl-4 italic mb-4">"A reader that destroys annotations on reflow is not a reading system; it is merely an ephemeral document viewer."</blockquote>
  <p class="mb-4">By storing anchors independently of presentation states, Luma guarantees that annotations survive across devices, font choices, and window sizes.</p>
</div>
`;

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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
    return {
      book,
      files: [
        {
          id: book.primary_file_id ?? "file_01",
          book_id: book.id,
          original_filename: `${book.title.replace(/\s+/g, "_")}.epub`,
          relative_path: `library/${book.title.replace(/\s+/g, "_")}.epub`,
          canonical_path: `/Users/luma/Documents/${book.title}.epub`,
          format: "epub",
          mime_type: "application/epub+zip",
          file_size_bytes: 4829104,
          sha256_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          imported_at: book.sync.created_at,
          availability: "available",
        },
      ],
      authors: [
        {
          id: "auth_01",
          name: "Steve Klabnik & Carol Nichols",
          sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
        },
      ],
      series: null,
      tags: mockTags,
      collections: mockCollections.filter((c) => c.book_ids.includes(bookId)),
      reading_progress: {
        book_id: book.id,
        progress_percentage: 0.35,
        current_locator: "epubcfi(/6/4[chapter-1]!/4/2/10)",
        current_chapter_title: "Chapter 1: The Principle of Architecture",
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
    const book = mockBooks.find((b) => b.id === bookId) || mockBooks[0]!;
    return {
      book,
      file: {
        id: book.primary_file_id ?? "file_01",
        book_id: book.id,
        original_filename: `${book.title}.epub`,
        relative_path: `library/${book.title}.epub`,
        canonical_path: `/Users/luma/${book.title}.epub`,
        format: "epub",
        mime_type: "application/epub+zip",
        file_size_bytes: 3429104,
        sha256_hash: "mocksha256",
        imported_at: new Date().toISOString(),
        availability: "available",
      },
      metadata: {
        title: book.title,
        authors: ["Steve Klabnik", "Carol Nichols"],
        language: "en",
        publisher: "No Starch Press",
        description: book.description,
        isbn: book.isbn,
        format: "epub",
        total_pages_or_spines: 4,
      },
      toc: [
        { title: "Chapter 1: The Principle of Architecture", locator: "epubcfi(/6/2!/4/1:0)", play_order: 1, children: [] },
        { title: "Chapter 2: Data Autonomy & Sync", locator: "epubcfi(/6/4!/4/1:0)", play_order: 2, children: [] },
        { title: "Chapter 3: Resilient Annotation Anchoring", locator: "epubcfi(/6/6!/4/1:0)", play_order: 3, children: [] },
        { title: "Chapter 4: Conclusion & Knowledge Mesh", locator: "epubcfi(/6/8!/4/1:0)", play_order: 4, children: [] },
      ],
      total_pages_or_spines: 4,
      capabilities: {
        supports_reflow: true,
        supports_fixed_layout: false,
        supports_cfi: true,
        supports_page_coordinates: false,
        supports_embedded_fonts: true,
        supports_text_extraction: true,
      },
      initial_progress: {
        book_id: book.id,
        progress_percentage: 0.25,
        current_locator: "epubcfi(/6/2!/4/1:0)",
        current_chapter_title: "Chapter 1: The Principle of Architecture",
        current_page_number: 1,
        total_pages: 4,
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
    return {
      spine_index: spineIndex,
      id: `ch_${spineIndex + 1}`,
      title: `Chapter ${spineIndex + 1}: The Principle of Architecture`,
      href: `text/ch${spineIndex + 1}.xhtml`,
      html_content: SAMPLE_CHAPTER_HTML,
      text_content: "Chapter 1: The Principle of Architecture. In software engineering, local-first systems prioritize user ownership and data autonomy. Annotation integrity is the cornerstone of any serious reading system.",
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
    mockBookmarks = mockBookmarks.filter((b) => b.id !== bookmarkId);
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
    mockAnnotations = mockAnnotations.filter((a) => a.id !== annotationId);
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

  async setReadingStatus(bookId: string, status: string): Promise<void> {
    if (isTauri()) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke("set_reading_status", { bookId, status });
    }
    const idx = mockBooks.findIndex((b) => b.id === bookId);
    if (idx !== -1 && mockBooks[idx]) {
      mockBooks[idx]!.reading_status = status as any;
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
};
