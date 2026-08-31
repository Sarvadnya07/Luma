import React, { useEffect, useState } from "react";
import { Book, BookDetailViewData, Collection, DocumentFormat, ImportJob, LibrarySortBy, ReadingStatus, Tag } from "@luma/shared-types";
import { BookCard, BookTable, Pagination } from "@luma/library-ui";
import { LumaApi } from "../../lib/tauri";
import { useReaderStore } from "../../state/readerState";
import { LibrarySidebar, SidebarSection } from "./LibrarySidebar";
import { LibraryToolbar } from "./LibraryToolbar";
import { BookDetailsDrawer } from "./BookDetailsDrawer";
import { MetadataEditModal } from "./MetadataEditModal";
import { ImportProgressModal } from "./ImportProgressModal";
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
import { BookOpen } from "lucide-react";

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

export const LibraryView: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation & Filtering
  const [currentSection, setCurrentSection] = useState<SidebarSection>("library");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<DocumentFormat | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | "all">("all");
  const [sortBy, setSortBy] = useState<LibrarySortBy>("title");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);

  // Inspection Drawer & Modals
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookDetailViewData | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [activeImportJob, setActiveImportJob] = useState<ImportJob | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateExistingBook, setDuplicateExistingBook] = useState<Book | null>(null);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const setCurrentBook = useReaderStore((s) => s.setCurrentBook);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedBooks, fetchedCols, fetchedTags] = await Promise.all([
        LumaApi.listBooks(
          {
            library_state: currentSection === "trash" ? "trashed" : "active",
            reading_status:
              currentSection === "reading"
                ? "reading"
                : statusFilter !== "all"
                ? statusFilter
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
      ]);
      setBooks(fetchedBooks);
      setCollections(fetchedCols);
      setTags(fetchedTags);
    } catch (err) {
      console.error("Failed to load library data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentSection, selectedCollectionId, selectedTagId, formatFilter, statusFilter, sortBy, searchQuery]);

  const handleOpenDetails = async (bookId: string) => {
    try {
      const details = await LumaApi.getBookDetails(bookId);
      setSelectedBookDetails(details);
    } catch (err) {
      console.error("Failed to load book details:", err);
    }
  };

  const handleImportFiles = async (filePaths: string[]) => {
    try {
      const job = await LumaApi.importFiles(filePaths);
      setActiveImportJob(job);
      const dupItem = job.items.find(
        (i) => i.duplicate_level && i.duplicate_level !== "unrelated"
      );
      if (dupItem) {
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
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const paths = files.map((f) => (f as any).path || f.name);
      await handleImportFiles(paths);
    }
  };

  const openImportPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".epub,.pdf,.cbz,.txt,.md";
    input.onchange = (e: any) => {
      const files = Array.from(e.target.files || []);
      const paths = files.map((f: any) => f.path || f.name);
      if (paths.length > 0) handleImportFiles(paths);
    };
    input.click();
  };

  const getSectionTitle = () => {
    if (currentSection === "all") return "All Books";
    if (currentSection === "reading") return "Currently Reading";
    if (currentSection === "collections") return "Collections";
    if (currentSection === "tags") return "Tags";
    if (currentSection === "authors") return "Authors";
    if (currentSection === "series") return "Series";
    if (currentSection === "archive") return "Archive";
    if (currentSection === "trash") return "Trash";
    return "Library";
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex h-full overflow-hidden bg-[#FAF7F2] text-[#1C1917]"
    >
      <DropZoneOverlay isDragging={isDragging} />

      {/* Left Sidebar */}
      <LibrarySidebar
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-y-auto w-full">
        {/* Top Search & Toolbar */}
        <LibraryToolbar
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
          totalCount={242}
          loading={loading}
        />

        {/* Section Heading matching screenshots */}
        {currentSection !== "library" && (
          <div className="pt-6 pb-4">
            <h2 className="font-serif text-2xl font-bold text-[#1C1917] tracking-tight">
              {getSectionTitle()}
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              {books.length} items • Sorted by {sortBy.replace("_", " ")}
            </p>
          </div>
        )}

        {/* Books Viewport */}
        <div className="flex-1 pb-10">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-[#78716C] py-20 text-xs">
              Loading library collection...
            </div>
          ) : currentSection === "history" ? (
            <ReadingIntelligenceDashboard
              onOpenBook={(bookId) => {
                const b = books.find((x) => x.id === bookId);
                if (b) setCurrentBook(b);
              }}
              onNavigateTab={(tab) => setCurrentSection(tab as SidebarSection)}
            />
          ) : currentSection === "atrium" ? (
            <KnowledgeHome
              onNavigateToNotes={() => setCurrentSection("notes")}
              onNavigateToFlashcards={() => setCurrentSection("flashcards")}
              onNavigateToProjects={() => setCurrentSection("projects")}
            />
          ) : currentSection === "notes" ? (
            <NotesWorkspace />
          ) : currentSection === "flashcards" ? (
            <StudyFlashcards />
          ) : currentSection === "projects" ? (
            <ResearchProjectWorkspace />
          ) : currentSection === "devices" ? (
            <SyncDeviceCenter />
          ) : currentSection === "plugins" ? (
            <IntegrationsPluginsView />
          ) : currentSection === "annotations" ? (
            /* Screenshot 5: Global Annotation Center */
            <GlobalAnnotationCenter
              onOpenBook={(bookId) => {
                const b = books.find((x) => x.id === bookId);
                if (b) setCurrentBook(b);
              }}
            />
          ) : currentSection === "library" && !searchQuery && formatFilter === "all" && statusFilter === "all" ? (
            /* Screenshot 3: Luma Home View */
            <LumaHomeView
              onSelectBook={(b) => handleOpenDetails(b.id)}
              onOpenReader={(b) => {
                setCurrentBook(b);
              }}
              onViewAll={() => setCurrentSection("all")}
            />
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-[#78716C] border border-dashed border-[#DDD5C7] rounded-2xl p-16 my-8 bg-[#FFFFFF]/50">
              <BookOpen className="w-10 h-10 text-[#A8A29E] mb-3" />
              <h3 className="text-sm font-semibold text-[#1C1917]">
                {currentSection === "trash" ? "Trash is empty" : "No books match your current view"}
              </h3>
              <p className="text-xs text-[#78716C] mt-1 mb-4 text-center max-w-sm">
                Import an EPUB, PDF, or document to build your sanctuary library.
              </p>
              <button
                onClick={openImportPicker}
                className="py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg shadow-sm"
              >
                Select Document to Import
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-2">
              {books.map((book) => {
                const author = BOOK_AUTHORS_MAP[book.id] || "Unknown Author";
                const isSelected = selectedBookDetails?.book.id === book.id;

                return (
                  <BookCard
                    key={book.id}
                    book={book}
                    authorName={author}
                    isSelected={isSelected}
                    onSelect={() => {
                      handleOpenDetails(book.id);
                    }}
                    onOpenDetails={() => handleOpenDetails(book.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {/* Screenshot 2: Dense Library View */}
              <BookTable
                books={books}
                authorMap={BOOK_AUTHORS_MAP}
                selectedBookId={selectedBookDetails?.book.id}
                onSelectBook={(book) => handleOpenDetails(book.id)}
                onOpenDetails={(book) => handleOpenDetails(book.id)}
              />
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-[#78716C]">
                  Showing 1-{books.length} of 2,451 books
                </span>
                <Pagination
                  currentPage={currentPage}
                  totalPages={12}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Book Details Inspector Drawer (Screen 1) */}
      <BookDetailsDrawer
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
      />

      {/* Metadata Editor Modal */}
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

      {/* Import Progress Modal */}
      <ImportProgressModal
        job={activeImportJob}
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setActiveImportJob(null);
        }}
      />

      {/* Create Collection Modal */}
      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onCreate={async (name, desc) => {
          await LumaApi.createCollection(name, desc);
          await loadData();
        }}
      />

      {/* Duplicate Review Modal (Screenshot 1) */}
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

      {/* Command Palette (Ctrl+K) Modal */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectAction={(actionId) => {
          if (actionId === "open_meditations") {
            const b = books.find((x) => x.id === "book_meditations") || books[0];
            if (b) setCurrentBook(b);
          } else if (actionId === "search_annotations") {
            setCurrentSection("annotations");
          } else if (actionId === "toggle_eink") {
            setCurrentSection("all");
          }
        }}
      />
    </div>
  );
};

