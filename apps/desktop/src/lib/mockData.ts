import {
  Book,
  Collection,
  Tag,
  Annotation,
  Bookmark,
} from "@luma/shared-types";

export const mockBooks: Book[] = [
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

export const BOOK_AUTHORS_MAP: Record<string, string> = {
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

export const GATSBY_CHAPTER_3_HTML = `
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

export const MEDITATIONS_BOOK_2_HTML = `
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

export const mockAnnotations: Annotation[] = [
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
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
];

export const mockBookmarks: Bookmark[] = [
  {
    id: "bmk_01",
    book_id: "book_meditations",
    locator: "epubcfi(/6/4!/4/6:0)",
    title: "Book Two: Section 3",
    chapter_title: "Book Two",
    page_number: 2,
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
];

export const mockCollections: Collection[] = [
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

export const mockTags: Tag[] = [
  {
    id: "tag_01",
    name: "Philosophy",
    color_hex: "#FDE68A",
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "tag_02",
    name: "Classics",
    color_hex: "#BAE6FD",
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
  {
    id: "tag_03",
    name: "Design",
    color_hex: "#A7F3D0",
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  },
];

export const mockSettings: Record<string, unknown> = {};

export function deleteMockBookmark(bookmarkId: string): void {
  const idx = mockBookmarks.findIndex((b) => b.id === bookmarkId);
  if (idx !== -1) {
    mockBookmarks.splice(idx, 1);
  }
}

export function deleteMockAnnotation(annotationId: string): void {
  const idx = mockAnnotations.findIndex((a) => a.id === annotationId);
  if (idx !== -1) {
    mockAnnotations.splice(idx, 1);
  }
}
