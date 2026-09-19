import {
  Annotation,
  Author,
  Book,
  BookFile,
  Bookmark,
  ChapterContent,
  Collection,
  Tag,
} from "@luma/shared-types";

/**
 * Synthetic records for tests and the browser integration harness.
 *
 * This module lives under `src/testing/` on purpose: it is test data, not
 * product content. Production modules must never import it — the
 * `no-restricted-imports` lint rule and the dynamic-data fitness test both
 * enforce that boundary.
 *
 * The records are deliberately generic. Nothing here should ever look like a
 * real book the user might own, so that a fixture can never be mistaken for
 * application data in a screenshot or a bug report.
 */

export const FIXTURE_DEVICE_ID = "device_fixture";

const sync = (createdAt: string) => ({
  version: 1,
  created_at: createdAt,
  updated_at: createdAt,
  device_id: FIXTURE_DEVICE_ID,
  is_deleted: false,
});

export const fixtureAuthors: Author[] = [
  {
    id: "author_fixture_alpha",
    name: "Fixture Author Alpha",
    sync: sync("2024-01-01T00:00:00.000Z"),
  },
];

export const fixtureBooks: Book[] = [
  {
    id: "book_fixture_alpha",
    title: "Fixture Reader Alpha",
    subtitle: "A synthetic EPUB for pipeline tests",
    author_ids: ["author_fixture_alpha"],
    series_id: null,
    series_index: null,
    description: "Synthetic reflowable document used by automated tests.",
    publisher: "Fixture Press",
    published_date: "2024-01-01",
    language: "en",
    isbn: null,
    cover_image_id: null,
    cover_image_path: null,
    primary_file_id: "file_fixture_alpha",
    reading_status: "reading",
    library_state: "active",
    trashed_at: null,
    sync: sync("2024-01-01T00:00:00.000Z"),
  },
  {
    id: "book_fixture_beta",
    title: "Fixture Reader Beta",
    subtitle: "A synthetic PDF for pipeline tests",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "Synthetic fixed-layout document used by automated tests.",
    publisher: null,
    published_date: null,
    language: "en",
    isbn: null,
    cover_image_id: null,
    cover_image_path: null,
    primary_file_id: "file_fixture_beta",
    reading_status: "unread",
    library_state: "active",
    trashed_at: null,
    sync: sync("2024-01-02T00:00:00.000Z"),
  },
];

export const fixtureFiles: BookFile[] = [
  {
    id: "file_fixture_alpha",
    book_id: "book_fixture_alpha",
    original_filename: "fixture_alpha.epub",
    relative_path: "library/fixture_alpha.epub",
    canonical_path: null,
    format: "epub",
    mime_type: "application/epub+zip",
    file_size_bytes: 1024,
    sha256_hash: "fixture-alpha-hash",
    imported_at: "2024-01-01T00:00:00.000Z",
    modified_at: null,
    availability: "available",
  },
  {
    id: "file_fixture_beta",
    book_id: "book_fixture_beta",
    original_filename: "fixture_beta.pdf",
    relative_path: "library/fixture_beta.pdf",
    canonical_path: null,
    format: "pdf",
    mime_type: "application/pdf",
    file_size_bytes: 2048,
    sha256_hash: "fixture-beta-hash",
    imported_at: "2024-01-02T00:00:00.000Z",
    modified_at: null,
    availability: "available",
  },
];

/** Keyed `${bookId}:${spineIndex}`. */
export const fixtureChapters: Record<string, ChapterContent> = {
  "book_fixture_alpha:0": {
    spine_index: 0,
    id: "fixture_alpha_ch0",
    title: "First Synthetic Section",
    href: "text/section-1.xhtml",
    html_content:
      "<section><h1>First Synthetic Section</h1><p>annotation integrity is the property under test in this synthetic document.</p></section>",
    text_content:
      "First Synthetic Section. annotation integrity is the property under test in this synthetic document.",
  },
  "book_fixture_alpha:1": {
    spine_index: 1,
    id: "fixture_alpha_ch1",
    title: "Second Synthetic Section",
    href: "text/section-2.xhtml",
    html_content:
      "<section><h1>Second Synthetic Section</h1><p>A second synthetic paragraph with no special properties.</p></section>",
    text_content:
      "Second Synthetic Section. A second synthetic paragraph with no special properties.",
  },
};

export const fixtureAnnotations: Annotation[] = [
  {
    id: "annotation_fixture_alpha",
    book_id: "book_fixture_alpha",
    annotation_type: "highlight",
    color_hex: "#F2C14E",
    quote: "annotation integrity",
    note: null,
    anchor_payload_json: JSON.stringify({
      locator: "epubcfi(/6/2!/4/2:0)",
      chapter_title: "First Synthetic Section",
    }),
    sync: sync("2024-01-03T00:00:00.000Z"),
  },
];

export const fixtureBookmarks: Bookmark[] = [
  {
    id: "bookmark_fixture_alpha",
    book_id: "book_fixture_alpha",
    locator: "epubcfi(/6/4!/4/2:0)",
    title: "Fixture bookmark",
    chapter_title: "Second Synthetic Section",
    page_number: null,
    sync: sync("2024-01-03T00:00:00.000Z"),
  },
];

export const fixtureTags: Tag[] = [
  {
    id: "tag_fixture",
    name: "Fixture Tag",
    sync: sync("2024-01-01T00:00:00.000Z"),
  },
];

export const fixtureCollections: Collection[] = [
  {
    id: "collection_fixture",
    name: "Fixture Collection",
    description: "Synthetic collection used by automated tests.",
    book_ids: ["book_fixture_alpha"],
    sync: sync("2024-01-01T00:00:00.000Z"),
  },
];

export const fixtureSettings: Record<string, unknown> = {
  reader_font_size: 18,
};

export const fixtureReadingProgress = [
  {
    book_id: "book_fixture_alpha",
    progress_percentage: 0.4,
    current_locator: "epubcfi(/6/4!/4/2:0)",
    current_chapter_title: "Second Synthetic Section",
    current_page_number: 1,
    total_pages: 2,
    last_read_at: "2024-01-04T00:00:00.000Z",
    sync: sync("2024-01-04T00:00:00.000Z"),
  },
];
