export type DocumentFormat = "epub" | "pdf";

export type AnnotationType = "highlight" | "underline" | "note" | "bookmark";

export interface SyncMetadata {
  version: number;
  created_at: string;
  updated_at: string;
  device_id: string;
  is_deleted: boolean;
  deleted_at?: string | null;
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
  cover_image_path?: string | null;
  primary_file_id?: string | null;
  sync: SyncMetadata;
}

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
