import React, { useEffect, useState } from "react";
import { Book, BookDetailViewData, Collection, DocumentFormat, ImportJob, LibrarySortBy, ReadingStatus, Tag } from "@luma/shared-types";
import { BookCard, BookListItem } from "@luma/library-ui";
import { Button } from "@luma/ui";
import { LumaApi } from "../../lib/tauri";
import { useReaderStore } from "../../state/readerState";
import { LibrarySidebar, SidebarSection } from "./LibrarySidebar";
import { LibraryToolbar } from "./LibraryToolbar";
import { BookDetailsDrawer } from "./BookDetailsDrawer";
import { MetadataEditModal } from "./MetadataEditModal";
import { ImportProgressModal } from "./ImportProgressModal";
import { CollectionModal } from "./CollectionModal";
import { DropZoneOverlay } from "./DropZoneOverlay";
import { BookOpen, FolderOpen } from "lucide-react";

export const LibraryView: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation & Filtering
  const [currentSection, setCurrentSection] = useState<SidebarSection>("all");
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<DocumentFormat | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReadingStatus | "all">("all");
  const [sortBy, setSortBy] = useState<LibrarySortBy>("title");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Inspection Drawer & Modals
  const [selectedBookDetails, setSelectedBookDetails] = useState<BookDetailViewData | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [activeImportJob, setActiveImportJob] = useState<ImportJob | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
                : currentSection === "completed"
                ? "completed"
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
      setIsImportModalOpen(true);
      await loadData();
    } catch (err) {
      console.error("Import error:", err);
    }
  };

  const handleReconcile = async () => {
    setLoading(true);
    try {
      await LumaApi.reconcileLibraryFiles();
      await loadData();
    } catch (err) {
      console.error("Reconciliation error:", err);
    } finally {
      setLoading(false);
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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex h-full overflow-hidden bg-slate-950 text-slate-100"
    >
      <DropZoneOverlay isDragging={isDragging} />

      {/* Sidebar */}
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
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto w-full">
        {/* Toolbar */}
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
          onImportClick={() => {
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
          }}
          onReconcileClick={handleReconcile}
          loading={loading}
        />

        {/* Library Content */}
        <div className="pt-6 flex-1">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 py-20">
              Loading library collection...
            </div>
          ) : books.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl p-16 my-8">
              <BookOpen className="w-12 h-12 text-slate-600 mb-4" />
              <h3 className="text-base font-medium text-slate-300">
                {currentSection === "trash" ? "Trash is empty" : "No books match your current view"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 text-center max-w-sm">
                {currentSection === "trash"
                  ? "Deleted publications will appear here for recovery."
                  : "Import an EPUB, PDF, CBZ or Markdown document to build your local library."}
              </p>
              {currentSection !== "trash" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
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
                  }}
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Select Document to Import
                </Button>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onSelect={() => {
                    if (book.library_state === "trashed") {
                      handleOpenDetails(book.id);
                    } else {
                      setCurrentBook(book);
                    }
                  }}
                  onOpenDetails={() => handleOpenDetails(book.id)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {books.map((book) => (
                <BookListItem
                  key={book.id}
                  book={book}
                  onSelect={() => {
                    if (book.library_state === "trashed") {
                      handleOpenDetails(book.id);
                    } else {
                      setCurrentBook(book);
                    }
                  }}
                  onOpenDetails={() => handleOpenDetails(book.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Book Details Inspector Drawer */}
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
    </div>
  );
};
