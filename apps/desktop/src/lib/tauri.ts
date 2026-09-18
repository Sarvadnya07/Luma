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
  ReadingStatus,
  BackupManifest,
  BackupPreview,
  BackupRecord,
  BulkOperationResult,
  DiagnosticsReport,
  JobProgress,
  MaintenanceResult,
  Note,
  Flashcard,
  StudyReview,
  ResearchProject,
  ResearchQuestion,
  ResearchEvidence,
  ResearchDraft,
  ReadingSession,
  ReadingAnalytics,
  DocumentStructure,
  StructureNode,
  DocumentRange,
  ResourceDescriptor,
  CitationContext,
  CanonicalSearchMatch,
} from "@luma/shared-types";

// ============================================================================
// 1. Transport Types
//
// Luma owns exactly one source of application data: the local database behind
// the desktop core. Every method on this client is a *transport call* — it
// never synthesises library, reader, knowledge or analytics content.
//
// The `transport` seam exists so integration harnesses can drive the real UI
// against the real backend (Tauri IPC in the shipped app, the browser
// integration bridge in the Playwright harness). Test doubles are installed by
// tests and live under `src/testing/` — never in this module.
// ============================================================================

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface LumaTransport {
  invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T>;
  /**
   * Optional domain events. A transport that cannot deliver events leaves this
   * undefined, and `onDomainEvent` degrades to a no-op subscription — the same
   * behaviour as an environment without the event bridge. Implementations that
   * do support it (the browser integration harness, tests) can now exercise the
   * refresh-on-change paths that were previously untestable.
   */
  subscribe?<T = unknown>(event: string, callback: (payload: T) => void): () => void;
}

export interface LumaApiConfig {
  /** Custom invoke function (defaults to the dynamic `@tauri-apps/api/core` invoke). */
  invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  /** Explicit transport; used by the browser integration harness and tests. */
  transport?: LumaTransport;
  /** Custom logger instance. */
  logger?: Logger;
}

/**
 * Thrown when a command is requested with no way to reach the data layer.
 *
 * This used to be a silent in-memory fake library, which meant a browser build
 * (or a desktop build that failed runtime detection) presented invented books,
 * annotations and reading statistics as if they were the user's own data. An
 * unavailable data layer must surface as an error state, never as content.
 */
export class DataServicesUnavailableError extends Error {
  constructor(readonly command: string) {
    super(
      `Luma data services are unavailable: "${command}" has no transport. ` +
        "Run the desktop application, or supply an explicit transport."
    );
    this.name = "DataServicesUnavailableError";
  }
}

// ============================================================================
// 2. Runtime Detection
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
// 3. Main LumaApiClient
// ============================================================================

export class LumaApiClient {
  private config: {
    invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    transport?: LumaTransport;
    logger: Logger;
    explicitInvoke: boolean;
  };
  private logger: Logger;

  constructor(config: LumaApiConfig = {}) {
    const logger = config.logger ?? new ConsoleLogger();

    const defaultInvoke = async <T = unknown>(
      cmd: string,
      args?: Record<string, unknown>
    ): Promise<T> => {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<T>(cmd, args);
    };

    this.config = {
      invoke: config.invoke ?? defaultInvoke,
      transport: config.transport,
      logger,
      explicitInvoke: Boolean(config.invoke),
    };

    this.logger = logger;
  }

  /**
   * Dispatch a command to the owning data layer.
   *
   * Order: explicit transport -> desktop IPC -> unavailable. There is no
   * fallback that invents a result; an unreachable data layer is an error the
   * UI is expected to render as an error state.
   */
  private async _call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const target = this.config.transport
      ? this.config.transport
      : this.config.explicitInvoke || isTauri()
        ? { invoke: this.config.invoke }
        : null;

    if (!target) {
      const err = new DataServicesUnavailableError(cmd);
      this.logger.error(err.message);
      throw err;
    }

    try {
      return await target.invoke<T>(cmd, args);
    } catch (err) {
      this.logger.error(`Luma command failed for [${cmd}]:`, err);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Library API
  // --------------------------------------------------------------------------

  async listBooks(
    filter?: LibraryFilterOptions,
    sort?: LibrarySortOptions,
    page?: number,
    pageSize?: number
  ): Promise<Book[]> {
    return this._call("list_books", { filter, sort, page, pageSize });
  }

  async getBookCoverDataUrl(bookId: string): Promise<string | null> {
    return this._call("get_book_cover_data_url", { bookId });
  }

  async getBookDetails(bookId: string): Promise<BookDetailViewData | null> {
    return this._call("get_book_details", { bookId });
  }

  async openReaderDocument(bookId: string, fileId?: string): Promise<OpenDocumentResult> {
    return this._call("open_reader_document", { bookId, fileId });
  }

  async getReaderChapter(bookId: string, spineIndex: number): Promise<ChapterContent> {
    return this._call("get_reader_chapter", { bookId, spineIndex });
  }

  async getReaderPdfPage(bookId: string, pageNumber: number): Promise<PdfPageData> {
    return this._call("get_reader_pdf_page", { bookId, pageNumber });
  }

  async getBookFileBytes(bookId: string, fileId?: string): Promise<Uint8Array> {
    return this._call("get_book_file_bytes", { bookId, fileId });
  }

  async searchDocument(bookId: string, query: string): Promise<DocumentSearchMatch[]> {
    return this._call("search_document", { bookId, query });
  }

  async getDocumentStructure(bookId: string): Promise<DocumentStructure> {
    return this._call("get_document_structure", { bookId });
  }

  async getDocumentNodeText(bookId: string, nodeId: string): Promise<string> {
    return this._call("get_document_node_text", { bookId, nodeId });
  }

  async getDocumentRangeText(bookId: string, range: DocumentRange): Promise<string> {
    return this._call("get_document_range_text", { bookId, range });
  }

  async getDocumentParagraph(
    bookId: string,
    sectionOrPage: number,
    paragraphIndex: number
  ): Promise<string> {
    return this._call("get_document_paragraph", { bookId, sectionOrPage, paragraphIndex });
  }

  async getDocumentHeadings(bookId: string): Promise<StructureNode[]> {
    return this._call("get_document_headings", { bookId });
  }

  async getDocumentResources(bookId: string): Promise<ResourceDescriptor[]> {
    return this._call("get_document_resources", { bookId });
  }

  async readDocumentResource(bookId: string, hrefOrId: string): Promise<Uint8Array> {
    return this._call("read_document_resource", { bookId, hrefOrId });
  }

  async getDocumentCitation(bookId: string, range: DocumentRange): Promise<CitationContext> {
    return this._call("get_document_citation", { bookId, range });
  }

  async searchDocumentCanonical(bookId: string, query: string): Promise<CanonicalSearchMatch[]> {
    return this._call("search_document_canonical", { bookId, query });
  }

  // --------------------------------------------------------------------------
  // Bookmarks & Annotations
  // --------------------------------------------------------------------------

  async listBookmarks(bookId: string): Promise<Bookmark[]> {
    return this._call("list_bookmarks", { bookId });
  }

  async createBookmark(
    bookId: string,
    locator: string,
    title?: string | null,
    chapterTitle?: string | null,
    pageNumber?: number | null
  ): Promise<Bookmark> {
    return this._call("create_bookmark", { bookId, locator, title, chapterTitle, pageNumber });
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    return this._call("delete_bookmark", { bookmarkId });
  }

  async listAnnotations(bookId: string): Promise<Annotation[]> {
    return this._call("list_annotations", { bookId });
  }

  async listAllAnnotations(): Promise<Annotation[]> {
    return this._call("list_all_annotations");
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    return this._call("save_annotation", { annotation });
  }

  async deleteAnnotation(annotationId: string): Promise<void> {
    return this._call("delete_annotation", { annotationId });
  }

  async updateAnnotationNote(annotationId: string, note: string | null): Promise<void> {
    return this._call("update_annotation_note", { annotationId, note });
  }

  // --------------------------------------------------------------------------
  // Book Mutation
  // --------------------------------------------------------------------------

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
    return this._call("update_book_metadata", { bookId, metadata });
  }

  async setReadingStatus(bookId: string, status: ReadingStatus): Promise<void> {
    return this._call("set_reading_status", { bookId, status });
  }

  async trashBook(bookId: string): Promise<void> {
    return this._call("trash_book", { bookId });
  }

  async restoreBook(bookId: string): Promise<void> {
    return this._call("restore_book", { bookId });
  }

  async deleteBookPermanently(bookId: string, deleteFiles: boolean): Promise<void> {
    return this._call("delete_book_permanently", { bookId, deleteFiles });
  }

  // --------------------------------------------------------------------------
  // Import
  // --------------------------------------------------------------------------

  async pickImportFiles(): Promise<string[]> {
    return this._call("pick_import_files");
  }

  async pickImportDirectory(): Promise<string | null> {
    return this._call("pick_import_directory");
  }

  async importFileBytes(filename: string, data: Uint8Array): Promise<ImportJob> {
    return this._call("import_file_bytes", { filename, data: Array.from(data) });
  }

  async importFiles(filePaths: string[]): Promise<ImportJob> {
    return this._call("import_files", { filePaths });
  }

  async importDirectory(dirPath: string, recursive: boolean): Promise<ImportJob> {
    return this._call("import_directory", { dirPath, recursive });
  }

  // --------------------------------------------------------------------------
  // Collections, Tags, Authors, Series
  // --------------------------------------------------------------------------

  async listCollections(): Promise<Collection[]> {
    return this._call("list_collections");
  }

  async createCollection(name: string, description?: string): Promise<Collection> {
    return this._call("create_collection", { name, description });
  }

  async addBooksToCollection(collectionId: string, bookIds: string[]): Promise<void> {
    return this._call("add_books_to_collection", { collectionId, bookIds });
  }

  async listTags(): Promise<Tag[]> {
    return this._call("list_tags");
  }

  async addTagToBook(bookId: string, tagName: string): Promise<Tag> {
    return this._call("add_tag_to_book", { bookId, tagName });
  }

  async removeTagFromBook(bookId: string, tagId: string): Promise<void> {
    return this._call("remove_tag_from_book", { bookId, tagId });
  }

  async listAuthors(): Promise<Author[]> {
    return this._call("list_authors");
  }

  async listSeries(): Promise<Series[]> {
    return this._call("list_series");
  }

  async reconcileLibraryFiles(): Promise<number> {
    return this._call("reconcile_library_files");
  }

  // --------------------------------------------------------------------------
  // Reading Progress & Anchors
  // --------------------------------------------------------------------------

  async getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
    return this._call("get_reading_progress", { bookId });
  }

  async saveReadingProgress(progress: ReadingProgress): Promise<void> {
    return this._call("save_reading_progress", { progress });
  }

  async resolveAnchor(
    exact: string,
    prefix: string | null,
    suffix: string | null,
    documentText: string
  ): Promise<ResolutionResult> {
    return this._call("resolve_anchor", { exact, prefix, suffix, documentText });
  }

  // --------------------------------------------------------------------------
  // Bulk Operations
  // --------------------------------------------------------------------------

  async bulkAddTags(bookIds: string[], tagNames: string[]): Promise<BulkOperationResult> {
    return this._call("bulk_add_tags", { payload: { book_ids: bookIds, tag_names: tagNames } });
  }

  async bulkAddToCollection(
    collectionId: string,
    bookIds: string[]
  ): Promise<BulkOperationResult> {
    return this._call("bulk_add_to_collection", {
      payload: { collection_id: collectionId, book_ids: bookIds },
    });
  }

  async bulkTrashBooks(bookIds: string[]): Promise<BulkOperationResult> {
    return this._call("bulk_trash_books", { bookIds });
  }

  async bulkSetReadingStatus(
    bookIds: string[],
    status: ReadingStatus
  ): Promise<BulkOperationResult> {
    return this._call("bulk_set_reading_status", { payload: { book_ids: bookIds, status } });
  }

  async searchLibrary(
    query: string,
    bookIdFilter?: string | null,
    maxResults?: number
  ): Promise<{ hits: DocumentSearchMatch[]; total_count: number; query_duration_ms: number }> {
    return this._call("search_library", { query, bookIdFilter, maxResults });
  }

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------

  async getSetting<T = unknown>(key: string): Promise<T | null> {
    return this._call("get_setting", { key });
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    return this._call("set_setting", { key, value });
  }

  async getAllSettings(): Promise<Record<string, unknown>> {
    return this._call("get_all_settings");
  }

  // --------------------------------------------------------------------------
  // Backup, Maintenance, Diagnostics, Jobs
  // --------------------------------------------------------------------------

  async createBackup(prefix?: string): Promise<BackupRecord> {
    return this._call("create_backup", { prefix });
  }

  async listBackups(): Promise<BackupRecord[]> {
    return this._call("list_backups");
  }

  async inspectBackup(backupPath: string): Promise<BackupPreview> {
    return this._call("inspect_backup", { backupPath });
  }

  async restoreBackup(backupPath: string): Promise<BackupManifest> {
    return this._call("restore_backup", { backupPath });
  }

  async reconcileFiles(): Promise<MaintenanceResult> {
    return this._call("maintenance_reconcile_files");
  }

  async rebuildSearchIndex(): Promise<MaintenanceResult> {
    return this._call("maintenance_rebuild_search_index");
  }

  async cleanupCaches(): Promise<MaintenanceResult> {
    return this._call("maintenance_cleanup_caches");
  }

  async vacuumDatabase(): Promise<MaintenanceResult> {
    return this._call("maintenance_vacuum_database");
  }

  // Named aliases kept for call-site compatibility.
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

  async runDiagnostics(): Promise<DiagnosticsReport> {
    return this._call("run_diagnostics");
  }

  async getJobProgress(jobId: string): Promise<JobProgress | null> {
    return this._call("get_job_progress", { jobId });
  }

  async cancelJob(jobId: string): Promise<boolean> {
    return this._call("cancel_job", { jobId });
  }

  async listRecentJobs(limit?: number): Promise<JobProgress[]> {
    return this._call("list_recent_jobs", { limit });
  }

  // --------------------------------------------------------------------------
  // Event Listeners
  // --------------------------------------------------------------------------

  async onDomainEvent<T = unknown>(
    event: string,
    callback: (payload: T) => void
  ): Promise<() => void> {
    if (!this.config.transport && !isTauri()) {
      this.logger.warn(
        `Cannot subscribe to [${event}]: domain events require the desktop runtime.`
      );
      return () => {};
    }
    if (this.config.transport) {
      if (this.config.transport.subscribe) {
        return this.config.transport.subscribe<T>(event, callback);
      }
      this.logger.debug(
        `Domain event subscription [${event}] is not available over an injected transport.`
      );
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

  // --------------------------------------------------------------------------
  // Knowledge: Notes
  // --------------------------------------------------------------------------

  async listNotes(): Promise<Note[]> {
    return this._call("list_notes");
  }

  async createNote(note: Note): Promise<Note> {
    return this._call("create_note", { note });
  }

  async updateNote(note: Note): Promise<Note> {
    return this._call("update_note", { note });
  }

  async deleteNote(id: string): Promise<void> {
    return this._call("delete_note", { id });
  }

  // --------------------------------------------------------------------------
  // Knowledge: Flashcards & Reviews
  // --------------------------------------------------------------------------

  async listFlashcards(): Promise<Flashcard[]> {
    return this._call("list_flashcards");
  }

  async createFlashcard(flashcard: Flashcard): Promise<Flashcard> {
    return this._call("create_flashcard", { flashcard });
  }

  async recordStudyReview(review: StudyReview): Promise<StudyReview> {
    return this._call("record_study_review", { review });
  }

  async deleteFlashcard(id: string): Promise<void> {
    return this._call("delete_flashcard", { id });
  }

  // --------------------------------------------------------------------------
  // Knowledge: Research Workspace
  // --------------------------------------------------------------------------

  async listResearchProjects(): Promise<ResearchProject[]> {
    return this._call("list_research_projects");
  }

  async createResearchProject(project: ResearchProject): Promise<ResearchProject> {
    return this._call("create_research_project", { project });
  }

  async deleteResearchProject(id: string): Promise<void> {
    return this._call("delete_research_project", { id });
  }

  async listResearchQuestions(projectId: string): Promise<ResearchQuestion[]> {
    return this._call("list_research_questions", { projectId });
  }

  async createResearchQuestion(question: ResearchQuestion): Promise<ResearchQuestion> {
    return this._call("create_research_question", { question });
  }

  async listResearchEvidence(projectId: string): Promise<ResearchEvidence[]> {
    return this._call("list_research_evidence", { projectId });
  }

  async createResearchEvidence(evidence: ResearchEvidence): Promise<ResearchEvidence> {
    return this._call("create_research_evidence", { evidence });
  }

  async deleteResearchEvidence(id: string): Promise<void> {
    return this._call("delete_research_evidence", { id });
  }

  async saveResearchDraft(draft: ResearchDraft): Promise<ResearchDraft> {
    return this._call("save_research_draft", { draft });
  }

  async getResearchDraft(projectId: string): Promise<ResearchDraft | null> {
    return this._call("get_research_draft", { projectId });
  }

  // --------------------------------------------------------------------------
  // Reading Sessions & Analytics
  // --------------------------------------------------------------------------

  async startReadingSession(bookId: string, startProgress: number): Promise<ReadingSession> {
    return this._call("start_reading_session", { bookId, startProgress });
  }

  async completeReadingSession(
    sessionId: string,
    endProgress: number,
    durationSeconds: number
  ): Promise<void> {
    return this._call("complete_reading_session", { sessionId, endProgress, durationSeconds });
  }

  async getReadingAnalytics(): Promise<ReadingAnalytics> {
    return this._call("get_reading_analytics");
  }

  // --------------------------------------------------------------------------
  // Legacy LocalStorage -> SQLite Migration
  //
  // Real product behaviour: users upgrading from the pre-SQLite build have
  // notes and flashcards in localStorage. This reads that user data once and
  // hands it to the owning store. It never invents records.
  // --------------------------------------------------------------------------

  async migrateLegacyKnowledge(): Promise<void> {
    if (typeof localStorage === "undefined") return;
    const migrationFlag = localStorage.getItem("luma_knowledge_migrated_v1");
    if (migrationFlag === "true") return;

    try {
      // 1. Migrate Notes
      const rawNotes = localStorage.getItem("luma_notes_workspace");
      if (rawNotes) {
        const notes = JSON.parse(rawNotes);
        if (Array.isArray(notes)) {
          for (const n of notes) {
            const noteObj: Note = {
              id: n.id || `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              book_id: n.book_id || null,
              annotation_id: n.annotation_id || null,
              source_type: n.source_type || "Book",
              source_title: n.source_title || n.sourceTitle || "",
              title: n.title || "Untitled Note",
              content: n.content || "",
              quote: n.quote || null,
              created_at: n.created_at || new Date().toISOString(),
              updated_at: n.updated_at || new Date().toISOString(),
              is_deleted: false,
            };
            await this.createNote(noteObj);
          }
        }
      }

      // 2. Migrate Flashcards
      const rawCards = localStorage.getItem("luma_flashcards");
      if (rawCards) {
        const cards = JSON.parse(rawCards);
        if (Array.isArray(cards)) {
          for (const c of cards) {
            const cardObj: Flashcard = {
              id: c.id || `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              front: c.front || "",
              back: c.back || "",
              source_book_id: c.source_book_id || null,
              source_annotation_id: c.source_annotation_id || null,
              deck_id: c.deck_id || "default",
              state: c.state || "new",
              interval_days: c.interval_days ?? c.intervalDays ?? 1,
              ease_factor: c.ease_factor ?? c.easeFactor ?? 2.5,
              repetitions: c.repetitions ?? 0,
              due_at: c.due_at || c.dueAt || new Date().toISOString(),
              last_reviewed_at: c.last_reviewed_at || c.lastReviewedAt || null,
              created_at: c.created_at || new Date().toISOString(),
              updated_at: c.updated_at || new Date().toISOString(),
              is_deleted: false,
            };
            await this.createFlashcard(cardObj);
          }
        }
      }

      localStorage.setItem("luma_knowledge_migrated_v1", "true");
      this.logger.info("Successfully migrated legacy localStorage knowledge to SQLite.");
    } catch (e) {
      this.logger.error("Failed during legacy knowledge migration:", e);
    }
  }
}

// ============================================================================
// 4. Singleton Factory & Exports
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

/**
 * Live delegate to the current client instance.
 *
 * Modules import this binding once, at module-evaluation time, but the runtime
 * transport is only chosen during bootstrap. Forwarding every property access
 * to the *current* instance keeps those imports correct after bootstrap
 * installs a transport, instead of silently pinning the pre-bootstrap client.
 */
export const LumaApi: LumaApiClient = new Proxy({} as LumaApiClient, {
  get(_target, property) {
    const instance = createLumaApi();
    const value = Reflect.get(instance as object, property);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
