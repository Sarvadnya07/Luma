import {
  Annotation,
  Author,
  BackupPreview,
  BackupRecord,
  Book,
  BookDetailViewData,
  BookFile,
  Bookmark,
  BulkOperationResult,
  ChapterContent,
  Collection,
  DiagnosticsReport,
  DocumentSearchMatch,
  Flashcard,
  ImportJob,
  LibraryFilterOptions,
  LibrarySortOptions,
  MaintenanceResult,
  Note,
  OpenDocumentResult,
  ReadingAnalytics,
  ReadingProgress,
  ReadingSession,
  ResolutionResult,
  StudyReview,
  Tag,
} from "@luma/shared-types";

import type { LumaTransport } from "../lib/tauri";
import {
  fixtureAnnotations,
  fixtureAuthors,
  fixtureBookmarks,
  fixtureBooks,
  fixtureChapters,
  fixtureCollections,
  fixtureFiles,
  fixtureReadingProgress,
  fixtureSettings,
  fixtureTags,
  FIXTURE_DEVICE_ID,
} from "./fixtures/libraryFixtures";

/**
 * An in-memory stand-in for the Rust data layer, for tests and harnesses.
 *
 * Only commands this backend genuinely implements are answered. Anything else
 * throws, so a test can never pass because a command silently returned nothing.
 * The backend holds no product content of its own: it starts from a caller's
 * seed (or nothing at all) and every record it returns was either seeded or
 * created by a command.
 */

export interface InMemoryLibraryState {
  books: Book[];
  files: BookFile[];
  authors: Author[];
  chapters: Record<string, ChapterContent>;
  annotations: Annotation[];
  bookmarks: Bookmark[];
  tags: Tag[];
  collections: Collection[];
  settings: Record<string, unknown>;
  notes: Note[];
  flashcards: Flashcard[];
  progress: ReadingProgress[];
  sessions: ReadingSession[];
}

export interface InMemoryLibraryBackend {
  transport: LumaTransport;
  state: InMemoryLibraryState;
  /** Replace the state with an explicit seed (or an empty store). */
  reset(seed?: Partial<InMemoryLibraryState>): void;
  /**
   * Deliver a domain event to subscribers, standing in for the desktop event
   * bridge. Lets a test prove that the UI refreshes when the data layer says
   * something changed (for example, an import triggered elsewhere).
   */
  emit<T = unknown>(event: string, payload?: T): void;
}

const now = () => new Date().toISOString();

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now()}_${++idCounter}`;

function emptyState(): InMemoryLibraryState {
  return {
    books: [],
    files: [],
    authors: [],
    chapters: {},
    annotations: [],
    bookmarks: [],
    tags: [],
    collections: [],
    settings: {},
    notes: [],
    flashcards: [],
    progress: [],
    sessions: [],
  };
}

/** The synthetic library used when a caller does not supply its own seed. */
export function fixtureState(): InMemoryLibraryState {
  return {
    ...emptyState(),
    books: structuredClone(fixtureBooks),
    files: structuredClone(fixtureFiles),
    authors: structuredClone(fixtureAuthors),
    chapters: structuredClone(fixtureChapters),
    annotations: structuredClone(fixtureAnnotations),
    bookmarks: structuredClone(fixtureBookmarks),
    tags: structuredClone(fixtureTags),
    collections: structuredClone(fixtureCollections),
    settings: { ...fixtureSettings },
    progress: structuredClone(fixtureReadingProgress),
  };
}

export function createInMemoryLibraryBackend(
  seed?: Partial<InMemoryLibraryState>
): InMemoryLibraryBackend {
  let state: InMemoryLibraryState = seed
    ? { ...emptyState(), ...seed }
    : fixtureState();

  const upsertById = <T extends { id: string }>(rows: T[], row: T) => {
    const idx = rows.findIndex((r) => r.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
  };

  const analytics = (): ReadingAnalytics => {
    const sessions = state.sessions.filter((s) => s.ended_at !== null);
    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklySeconds = sessions
      .filter((s) => new Date(s.ended_at as string).getTime() >= weekAgo)
      .reduce((sum, s) => sum + s.duration_seconds, 0);

    const byDate = new Map<string, number>();
    for (const session of sessions) {
      const date = (session.ended_at as string).substring(0, 10);
      byDate.set(date, (byDate.get(date) ?? 0) + session.duration_seconds / 60);
    }

    const days = Array.from({ length: 28 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (27 - i));
      const key = date.toISOString().substring(0, 10);
      const minutes = Math.round(byDate.get(key) ?? 0);
      return { date: key, minutes, intensity: Math.min(4, Math.ceil(minutes / 15)) };
    });

    const recent = sessions.slice(-10).map((s) => {
      const book = state.books.find((b) => b.id === s.book_id);
      const author = state.authors.find((a) => book?.author_ids.includes(a.id));
      return {
        session_id: s.id,
        book_id: s.book_id,
        book_title: book?.title ?? "",
        book_author: author?.name ?? "",
        duration_seconds: s.duration_seconds,
        end_progress_pct: s.end_progress_pct,
        ended_at: s.ended_at as string,
      };
    });

    return {
      total_reading_time_seconds: totalSeconds,
      weekly_reading_seconds: weeklySeconds,
      books_completed_count: state.books.filter((b) => b.reading_status === "completed").length,
      daily_reading_minutes_last_28_days: days,
      recent_sessions: recent,
      time_focus_data: days.slice(-6).map((d) => Math.min(100, d.minutes)),
    };
  };

  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  const transport: LumaTransport = {
    subscribe<T = unknown>(event: string, callback: (payload: T) => void): () => void {
      const forEvent = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      listeners.set(event, forEvent);
      forEvent.add(callback as (payload: unknown) => void);
      return () => {
        forEvent.delete(callback as (payload: unknown) => void);
        if (forEvent.size === 0) listeners.delete(event);
      };
    },
    async invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
      const a = (args ?? {}) as Record<string, unknown>;
      const result = (() => {
        switch (command) {
          // ---------------------------------------------------------------- Library
          case "list_books": {
            const filter = a.filter as LibraryFilterOptions | undefined;
            const sort = a.sort as LibrarySortOptions | undefined;
            let rows = state.books.filter(
              (b) => b.library_state === (filter?.library_state ?? "active")
            );
            if (filter?.reading_status) {
              rows = rows.filter((b) => b.reading_status === filter.reading_status);
            }
            if (filter?.format) {
              const ids = new Set(
                state.files.filter((f) => f.format === filter.format).map((f) => f.book_id)
              );
              rows = rows.filter((b) => ids.has(b.id));
            }
            if (filter?.search_query) {
              const q = filter.search_query.toLowerCase();
              rows = rows.filter((b) => b.title.toLowerCase().includes(q));
            }
            const sortBy = sort?.sort_by ?? "title";
            rows = [...rows].sort((x, y) => {
              if (sortBy === "created_at") {
                return (x.sync.created_at ?? "").localeCompare(y.sync.created_at ?? "");
              }
              if (sortBy === "published_date") {
                return (x.published_date ?? "").localeCompare(y.published_date ?? "");
              }
              if (sortBy === "file_size") {
                const sizeOf = (b: Book) =>
                  state.files.filter((f) => f.book_id === b.id).reduce((s, f) => s + f.file_size_bytes, 0);
                return sizeOf(x) - sizeOf(y);
              }
              return x.title.localeCompare(y.title);
            });
            if (sort && !sort.ascending) rows.reverse();
            const page = a.page as number | undefined;
            const pageSize = a.pageSize as number | undefined;
            if (page && pageSize) {
              rows = rows.slice((page - 1) * pageSize, page * pageSize);
            }
            return rows;
          }

          case "get_book_cover_data_url": {
            const book = state.books.find((b) => b.id === a.bookId);
            return book?.cover_image_path ?? null;
          }

          case "get_book_details": {
            const book = state.books.find((b) => b.id === a.bookId);
            if (!book) return null;
            const details: BookDetailViewData = {
              book,
              files: state.files.filter((f) => f.book_id === book.id),
              authors: state.authors.filter((author) => book.author_ids.includes(author.id)),
              series: null,
              tags: state.tags,
              collections: state.collections.filter((c) => c.book_ids.includes(book.id)),
              reading_progress: state.progress.find((p) => p.book_id === book.id) ?? null,
            };
            return details;
          }

          case "update_book_metadata": {
            const book = state.books.find((b) => b.id === a.bookId);
            if (!book) throw new Error(`Unknown book: ${a.bookId}`);
            Object.assign(book, a.metadata, {
              sync: { ...book.sync, updated_at: now(), version: book.sync.version + 1 },
            });
            return undefined;
          }

          case "set_reading_status": {
            const book = state.books.find((b) => b.id === a.bookId);
            if (!book) throw new Error(`Unknown book: ${a.bookId}`);
            book.reading_status = a.status as Book["reading_status"];
            return undefined;
          }

          case "trash_book": {
            const book = state.books.find((b) => b.id === a.bookId);
            if (!book) throw new Error(`Unknown book: ${a.bookId}`);
            book.library_state = "trashed";
            book.trashed_at = now();
            return undefined;
          }

          case "restore_book": {
            const book = state.books.find((b) => b.id === a.bookId);
            if (!book) throw new Error(`Unknown book: ${a.bookId}`);
            book.library_state = "active";
            book.trashed_at = null;
            return undefined;
          }

          case "delete_book_permanently": {
            state.books = state.books.filter((b) => b.id !== a.bookId);
            state.files = state.files.filter((f) => f.book_id !== a.bookId);
            state.annotations = state.annotations.filter((x) => x.book_id !== a.bookId);
            state.bookmarks = state.bookmarks.filter((x) => x.book_id !== a.bookId);
            state.progress = state.progress.filter((x) => x.book_id !== a.bookId);
            return undefined;
          }

          case "list_collections":
            return state.collections;

          case "create_collection": {
            const collection: Collection = {
              id: nextId("collection"),
              name: a.name as string,
              description: (a.description as string | undefined) ?? null,
              book_ids: [],
              sync: {
                version: 1,
                created_at: now(),
                updated_at: now(),
                device_id: FIXTURE_DEVICE_ID,
                is_deleted: false,
              },
            };
            state.collections.push(collection);
            return collection;
          }

          case "list_tags":
            return state.tags;

          case "list_authors":
            return state.authors;

          case "list_series":
            return [];

          case "add_tag_to_book": {
            const name = a.tagName as string;
            let tag = state.tags.find((t) => t.name === name);
            if (!tag) {
              tag = {
                id: nextId("tag"),
                name,
                sync: {
                  version: 1,
                  created_at: now(),
                  updated_at: now(),
                  device_id: FIXTURE_DEVICE_ID,
                  is_deleted: false,
                },
              };
              state.tags.push(tag);
            }
            return tag;
          }

          case "bulk_add_tags": {
            const payload = a.payload as { book_ids: string[]; tag_names: string[] };
            let successful = 0;
            let failed = 0;
            for (const bookId of payload.book_ids) {
              if (!state.books.some((b) => b.id === bookId)) {
                failed += payload.tag_names.length;
                continue;
              }
              for (const name of payload.tag_names) {
                if (!state.tags.some((t) => t.name === name)) {
                  state.tags.push({
                    id: nextId("tag"),
                    name,
                    sync: {
                      version: 1,
                      created_at: now(),
                      updated_at: now(),
                      device_id: FIXTURE_DEVICE_ID,
                      is_deleted: false,
                    },
                  });
                }
                successful += 1;
              }
            }
            const bulk: BulkOperationResult = {
              total: successful + failed,
              successful,
              failed,
            };
            return bulk;
          }

          // ------------------------------------------------------------- Reader
          case "open_reader_document": {
            const book = state.books.find((b) => b.id === a.bookId);
            const file = state.files.find(
              (f) => f.id === (a.fileId ?? book?.primary_file_id) && f.book_id === a.bookId
            );
            if (!book || !file) {
              throw new Error(`No stored document for book ${String(a.bookId)}`);
            }
            const chapters = Object.entries(state.chapters)
              .filter(([key]) => key.startsWith(`${book.id}:`))
              .map(([, chapter]) => chapter)
              .sort((x, y) => x.spine_index - y.spine_index);
            const isReflowable = file.format === "epub";
            const open: OpenDocumentResult = {
              book,
              file,
              metadata: {
                title: book.title,
                authors: state.authors.filter((author) => book.author_ids.includes(author.id)).map((author) => author.name),
                language: book.language,
                publisher: book.publisher,
                description: book.description,
                isbn: book.isbn,
                format: file.format,
                total_pages_or_spines: chapters.length,
              },
              toc: chapters.map((c) => ({
                title: c.title,
                locator: `spine:${c.spine_index}`,
                play_order: c.spine_index + 1,
                children: [],
              })),
              total_pages_or_spines: chapters.length,
              capabilities: {
                supports_reflow: isReflowable,
                supports_fixed_layout: !isReflowable,
                supports_cfi: isReflowable,
                supports_page_coordinates: !isReflowable,
                supports_embedded_fonts: isReflowable,
                supports_text_extraction: true,
              },
              initial_progress: state.progress.find((p) => p.book_id === book.id) ?? null,
              annotations: state.annotations.filter((x) => x.book_id === book.id),
              bookmarks: state.bookmarks.filter((x) => x.book_id === book.id),
            };
            return open;
          }

          case "get_reader_chapter": {
            const chapter = state.chapters[`${String(a.bookId)}:${String(a.spineIndex)}`];
            if (!chapter) {
              throw new Error(
                `No stored chapter at spine ${String(a.spineIndex)} for book ${String(a.bookId)}`
              );
            }
            return chapter;
          }

          case "search_document": {
            const query = String(a.query ?? "").toLowerCase();
            if (!query) return [];
            const matches: DocumentSearchMatch[] = [];
            for (const [key, chapter] of Object.entries(state.chapters)) {
              if (!key.startsWith(`${String(a.bookId)}:`)) continue;
              const text = chapter.text_content;
              const offset = text.toLowerCase().indexOf(query);
              if (offset === -1) continue;
              matches.push({
                spine_index: chapter.spine_index,
                chapter_title: chapter.title,
                locator: `spine:${chapter.spine_index}:${offset}`,
                snippet: text.substring(Math.max(0, offset - 30), offset + query.length + 30),
                match_char_offset: offset,
              });
            }
            return matches;
          }

          case "resolve_anchor": {
            // Mirrors the exact-match case of the core resolver; the in-memory
            // backend has no fuzzy or context-aware matching.
            const documentText = String(a.documentText ?? "");
            const exact = String(a.exact ?? "");
            const idx = documentText.indexOf(exact);
            const resolution: ResolutionResult =
              idx === -1
                ? { status: "failed", data: { reason: "Anchor text not found in document" } }
                : {
                    status: "highconfidence",
                    data: {
                      start_char: idx,
                      end_char: idx + exact.length,
                      matched_text: exact,
                      confidence_score: 1,
                      exact_text_matched: true,
                      prefix_matched: a.prefix === null || documentText.startsWith(String(a.prefix), idx - String(a.prefix).length),
                      suffix_matched: a.suffix === null || documentText.startsWith(String(a.suffix), idx + exact.length),
                      fuzzy_similarity: 1,
                    },
                  };
            return resolution;
          }

          case "list_bookmarks":
            return state.bookmarks.filter((b) => b.book_id === a.bookId);

          case "create_bookmark": {
            const bookmark: Bookmark = {
              id: nextId("bookmark"),
              book_id: a.bookId as string,
              locator: a.locator as string,
              title: (a.title as string | undefined) ?? null,
              chapter_title: (a.chapterTitle as string | undefined) ?? null,
              page_number: (a.pageNumber as number | undefined) ?? null,
              sync: {
                version: 1,
                created_at: now(),
                updated_at: now(),
                device_id: FIXTURE_DEVICE_ID,
                is_deleted: false,
              },
            };
            state.bookmarks.push(bookmark);
            return bookmark;
          }

          case "delete_bookmark":
            state.bookmarks = state.bookmarks.filter((b) => b.id !== a.bookmarkId);
            return undefined;

          case "list_annotations":
            return state.annotations.filter((x) => x.book_id === a.bookId);

          case "list_all_annotations":
            return state.annotations;

          case "save_annotation": {
            const annotation = a.annotation as Annotation;
            upsertById(state.annotations, annotation);
            return undefined;
          }

          case "delete_annotation":
            state.annotations = state.annotations.filter((x) => x.id !== a.annotationId);
            return undefined;

          case "update_annotation_note": {
            const annotation = state.annotations.find((x) => x.id === a.annotationId);
            if (annotation) annotation.note = (a.note as string | null) ?? null;
            return undefined;
          }

          case "get_reading_progress":
            return state.progress.find((p) => p.book_id === a.bookId) ?? null;

          case "save_reading_progress": {
            const progress = a.progress as ReadingProgress;
            const idx = state.progress.findIndex((p) => p.book_id === progress.book_id);
            if (idx >= 0) state.progress[idx] = progress;
            else state.progress.push(progress);
            return undefined;
          }

          // ------------------------------------------------------------- Import
          case "pick_import_files":
            // No native dialog in an in-memory backend.
            return [];

          case "pick_import_directory":
            return null;

          case "import_file_bytes": {
            const filename = String(a.filename ?? "unnamed");
            const bytes = (a.data as number[] | undefined) ?? [];
            const bookId = nextId("book");
            const fileId = nextId("file");
            const format = filename.split(".").pop() ?? "bin";
            const book: Book = {
              id: bookId,
              title: filename.replace(/\.[^.]+$/, ""),
              subtitle: null,
              author_ids: [],
              series_id: null,
              series_index: null,
              description: null,
              publisher: null,
              published_date: null,
              language: null,
              isbn: null,
              cover_image_id: null,
              cover_image_path: null,
              primary_file_id: fileId,
              reading_status: "unread",
              library_state: "active",
              trashed_at: null,
              sync: {
                version: 1,
                created_at: now(),
                updated_at: now(),
                device_id: FIXTURE_DEVICE_ID,
                is_deleted: false,
              },
            };
            const file: BookFile = {
              id: fileId,
              book_id: bookId,
              original_filename: filename,
              relative_path: `library/${filename}`,
              canonical_path: null,
              format: (["epub", "pdf", "cbz", "cbr", "txt", "md", "html"] as const).includes(
                format as never
              )
                ? (format as BookFile["format"])
                : "txt",
              mime_type: null,
              file_size_bytes: bytes.length,
              sha256_hash: `in-memory-${bytes.length}`,
              imported_at: now(),
              modified_at: null,
              availability: "available",
            };
            state.books.push(book);
            state.files.push(file);
            const job: ImportJob = {
              id: nextId("job"),
              total_files: 1,
              completed_count: 1,
              failed_count: 0,
              skipped_count: 0,
              status: "completed",
              items: [
                {
                  source_path: filename,
                  original_filename: filename,
                  status: "completed",
                  book_id: bookId,
                  file_id: fileId,
                  duplicate_level: null,
                  error_message: null,
                },
              ],
              started_at: now(),
              ended_at: now(),
            };
            return job;
          }

          // ----------------------------------------------------------- Settings
          case "get_setting":
            return (state.settings[String(a.key)] as unknown) ?? null;

          case "set_setting":
            state.settings[String(a.key)] = a.value;
            return undefined;

          case "get_all_settings":
            return { ...state.settings };

          // ----------------------------------------------------------- Backup
          case "create_backup": {
            const prefix = (a.prefix as string | undefined) ?? "backup";
            const record: BackupRecord = {
              id: nextId("backup"),
              backup_name: `${prefix}_${state.books.length}books`,
              file_path: `in-memory://${prefix}.zip`,
              file_size_bytes: 0,
              sha256_hash: "in-memory-backup",
              books_count: state.books.length,
              annotations_count: state.annotations.length,
              bookmarks_count: state.bookmarks.length,
              created_at: now(),
            };
            return record;
          }

          case "inspect_backup": {
            const preview: BackupPreview = {
              manifest: {
                version: 1,
                created_at: now(),
                books_count: state.books.length,
                annotations_count: state.annotations.length,
                bookmarks_count: state.bookmarks.length,
                settings_count: Object.keys(state.settings).length,
              },
              file_size_bytes: 0,
              sha256_hash: "in-memory-backup",
            };
            return preview;
          }

          // ------------------------------------------------------- Maintenance
          case "maintenance_reconcile_files":
          case "maintenance_cleanup_caches":
          case "maintenance_vacuum_database":
          case "maintenance_rebuild_search_index": {
            const operation = command.replace("maintenance_", "");
            const maintenance: MaintenanceResult = {
              operation,
              items_processed: state.books.length,
              duration_ms: 0,
              message: "In-memory backend: no physical storage to operate on.",
            };
            return maintenance;
          }

          case "run_diagnostics": {
            const report: DiagnosticsReport = {
              overall_status: "healthy",
              timestamp: now(),
              subsystems: [
                { name: "In-memory store", status: "healthy", details: "Test backend" },
              ],
              metrics: {
                books: state.books.length,
                annotations: state.annotations.length,
                notes: state.notes.length,
                flashcards: state.flashcards.length,
              },
            };
            return report;
          }

          // --------------------------------------------------------- Knowledge
          case "list_notes":
            return state.notes.filter((n) => !n.is_deleted);

          case "create_note":
          case "update_note": {
            const note = a.note as Note;
            upsertById(state.notes, note);
            return note;
          }

          case "delete_note": {
            const note = state.notes.find((n) => n.id === a.id);
            if (note) note.is_deleted = true;
            return undefined;
          }

          case "list_flashcards":
            return state.flashcards.filter((c) => !c.is_deleted);

          case "create_flashcard": {
            const flashcard = a.flashcard as Flashcard;
            upsertById(state.flashcards, flashcard);
            return flashcard;
          }

          case "delete_flashcard": {
            const card = state.flashcards.find((c) => c.id === a.id);
            if (card) card.is_deleted = true;
            return undefined;
          }

          case "record_study_review": {
            const review = a.review as StudyReview;
            const card = state.flashcards.find((c) => c.id === review.flashcard_id);
            if (card) {
              card.interval_days = review.interval_after;
              card.ease_factor = review.ease_factor;
              card.repetitions += 1;
              card.last_reviewed_at = review.reviewed_at;
            }
            return review;
          }

          // ------------------------------------------------------------ Sessions
          case "start_reading_session": {
            const session: ReadingSession = {
              id: nextId("session"),
              book_id: a.bookId as string,
              device_id: FIXTURE_DEVICE_ID,
              started_at: now(),
              ended_at: null,
              duration_seconds: 0,
              start_progress_pct: a.startProgress as number,
              end_progress_pct: a.startProgress as number,
            };
            state.sessions.push(session);
            return session;
          }

          case "complete_reading_session": {
            const session = state.sessions.find((s) => s.id === a.sessionId);
            if (!session) throw new Error(`Unknown session: ${String(a.sessionId)}`);
            session.ended_at = now();
            session.duration_seconds = a.durationSeconds as number;
            session.end_progress_pct = a.endProgress as number;
            return undefined;
          }

          case "get_reading_analytics":
            return analytics();

          default:
            throw new Error(
              `In-memory backend does not implement command "${command}". ` +
                "Add it to src/testing/inMemoryBackend.ts, or test against a real transport."
            );
        }
      })();

      return (await result) as T;
    },
  };

  return {
    transport,
    get state() {
      return state;
    },
    reset(next?: Partial<InMemoryLibraryState>) {
      state = next ? { ...emptyState(), ...next } : emptyState();
    },
    emit<T = unknown>(event: string, payload?: T) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload);
      }
    },
  };
}
