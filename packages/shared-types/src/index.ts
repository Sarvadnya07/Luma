export type DocumentFormat = "epub" | "pdf" | "cbz" | "cbr" | "txt" | "md" | "html";

export type ReadingStatus = "unread" | "reading" | "completed" | "archived";

export type LibraryState = "active" | "archived" | "trashed";

export type FileAvailability = "available" | "missing" | "changed" | "invalid";

export type DuplicateMatchLevel = "exact_duplicate" | "likely_duplicate" | "possible_duplicate" | "unrelated";

export type ImportJobStatus = "queued" | "processing" | "completed" | "partial_success" | "failed" | "cancelled";

export type ReaderTheme = "dark" | "light" | "sepia" | "eink" | "paper";

export type ReaderLayoutMode = "paginated" | "scroll";

export interface ReaderSettings {
  theme: ReaderTheme;
  fontSize: number;
  fontFamily: "serif" | "sans" | "mono";
  lineHeight: number;
  marginHorizontal: number;
  layoutMode: ReaderLayoutMode;
  twoColumn: boolean;
}

export interface SyncMetadata {
  version: number;
  created_at: string;
  updated_at: string;
  device_id: string;
  is_deleted: boolean;
  deleted_at?: string | null;
}

export interface BookFile {
  id: string;
  book_id: string;
  original_filename: string;
  relative_path: string;
  canonical_path?: string | null;
  format: DocumentFormat;
  mime_type?: string | null;
  file_size_bytes: number;
  sha256_hash: string;
  imported_at: string;
  modified_at?: string | null;
  availability: FileAvailability;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string | null;
  author_ids: string[];
  series_id?: string | null;
  series_index?: number | null;
  description?: string | null;
  publisher?: string | null;
  published_date?: string | null;
  language?: string | null;
  isbn?: string | null;
  cover_image_id?: string | null;
  cover_image_path?: string | null;
  primary_file_id?: string | null;
  reading_status: ReadingStatus;
  library_state: LibraryState;
  trashed_at?: string | null;
  sync: SyncMetadata;
}

export interface Author {
  id: string;
  name: string;
  sort_name?: string | null;
  sync: SyncMetadata;
}

export interface Series {
  id: string;
  title: string;
  description?: string | null;
  sync: SyncMetadata;
}

export interface Tag {
  id: string;
  name: string;
  color_hex?: string | null;
  sync: SyncMetadata;
}

export interface Collection {
  id: string;
  name: string;
  description?: string | null;
  book_ids: string[];
  sync: SyncMetadata;
}

export interface CoverImage {
  id: string;
  book_id?: string | null;
  file_size_bytes: number;
  sha256_hash: string;
  mime_type: string;
  relative_path: string;
  width?: number | null;
  height?: number | null;
  created_at: string;
}

export interface DuplicateAssessment {
  level: DuplicateMatchLevel;
  existing_book_id?: string | null;
  existing_file_id?: string | null;
  confidence_score: number;
  reason: string;
}

export interface ImportJobItem {
  source_path: string;
  original_filename: string;
  status: string;
  book_id?: string | null;
  file_id?: string | null;
  duplicate_level?: DuplicateMatchLevel | null;
  error_message?: string | null;
}

export interface ImportJob {
  id: string;
  total_files: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  status: ImportJobStatus;
  items: ImportJobItem[];
  started_at: string;
  ended_at?: string | null;
}

export interface LibraryFilterOptions {
  search_query?: string | null;
  format?: DocumentFormat | null;
  reading_status?: ReadingStatus | null;
  library_state?: LibraryState | null;
  author_id?: string | null;
  series_id?: string | null;
  tag_id?: string | null;
  collection_id?: string | null;
}

export type LibrarySortBy = "title" | "author" | "created_at" | "last_read_at" | "published_date" | "file_size";

export interface LibrarySortOptions {
  sort_by: LibrarySortBy;
  ascending: boolean;
}

export interface BookDetailViewData {
  book: Book;
  files: BookFile[];
  authors: Author[];
  series?: Series | null;
  tags: Tag[];
  collections: Collection[];
  reading_progress?: ReadingProgress | null;
}

export interface TocItem {
  title: string;
  locator: string;
  play_order?: number | null;
  children: TocItem[];
}

export interface DocumentMetadata {
  title: string;
  authors: string[];
  language?: string | null;
  publisher?: string | null;
  description?: string | null;
  isbn?: string | null;
  format: DocumentFormat;
  total_pages_or_spines?: number | null;
}

export interface FormatCapabilities {
  supports_reflow: bool;
  supports_fixed_layout: bool;
  supports_cfi: bool;
  supports_page_coordinates: bool;
  supports_embedded_fonts: bool;
  supports_text_extraction: bool;
}

type bool = boolean;

export interface SpineItem {
  id: string;
  href: string;
  media_type: string;
  linear: boolean;
}

export interface ChapterContent {
  spine_index: number;
  id: string;
  title: string;
  href: string;
  html_content: string;
  text_content: string;
}

export interface PdfPageData {
  page_number: number;
  width_pt: number;
  height_pt: number;
  text_content: string;
  has_text_layer?: boolean;
}


export interface DocumentSearchMatch {
  spine_index: number;
  chapter_title: string;
  locator: string;
  snippet: string;
  match_char_offset: number;
}

export interface OpenDocumentResult {
  book: Book;
  file: BookFile;
  metadata: DocumentMetadata;
  toc: TocItem[];
  total_pages_or_spines: number;
  capabilities: FormatCapabilities;
  initial_progress?: ReadingProgress | null;
}

export interface Bookmark {
  id: string;
  book_id: string;
  locator: string;
  title?: string | null;
  chapter_title?: string | null;
  page_number?: number | null;
  sync: SyncMetadata;
}

export type AnnotationType = "highlight" | "underline" | "note" | "bookmark";

export interface TextQuoteAnchor {
  exact: string;
  prefix?: string | null;
  suffix?: string | null;
  normalized_exact: string;
}

export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfLocator {
  page_number: number;
  rects: PdfRect[];
}

export interface EpubCfiLocator {
  cfi: string;
  spine_index: number;
}

export interface CompositeAnchor {
  format_locator?:
    | { format: "epub"; data: EpubCfiLocator }
    | { format: "pdf"; data: PdfLocator }
    | { format: "generictextoffset"; data: { start_char: number; end_char: number } };
  quote_anchor: TextQuoteAnchor;
  chapter_content_hash?: string | null;
  document_checksum?: string | null;
}

export interface Annotation {
  id: string;
  book_id: string;
  annotation_type: AnnotationType;
  color_hex: string;
  quote: string;
  note?: string | null;
  anchor_payload_json: string;
  sync: SyncMetadata;
}

export interface ReadingProgress {
  book_id: string;
  progress_percentage: number;
  current_locator: string;
  current_chapter_title?: string | null;
  current_page_number?: number | null;
  total_pages?: number | null;
  last_read_at: string;
  sync: SyncMetadata;
}

export interface MatchCandidate {
  start_char: number;
  end_char: number;
  matched_text: string;
  confidence_score: number;
  exact_text_matched: boolean;
  prefix_matched: boolean;
  suffix_matched: boolean;
  fuzzy_similarity: number;
}

export type ResolutionResult =
  | { status: "highconfidence"; data: MatchCandidate }
  | { status: "ambiguous"; data: { candidates: MatchCandidate[]; highest_score: number } }
  | { status: "failed"; data: { best_candidate?: MatchCandidate | null; reason: string } };

export interface BackendError {
  code: string;
  category: string;
  message: string;
  retryable: boolean;
  details?: string | null;
}

export interface BulkOperationResult {
  total: number;
  successful: number;
  failed: number;
}

export type JobStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface JobProgress {
  job_id: string;
  job_type: string;
  stage: string;
  current: number;
  total: number;
  percent: number;
  message?: string | null;
  status: JobStatus;
}

export interface BackupRecord {
  id: string;
  backup_name: string;
  file_path: string;
  file_size_bytes: number;
  sha256_hash: string;
  books_count: number;
  annotations_count: number;
  bookmarks_count: number;
  created_at: string;
}

export interface BackupManifest {
  version: number;
  created_at: string;
  books_count: number;
  annotations_count: number;
  bookmarks_count: number;
  settings_count: number;
}

export interface BackupPreview {
  manifest: BackupManifest;
  file_size_bytes: number;
  sha256_hash: string;
}

export interface MaintenanceResult {
  operation: string;
  items_processed: number;
  duration_ms: number;
  message: string;
}

export type HealthStatus = "healthy" | "degraded" | "failed" | "unavailable";

export interface SubsystemHealth {
  name: string;
  status: HealthStatus;
  details?: string | null;
}

export interface DiagnosticsReport {
  overall_status: HealthStatus;
  timestamp: string;
  subsystems: SubsystemHealth[];
  metrics: Record<string, unknown>;
}

