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
} from "@luma/shared-types";

// In-memory mock store when Tauri IPC is not available in browser dev environment
const mockBooks: Book[] = [
  {
    id: "book_arch_stillness",
    title: "The Architecture of Stillness",
    subtitle: "Space and Silence in Modernist Literature",
    author_ids: [],
    series_id: null,
    series_index: null,
    description:
      "In this profound exploration of spatial dynamics within literature, the author examines how the physical environments constructed by modernist writers serve as vessels for silence and psychological depth. Drawing on architectural theory and literary analysis, the book offers a new perspective on the deliberate use of emptiness in narrative structure.",
    publisher: "Sanctuary Press",
    published_date: "2023-04-12",
    language: "en",
    isbn: "978-0143127741",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_arch_stillness",
    reading_status: "reading",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-10-15T10:00:00Z",
      updated_at: "2023-10-15T10:00:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_meditations",
    title: "Meditations",
    subtitle: "A New Translation with Introduction & Notes",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "Personal writings of the Roman Emperor Marcus Aurelius on Stoic philosophy, duty, resilience, and inner tranquility.",
    publisher: "Modern Library",
    published_date: "2003-05-06",
    language: "en",
    isbn: "978-0812968255",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_meditations",
    reading_status: "reading",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-10-12T08:30:00Z",
      updated_at: "2023-10-12T08:30:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_great_gatsby",
    title: "The Great Gatsby",
    subtitle: "The Authorized Edition",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "The classic American novel of the Jazz Age exploring ambition, illusion, wealth, and longing in 1920s Long Island.",
    publisher: "Scribner",
    published_date: "1925-04-10",
    language: "en",
    isbn: "978-0743273565",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_great_gatsby",
    reading_status: "reading",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-10-08T14:15:00Z",
      updated_at: "2023-10-08T14:15:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_foundation",
    title: "Foundation",
    subtitle: "The Foundation Series, Book 1",
    author_ids: [],
    series_id: "series_foundation",
    series_index: 1,
    description: "Hari Seldon discovers psychohistory and calculates that the Galactic Empire will soon fall into thirty thousand years of barbarism.",
    publisher: "Spectra",
    published_date: "1951-05-01",
    language: "en",
    isbn: "978-0553293357",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_foundation",
    reading_status: "completed",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-09-28T11:00:00Z",
      updated_at: "2023-09-28T11:00:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_design_everyday",
    title: "The Design of Everyday Things",
    subtitle: "Revised and Expanded Edition",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "The seminal work on cognitive engineering, user-centered design, and affordances by former Apple VP Don Norman.",
    publisher: "Basic Books",
    published_date: "2013-11-05",
    language: "en",
    isbn: "978-0465050659",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1507842229451-9f01079ca4b5?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_design_everyday",
    reading_status: "reading",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-09-15T09:40:00Z",
      updated_at: "2023-09-15T09:40:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_leaves_of_grass",
    title: "Leaves of Grass",
    subtitle: "The Original 1855 Edition",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "Walt Whitman's masterpiece celebrating democracy, nature, love, and the transcendent human spirit.",
    publisher: "Penguin Classics",
    published_date: "1855-07-04",
    language: "en",
    isbn: "978-0140421996",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1476275466078-4007374efbbe?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_leaves_grass",
    reading_status: "unread",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-09-02T16:20:00Z",
      updated_at: "2023-09-02T16:20:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_thinking_fast",
    title: "Thinking, Fast and Slow",
    subtitle: "Two Systems That Drive the Way We Think",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "Nobel laureate Daniel Kahneman's definitive exploration of human cognition, biases, and decision making.",
    publisher: "Farrar, Straus and Giroux",
    published_date: "2011-10-25",
    language: "en",
    isbn: "978-0374533557",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_thinking_fast",
    reading_status: "unread",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-08-20T10:00:00Z",
      updated_at: "2023-08-20T10:00:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_sapiens",
    title: "Sapiens",
    subtitle: "A Brief History of Humankind",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "100,000 years ago, at least six human species inhabited the earth. Today there is just one. Us. Homo sapiens.",
    publisher: "Harper",
    published_date: "2015-02-10",
    language: "en",
    isbn: "978-0062316097",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1532012164546-f432f2e3edd3?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_sapiens",
    reading_status: "unread",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-08-10T12:00:00Z",
      updated_at: "2023-08-10T12:00:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "book_poetics_of_space",
    title: "The Poetics of Space",
    subtitle: "The Classic Look at How We Experience Architecture",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "Gaston Bachelard's philosophical investigation into how our domestic intimate spaces shape our memories and imagination.",
    publisher: "Beacon Press",
    published_date: "1994-04-01",
    language: "en",
    isbn: "978-0807064733",
    cover_image_id: null,
    cover_image_path: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600&auto=format&fit=crop",
    primary_file_id: "file_poetics_space",
    reading_status: "unread",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: "2023-07-25T14:30:00Z",
      updated_at: "2023-07-25T14:30:00Z",
      device_id: "dev_01",
      is_deleted: false,
    },
  },
];

const BOOK_AUTHORS_MAP: Record<string, string> = {
  book_arch_stillness: "E. M. Forster",
  book_meditations: "Marcus Aurelius",
  book_great_gatsby: "F. Scott Fitzgerald",
  book_foundation: "Isaac Asimov",
  book_design_everyday: "Don Norman",
  book_leaves_of_grass: "Walt Whitman",
  book_thinking_fast: "Daniel Kahneman",
  book_sapiens: "Yuval Noah Harari",
  book_poetics_of_space: "Gaston Bachelard",
};

const GATSBY_CHAPTER_3_HTML = `
<div class="chapter-content max-w-xl mx-auto">
  <div class="text-[10px] font-bold text-[#78716C] tracking-widest text-center uppercase mb-1 font-mono">CHAPTER III</div>
  <h1 class="text-3xl font-serif font-bold text-center text-[#1C1917] mb-1">The Great Gatsby</h1>
  <p class="text-center text-xs italic text-[#57534E] mb-8 font-serif">by F. Scott Fitzgerald</p>
  
  <p class="mb-5 leading-relaxed text-[#292524]">
    <span class="drop-cap">T</span>here was music from my neighbor's house through the summer nights. In his blue gardens men and girls came and went like moths among the whisperings and the champagne and the stars. At high tide in the afternoon I watched his guests diving from the tower of his raft, or taking the sun on the hot sand of his beach while his two motor-boats slit the waters of the Sound, drawing aquaplanes over cataracts of foam. On week-ends his Rolls-Royce became an omnibus, bearing parties to and from the city between nine in the morning and long past midnight, while his station wagon scampered like a brisk yellow bug to meet all trains.
  </p>

  <p class="mb-5 leading-relaxed text-[#292524]">
    By seven o'clock the orchestra has arrived, no thin five-piece affair, but a whole pitful of oboes and trombones and saxophones and viols and cornets and piccolos, and low and high drums. The last swimmers have come in from the beach now and are dressing up stairs; the cars from New York are parked five deep in the drive, and already the halls and salons and verandas are gaudy with primary colors, and hair shorn in strange new ways, and shawls beyond the dreams of Castile.
  </p>

  <p class="mb-5 leading-relaxed text-[#292524]">
    I believe that on the first night I went to Gatsby's house I was one of the few guests who had actually been invited. People were not invited—they went there. They got into automobiles which bore them out to Long Island, and somehow they ended up at Gatsby's door. Once there they were introduced by somebody who knew Gatsby, and after that they conducted themselves according to the rules of behavior associated with an amusement park.
  </p>

  <p class="mb-5 leading-relaxed text-[#292524]">
    Sometimes they came and went without having met Gatsby at all, came for the party with a simplicity of heart that was its own ticket of admission. <span class="reader-highlight">A chauffeur in a uniform of robin's-egg blue crossed my lawn early that Saturday morning with a surprisingly formal note from his employer:</span> the honor would be entirely Gatsby's, it said, if I would attend his "little party" that night.
  </p>

  <p class="mb-5 leading-relaxed text-[#292524]">
    He had seen me several times, and had intended to call on me long before, but a peculiar nervousness, or rather a dignity that gave him poise, had held him back.
  </p>
</div>
`;

const MEDITATIONS_BOOK_2_HTML = `
<div class="chapter-content max-w-xl mx-auto">
  <div class="text-[10px] font-bold text-[#78716C] tracking-widest text-center uppercase mb-1 font-mono">BOOK TWO</div>
  <h1 class="text-3xl font-serif font-bold text-center mb-10 text-[#1C1917]">Meditations</h1>

  <p class="mb-6 leading-relaxed text-[#292524]">
    <span class="drop-cap">B</span>egin the morning by saying to thyself, I shall meet with the busy-body, the ungrateful, arrogant, deceitful, envious, unsocial. All these things happen to them by reason of their ignorance of what is good and evil. But I who have seen the nature of the good that it is beautiful, and of the bad that it is ugly, and the nature of him who does wrong, that it is akin to me, not only of the same blood or seed, but that it participates in the same intelligence and the same portion of the divinity, I can neither be injured by any of them, for no one can fix on me what is ugly, nor can I be angry with my kinsman, nor hate him.
  </p>

  <p class="mb-6 leading-relaxed text-[#292524]">
    For we are made for co-operation, like feet, like hands, like eyelids, like the rows of the upper and lower teeth. To act against one another then is contrary to nature; and it is acting against one another to be vexed and to turn away.
  </p>

  <p class="mb-6 leading-relaxed text-[#292524]">
    <span class="reader-highlight">Whatever this is that I am, it is a little flesh and breath, and the ruling part.</span>
  </p>

  <p class="mb-6 leading-relaxed text-[#292524]">
    Throw away thy books; no longer distract thyself: it is not allowed; but as if thou wast now dying, despise the flesh; it is blood and bones and a network, a contexture of nerves, veins, and arteries. See the breath also, what kind of a thing it is, air, and not always the same, but every moment sent out and again sucked in. The third then is the ruling part: consider thus: Thou art an old man; no longer let this be a slave, no longer be pulled by the strings like a puppet to unsocial movements, no longer either be dissatisfied with thy present lot, or shrink from the future.
  </p>
</div>
`;

let mockAnnotations: Annotation[] = [
  {
    id: "ann_01",
    book_id: "book_meditations",
    annotation_type: "highlight",
    color_hex: "#FDE68A",
    quote: "The third then is the ruling part: consider thus: Thou art an old",
    note: "Key Stoic reflection on the ruling center of consciousness.",
    anchor_payload_json: JSON.stringify({
      exact: "The third then is the ruling part: consider thus: Thou art an old",
      prefix: "sent out and again sucked in. ",
      suffix: " man; no longer let this be a slave",
      normalized_exact: "the third then is the ruling part consider thus thou art an old",
      spine_index: 1,
    }),
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
];

let mockBookmarks: Bookmark[] = [
  {
    id: "bmk_01",
    book_id: "book_meditations",
    locator: "epubcfi(/6/4!/4/6:0)",
    title: "Book Two: Section 3",
    chapter_title: "Book Two",
    page_number: 2,
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
];

const mockCollections: Collection[] = [
  {
    id: "col_01",
    name: "Modernist Classics",
    description: "20th century literature and architectural philosophy",
    book_ids: ["book_arch_stillness", "book_great_gatsby", "book_poetics_of_space"],
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "col_02",
    name: "Philosophy & Mind",
    description: "Stoicism, psychology, and cognitive science",
    book_ids: ["book_meditations", "book_thinking_fast", "book_design_everyday"],
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
];

const mockTags: Tag[] = [
  {
    id: "tag_01",
    name: "Philosophy",
    color_hex: "#FDE68A",
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
  {
    id: "tag_02",
    name: "Classics",
    color_hex: "#BAE6FD",
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
  {
    id: "tag_03",
    name: "Design",
    color_hex: "#A7F3D0",
    sync: { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), device_id: "dev_01", is_deleted: false },
  },
];

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
