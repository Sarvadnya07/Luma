import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Book, BookDetailViewData, Collection, DocumentFormat, ImportJob, LibrarySortBy, ReadingStatus, Tag } from "@luma/shared-types";
import { BookCard, BookTable, Pagination } from "@luma/library-ui";
import { LumaApi, isTauri } from "../../lib/tauri";
import { useReaderStore } from "../../state/readerState";
import { LibrarySidebar, SidebarSection } from "./LibrarySidebar";
import { LibraryToolbar } from "./LibraryToolbar";
import { BookDetailsDrawer } from "./BookDetailsDrawer";
import { MetadataEditModal } from "./MetadataEditModal";
import { CollectionModal } from "./CollectionModal";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { LumaHomeView } from "./LumaHomeView";
import { DuplicateReviewModal } from "./DuplicateReviewModal";
import { GlobalAnnotationCenter } from "../annotations/GlobalAnnotationCenter";
import { ReadingIntelligenceDashboard } from "../intelligence/ReadingIntelligenceDashboard";
import { KnowledgeHome } from "../workspace/KnowledgeHome";
import { NotesWorkspace } from "../workspace/NotesWorkspace";
import { StudyFlashcards } from "../workspace/StudyFlashcards";
import { ResearchProjectWorkspace } from "../workspace/ResearchProjectWorkspace";
import { SyncDeviceCenter } from "../devices/SyncDeviceCenter";
import { IntegrationsPluginsView } from "../plugins/IntegrationsPluginsView";
import { CommandPaletteModal } from "../palette/CommandPaletteModal";
import { SettingsModal } from "../settings/SettingsModal";
import { BookOpen, Loader2, AlertCircle } from "lucide-react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface LibraryViewLabels {
  // Section titles
  allBooks?: string;
  currentlyReading?: string;
  collections?: string;
  tags?: string;
  authors?: string;
  series?: string;
  archive?: string;
  trash?: string;
  library?: string;
  // Empty states
  emptyTrashTitle?: string;
  emptyFilterTitle?: string;
  emptyFilterDescription?: string;
  importButtonLabel?: string;
  // Loading
  loadingMessage?: string;
  // Error
  errorMessage?: string;
  retryLabel?: string;
  // Pagination
  showingItemsLabel?: (start: number, end: number, total: number) => string;
  // Sub‑component labels (passed through)
  sidebarLabels?: any; // could use the same types from LibrarySidebar
  toolbarLabels?: any;
  detailsLabels?: any;
  // etc.
}

export interface LibraryViewConfig {
  enableCommandPalette?: boolean;
  enableDarkModeToggle?: boolean;
  enableDragAndDrop?: boolean;
  enableImportProgressModal?: boolean;
  enableDuplicateModal?: boolean;
  sections?: {
    library?: boolean;
    all?: boolean;
    reading?: boolean;
    collections?: boolean;
    tags?: boolean;
    authors?: boolean;
    series?: boolean;
    annotations?: boolean;
    history?: boolean;
    atrium?: boolean;
    notes?: boolean;
    flashcards?: boolean;
    projects?: boolean;
    devices?: boolean;
    plugins?: boolean;
    archive?: boolean;
    trash?: boolean;
  };
  commandPaletteShortcut?: string; // e.g., "Ctrl+K"
}

export interface LibraryViewProps {
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  labels?: LibraryViewLabels;
  config?: LibraryViewConfig;
  className?: string;
  style?: React.CSSProperties;
  // Optional overrides for child components (for dependency injection)
  components?: {
    LibrarySidebar?: React.ComponentType<any>;
    LibraryToolbar?: React.ComponentType<any>;
    BookDetailsDrawer?: React.ComponentType<any>;
    // ... etc.
  };
}

type LibraryStatusFilter = ReadingStatus | "all" | "want_to_read" | "on_hold" | "did_not_finish";

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<LibraryViewLabels> = {
  allBooks: "All Books",
  currentlyReading: "Currently Reading",
  collections: "Collections",
  tags: "Tags",
  authors: "Authors",
  series: "Series",
  archive: "Archive",
  trash: "Trash",
  library: "Library",
  emptyTrashTitle: "Trash is empty",
  emptyFilterTitle: "No books match your current view",
  emptyFilterDescription: "Import an EPUB, PDF, or document to build your sanctuary library.",
  importButtonLabel: "Select Document to Import",
  loadingMessage: "Loading library collection...",
  errorMessage: "Failed to load library data. Please try again.",
  retryLabel: "Retry",
  showingItemsLabel: (start: number, end: number, total: number) =>
    `Showing ${start}-${end} of ${total} book${total === 1 ? "" : "s"}`,
  sidebarLabels: {},
  toolbarLabels: {},
  detailsLabels: {},
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const LibraryView: React.FC<LibraryViewProps> = ({
  isDarkMode = false,
  onToggleDarkMode,
  labels: customLabels = {},
  config: customConfig = {},
  className = "",
  style,
  components = {},
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels } as Required<LibraryViewLabels>;
  const config = {
    enableCommandPalette: true,
    enableDarkModeToggle: true,
    enableDragAndDrop: true,
    enableImportProgressModal: true,
    enableDuplicateModal: true,
    sections: {
      library: true,
      all: true,
      reading: true,
      collections: true,
      tags: true,
      authors: true,
      series: true,
      annotations: true,
      history: true,
      atrium: true,
      notes: true,
      flashcards: true,
      projects: true,
      devices: true,
      plugins: true,
      archive: true,
      trash: true,
    },
    commandPaletteShortcut: "Ctrl+K",
    ...customConfig,
  };

  // State
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigation & Filtering
  const [currentSection, setCurrentSection] = useState<SidebarSection>("library");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<DocumentFormat | "all">("all");
  const [statusFilter, setStatusFilter] = useState<LibraryStatusFilter>("all");
  const [sortBy, setSortBy] = useState<LibrarySortBy>("title");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);

  // Modals & Drawers
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookDetailViewData | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [activeImportJob, setActiveImportJob] = useState<ImportJob | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateExistingBook, setDuplicateExistingBook] = useState<Book | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [authorMap, setAuthorMap] = useState<Record<string, string>>({});

  const setCurrentBook = useReaderStore((s) => s.setCurrentBook);

  // Keyboard shortcut for command palette
  useEffect(() => {
    if (!config.enableCommandPalette) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = config.commandPaletteShortcut?.toLowerCase() || "ctrl+k";
      const parts = key.split("+");
      const ctrl = parts.includes("ctrl") || parts.includes("cmd");
      const meta = parts.includes("meta") || parts.includes("cmd");
      const keyName = parts.find(p => !["ctrl", "cmd", "meta", "shift", "alt"].includes(p));
      if (
        ((ctrl && (e.ctrlKey || e.metaKey)) || (meta && e.metaKey)) &&
        e.key.toLowerCase() === keyName?.toLowerCase()
      ) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config.enableCommandPalette, config.commandPaletteShortcut]);

  // Data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedBooks, fetchedCols, fetchedTags, fetchedAuthors] = await Promise.all([
        LumaApi.listBooks(
          {
            library_state: currentSection === "trash" ? "trashed" : "active",
            reading_status:
              currentSection === "reading"
                ? "reading"
                : statusFilter !== "all"
                ? (statusFilter as ReadingStatus | null)
                : null,
            format: formatFilter !== "all" ? formatFilter : null,
            collection_id: selectedCollectionId,
            tag_id: selectedTagId,
            search_query: searchQuery || null,
          },
          { sort_by: sortBy, ascending: true }
        ),
        LumaApi.listCollections(),
        LumaApi.listTags(),
        LumaApi.listAuthors(),
      ]);

      const aMap: Record<string, string> = {};
      const authorIdMap = new Map((fetchedAuthors || []).map((a) => [a.id, a.name]));
      for (const b of fetchedBooks || []) {
        if (b.author_ids && b.author_ids.length > 0) {
          const names = b.author_ids.map((id) => authorIdMap.get(id)).filter(Boolean);
          if (names.length > 0) {
            aMap[b.id] = names.join(", ");
          }
        }
      }

      setBooks(fetchedBooks);
      setCollections(fetchedCols);
      setTags(fetchedTags);
      setAuthorMap(aMap);
    } catch (err) {
      console.error("Failed to load library data:", err);
      setError(labels.errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentSection, selectedCollectionId, selectedTagId, formatFilter, statusFilter, sortBy, searchQuery, labels.errorMessage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Event handlers
  const handleOpenDetails = useCallback(async (bookId: string) => {
    try {
      const details = await LumaApi.getBookDetails(bookId);
      setSelectedBookDetails(details);
    } catch (err) {
      console.error("Failed to load book details:", err);
    }
  }, []);

  const handleImportFiles = useCallback(async (filePaths: string[]) => {
    try {
      const job = await LumaApi.importFiles(filePaths);
      setActiveImportJob(job);
      const dupItem = job.items.find(
        (i) => i.duplicate_level && i.duplicate_level !== "unrelated"
      );
      if (dupItem && config.enableDuplicateModal) {
        const foundBook = books.find((b) => b.id === dupItem.book_id) || books[0] || null;
        setDuplicateExistingBook(foundBook);
        setIsDuplicateModalOpen(true);
      } else {
        setIsImportModalOpen(true);
      }
      await loadData();
    } catch (err) {
      console.error("Import error:", err);
    }
  }, [books, config.enableDuplicateModal, loadData]);

  // Drag and drop listener (Tauri)
  useEffect(() => {
    if (!config.enableDragAndDrop) return;
    let unlistenFn: (() => void) | undefined;
    if (isTauri()) {
      import("@tauri-apps/api/event")
        .then(({ listen }) => {
          listen<{ paths?: string[] }>("tauri://drag-drop", (event) => {
            if (event.payload?.paths && event.payload.paths.length > 0) {
              handleImportFiles(event.payload.paths);
            }
          })
            .then((unsub) => {
              unlistenFn = unsub;
            })
            .catch(() => {});
        })
        .catch(() => {});
    }
    return () => {
      if (unlistenFn) unlistenFn();
    };
  }, [config.enableDragAndDrop, handleImportFiles]);

  // Background domain events
  useEffect(() => {
    let unsubImported: (() => void) | undefined;
    let unsubState: (() => void) | undefined;

    LumaApi.onBookImported(() => {
      loadData();
    }).then((fn) => {
      unsubImported = fn;
    });

    LumaApi.onDomainEvent("luma://library/state-changed", () => {
      loadData();
    }).then((fn) => {
      unsubState = fn;
    });

    return () => {
      if (unsubImported) unsubImported();
      if (unsubState) unsubState();
    };
  }, [loadData]);

  // UI handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!config.enableDragAndDrop) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const pathsWithFs = files
      .map((f) => (f as File & { path?: string }).path)
      .filter((p): p is string => Boolean(p && p.length > 0));

    if (pathsWithFs.length === files.length) {
      await handleImportFiles(pathsWithFs);
    } else {
      // Browser fallback
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const job = await LumaApi.importFileBytes(file.name, new Uint8Array(buf));
        setActiveImportJob(job);
        setIsImportModalOpen(true);
      }
      await loadData();
    }
  }, [config.enableDragAndDrop, handleImportFiles, loadData]);

  const openImportPicker = useCallback(async () => {
    if (isTauri()) {
      try {
        const paths = await LumaApi.pickImportFiles();
        if (paths && paths.length > 0) {
          await handleImportFiles(paths);
          return;
        }
      } catch (err) {
        console.error("Native file picker error:", err);
      }
    }
    // Web fallback
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".epub,.pdf,.cbz,.cbr,.txt,.md";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = Array.from(target.files || []);
      for (const file of files) {
        const buf = await file.arrayBuffer();
        const job = await LumaApi.importFileBytes(file.name, new Uint8Array(buf));
        setActiveImportJob(job);
        setIsImportModalOpen(true);
      }
      await loadData();
    };
    input.click();
  }, [handleImportFiles, loadData]);

  // Derived section title
  const sectionTitle = useMemo(() => {
    const map: Record<SidebarSection, string> = {
      all: labels.allBooks,
      reading: labels.currentlyReading,
      collections: labels.collections,
      tags: labels.tags,
      authors: labels.authors,
      series: labels.series,
      archive: labels.archive,
      trash: labels.trash,
      library: labels.library,
      atrium: labels.library,
      notes: labels.library,
      flashcards: labels.library,
      projects: labels.library,
      history: labels.library,
      annotations: labels.library,
      devices: labels.library,
      plugins: labels.library,
    };
    return map[currentSection] || labels.library;
  }, [currentSection, labels]);

  // Render content based on section
  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center py-20" aria-live="polite">
          <Loader2 className="w-6 h-6 animate-spin text-[#78716C] mr-2 dark:text-[#B8AEA2]" />
          <span className="text-xs text-[#78716C] dark:text-[#B8AEA2]">{labels.loadingMessage}</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-20" aria-live="assertive">
          <AlertCircle className="w-8 h-8 text-rose-500 dark:text-rose-400" />
          <p className="text-xs text-rose-700 dark:text-rose-400 mt-2">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg dark:bg-[#F2C14E] dark:text-[#141312]"
          >
            {labels.retryLabel}
          </button>
        </div>
      );
    }

    // Special section views
    if (currentSection === "history") {
      return (
        <ReadingIntelligenceDashboard
          data={{ books } as any}
          onOpenBook={(bookId) => {
            const b = books.find((x) => x.id === bookId);
            if (b) setCurrentBook(b);
          }}
          onNavigateTab={(tab) => setCurrentSection(tab as SidebarSection)}
        />
      );
    }
    if (currentSection === "atrium") {
      return (
        <KnowledgeHome
          onNavigateToNotes={() => setCurrentSection("notes")}
          onNavigateToFlashcards={() => setCurrentSection("flashcards")}
          onNavigateToProjects={() => setCurrentSection("projects")}
        />
      );
    }
    if (currentSection === "notes") return <NotesWorkspace />;
    if (currentSection === "flashcards") return <StudyFlashcards />;
    if (currentSection === "projects") return <ResearchProjectWorkspace />;
    if (currentSection === "devices") return <SyncDeviceCenter devices={[]} />;
    if (currentSection === "plugins") return <IntegrationsPluginsView />;
    if (currentSection === "annotations") {
      return (
        <GlobalAnnotationCenter
          onOpenBook={(bookId) => {
            const b = books.find((x) => x.id === bookId);
            if (b) setCurrentBook(b);
          }}
        />
      );
    }

    // Library home (special view when no filters)
    if (
      currentSection === "library" &&
      !searchQuery &&
      formatFilter === "all" &&
      statusFilter === "all"
    ) {
      return (
        <LumaHomeView
          books={books}
          authorMap={authorMap}
          onSelectBook={(b) => handleOpenDetails(b.id)}
          onOpenReader={(b) => setCurrentBook(b)}
          onViewAll={() => setCurrentSection("all")}
        />
      );
    }

    // Empty state
    if (books.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-[#78716C] border border-dashed border-[#DDD5C7] rounded-2xl p-16 my-8 bg-[#FFFFFF]/50 dark:border-[#3B3630] dark:bg-[#201E1B]/70 dark:text-[#B8AEA2]">
          <BookOpen className="w-10 h-10 text-[#A8A29E] mb-3 dark:text-[#8F8478]" />
          <h3 className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F1EA]">
            {currentSection === "trash" ? labels.emptyTrashTitle : labels.emptyFilterTitle}
          </h3>
          <p className="text-xs text-[#78716C] mt-1 mb-4 text-center max-w-sm dark:text-[#B8AEA2]">
            {labels.emptyFilterDescription}
          </p>
          <button
            onClick={openImportPicker}
            className="py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg shadow-sm dark:bg-[#F2C14E] dark:text-[#141312] dark:hover:bg-[#FFD66E]"
          >
            {labels.importButtonLabel}
          </button>
        </div>
      );
    }

    // Grid/List view
    if (viewMode === "grid") {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-2">
          {books.map((book) => {
            const author = authorMap[book.id] || "Unknown Author";
            const isSelected = selectedBookDetails?.book.id === book.id;
            return (
              <BookCard
                key={book.id}
                book={book}
                authorName={author}
                isSelected={isSelected}
                onSelect={() => handleOpenDetails(book.id)}
                onOpenDetails={() => handleOpenDetails(book.id)}
              />
            );
          })}
        </div>
      );
    }

    // List view
    return (
      <div className="space-y-4 pt-1">
        <BookTable
          books={books}
          authorMap={authorMap}
          selectedBookId={selectedBookDetails?.book.id}
          onSelectBook={(book) => handleOpenDetails(book.id)}
          onOpenDetails={(book) => handleOpenDetails(book.id)}
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[#78716C] dark:text-[#B8AEA2]">
            {labels.showingItemsLabel(
              1,
              books.length,
              books.length
            )}
          </span>
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(books.length / 20))}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>
    );
  }, [
    loading,
    error,
    loadData,
    currentSection,
    books,
    authorMap,
    searchQuery,
    formatFilter,
    statusFilter,
    viewMode,
    selectedBookDetails,
    currentPage,
    labels,
    handleOpenDetails,
    setCurrentBook,
    openImportPicker,
  ]);

  // Render child components with labels merged
  const SidebarComponent = components.LibrarySidebar || LibrarySidebar;
  const ToolbarComponent = components.LibraryToolbar || LibraryToolbar;
  const DetailsDrawerComponent = components.BookDetailsDrawer || BookDetailsDrawer;

  return (
    <div
      className={`flex-1 flex h-full overflow-hidden bg-[#FAF7F2] text-[#1C1917] transition-colors dark:bg-[#141312] dark:text-[#F5F1EA] ${className}`}
      style={style}
      onDragOver={config.enableDragAndDrop ? handleDragOver : undefined}
      onDragLeave={config.enableDragAndDrop ? handleDragLeave : undefined}
      onDrop={config.enableDragAndDrop ? handleDrop : undefined}
    >
      {config.enableDragAndDrop && <DropZoneOverlay isDragging={isDragging} />}

      {/* Sidebar */}
      <SidebarComponent
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        collections={collections}
        tags={tags}
        selectedCollectionId={selectedCollectionId}
        selectedTagId={selectedTagId}
        onSelectCollection={setSelectedCollectionId}
        onSelectTag={setSelectedTagId}
        onCreateCollection={() => setIsCollectionModalOpen(true)}
        onImportClick={openImportPicker}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={config.enableDarkModeToggle ? onToggleDarkMode : undefined}
        labels={labels.sidebarLabels}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-y-auto w-full">
        <ToolbarComponent
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          formatFilter={formatFilter}
          onFormatChange={setFormatFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onImportClick={openImportPicker}
          totalCount={books.length}
          loading={loading}
          labels={labels.toolbarLabels}
        />

        {/* Section heading */}
        {currentSection !== "library" && (
          <div className="pt-6 pb-4">
            <h2 className="font-serif text-2xl font-bold text-[#1C1917] tracking-tight dark:text-[#F5F1EA]">
              {sectionTitle}
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5 dark:text-[#B8AEA2]">
              {books.length} items • Sorted by {sortBy.replace("_", " ")}
            </p>
          </div>
        )}

        <div className="flex-1 pb-10">
          {renderContent}
        </div>
      </div>

      {/* Drawers & Modals */}
      <DetailsDrawerComponent
        data={selectedBookDetails}
        onClose={() => setSelectedBookDetails(null)}
        onOpenReader={() => {
          if (selectedBookDetails) {
            setCurrentBook(selectedBookDetails.book);
            setSelectedBookDetails(null);
          }
        }}
        onEditMetadata={() => {
          if (selectedBookDetails) {
            setEditingBook(selectedBookDetails.book);
          }
        }}
        onStatusChange={async (st) => {
          if (selectedBookDetails) {
            await LumaApi.setReadingStatus(selectedBookDetails.book.id, st);
            await handleOpenDetails(selectedBookDetails.book.id);
            await loadData();
          }
        }}
        onTrash={async () => {
          if (selectedBookDetails) {
            await LumaApi.trashBook(selectedBookDetails.book.id);
            setSelectedBookDetails(null);
            await loadData();
          }
        }}
        onRestore={async () => {
          if (selectedBookDetails) {
            await LumaApi.restoreBook(selectedBookDetails.book.id);
            setSelectedBookDetails(null);
            await loadData();
          }
        }}
        onPermanentDelete={async () => {
          if (selectedBookDetails) {
            await LumaApi.deleteBookPermanently(selectedBookDetails.book.id, false);
            setSelectedBookDetails(null);
            await loadData();
          }
        }}
        onAddTag={async (name) => {
          if (selectedBookDetails) {
            await LumaApi.addTagToBook(selectedBookDetails.book.id, name);
            await handleOpenDetails(selectedBookDetails.book.id);
            await loadData();
          }
        }}
        onAddToCollection={() => setIsCollectionModalOpen(true)}
        labels={labels.detailsLabels}
      />

      {editingBook && (
        <MetadataEditModal
          book={editingBook}
          isOpen={!!editingBook}
          onClose={() => setEditingBook(null)}
          onSave={async (meta) => {
            await LumaApi.updateBookMetadata(editingBook.id, meta);
            await handleOpenDetails(editingBook.id);
            await loadData();
          }}
        />
      )}

      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onCreate={async (name, desc) => {
          await LumaApi.createCollection(name, desc);
          await loadData();
        }}
      />

      {config.enableDuplicateModal && (
        <DuplicateReviewModal
          isOpen={isDuplicateModalOpen}
          existingBook={duplicateExistingBook}
          onClose={() => setIsDuplicateModalOpen(false)}
          onUseExisting={() => {
            setIsDuplicateModalOpen(false);
          }}
          onAddAsNewFormat={() => {
            setIsDuplicateModalOpen(false);
            loadData();
          }}
        />
      )}

      {config.enableCommandPalette && (
        <CommandPaletteModal
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectAction={(actionId) => {
            if (actionId.startsWith("open_book_")) {
              const id = actionId.replace("open_book_", "");
              const b = books.find((x) => x.id === id) || books[0];
              if (b) setCurrentBook(b);
            } else if (actionId === "start_backup") {
              setIsSettingsOpen(true);
            } else if (actionId === "search_annotations") {
              setCurrentSection("annotations");
            } else if (actionId === "toggle_eink") {
              setCurrentSection("all");
            }
          }}
        />
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={onToggleDarkMode}
      />
    </div>
  );
};