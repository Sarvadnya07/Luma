import React, { useCallback } from "react";
import {
  X,
  BookOpen,
  Edit,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { BookDetailViewData, ReadingStatus } from "@luma/shared-types";
import { BookCoverThumbnail, cleanDisplayTitle } from "./BookCoverThumbnail";

// ------------------------------------------------------------------
// Props
// ------------------------------------------------------------------

export interface BookDetailsDrawerProps {
  data: BookDetailViewData | null;
  onClose: () => void;
  onOpenReader: () => void;
  onEditMetadata: () => void;
  onStatusChange: (status: ReadingStatus) => void;
  onTrash: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onAddTag?: (name: string) => void;
  onAddToCollection?: () => void;
  // Customisation props
  width?: string; // e.g., "380px", "w-96", etc.
  className?: string;
  labels?: {
    drawerTitle?: string;
    synopsisLabel?: string;
    informationLabel?: string;
    publisherLabel?: string;
    publishedDateLabel?: string;
    isbnLabel?: string;
    continueReading?: (progress: number) => string;
    readBook?: string;
    editLabel?: string;
    addToLabel?: string;
    restoreLabel?: string;
    deleteLabel?: string;
    noSynopsisMessage?: string;
    unknownAuthor?: string;
  };
  /** Custom render function for metadata rows (overrides default) */
  renderMetadata?: (book: BookDetailViewData["book"]) => React.ReactNode;
  /** Whether to show the status change controls (optional) */
  showStatusControls?: boolean;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS = {
  drawerTitle: "Details",
  synopsisLabel: "Synopsis",
  informationLabel: "Information",
  publisherLabel: "Publisher",
  publishedDateLabel: "Published Date",
  isbnLabel: "ISBN",
  continueReading: (progress: number) =>
    progress > 0 ? `Continue Reading (${progress}%)` : "Read Book",
  readBook: "Read Book",
  editLabel: "Edit",
  addToLabel: "Add to",
  restoreLabel: "Restore",
  deleteLabel: "Delete",
  noSynopsisMessage: "No synopsis available for this publication.",
  unknownAuthor: "Unknown Author",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const BookDetailsDrawer: React.FC<BookDetailsDrawerProps> = ({
  data,
  onClose,
  onOpenReader,
  onEditMetadata,
  onStatusChange,
  onTrash,
  onRestore,
  onPermanentDelete,
  onAddTag: _onAddTag,
  onAddToCollection,
  width = "380px",
  className = "",
  labels = {},
  renderMetadata,
  showStatusControls: _showStatusControls = false, // optional, but can be used to show status dropdown
}) => {
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleOpenReader = useCallback(() => {
    onOpenReader();
  }, [onOpenReader]);

  const handleEdit = useCallback(() => {
    onEditMetadata();
  }, [onEditMetadata]);

  const handleAddToCollection = useCallback(() => {
    onAddToCollection?.();
  }, [onAddToCollection]);

  const handleRestore = useCallback(() => {
    onRestore?.();
  }, [onRestore]);

  const handlePermanentDelete = useCallback(() => {
    onPermanentDelete?.();
  }, [onPermanentDelete]);

  if (!data) return null;

  const { book, authors, reading_progress } = data;
  const isTrashed = book.library_state === "trashed";

  const authorName =
    authors.length > 0 ? authors.map((a) => a.name).join(", ") : mergedLabels.unknownAuthor;

  const displayTitle = cleanDisplayTitle(book.title);

  const progressPercent = reading_progress
    ? Math.round(reading_progress.progress_percentage * 100)
    : 0;

  const continueLabel = mergedLabels.continueReading(progressPercent);

  return (
    <aside
      className={`fixed inset-y-0 right-0 bg-[#FAF7F2] border-l border-[#E5DFD3] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200 select-none ${className}`}
      style={{ width }}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
        <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider">
          {mergedLabels.drawerTitle}
        </span>
        <button
          onClick={handleClose}
          className="p-1 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors"
          aria-label="Close drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Book Cover */}
        <div className="flex justify-center">
          <div className="relative w-44 aspect-[3/4.4] rounded-lg overflow-hidden shadow-[0_12px_28px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08)] border border-[#DDD5C7]/70">
            <BookCoverThumbnail
              book={book}
              author={authorName}
              size="lg"
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Title, Subtitle, Author */}
        <div className="text-center space-y-1.5 px-2">
          <h2 className="font-serif text-xl font-bold text-[#1C1917] leading-tight">
            {displayTitle}
          </h2>
          {book.subtitle && (
            <p className="font-serif italic text-xs text-[#78716C] leading-snug">
              {book.subtitle}
            </p>
          )}
          <p className="text-xs text-[#57534E] font-medium pt-0.5">
            {authorName}
          </p>
        </div>

        {/* Action Buttons & Status */}
        <div className="space-y-3 pt-2">
          {!isTrashed ? (
            <>
              <button
                onClick={handleOpenReader}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#18181B] hover:bg-[#27272A] active:bg-[#09090B] text-white text-xs font-medium rounded-lg shadow-sm transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>{continueLabel}</span>
              </button>

              {/* Status Switcher */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#EFEAE1]/70 rounded-lg text-[11px] font-medium text-stone-600">
                <button
                  onClick={() => onStatusChange?.("unread")}
                  className={`py-1 rounded text-center transition-colors ${
                    book.reading_status === "unread" || (!book.reading_status && progressPercent === 0)
                      ? "bg-[#FAF7F2] text-[#1C1917] font-bold shadow-2xs"
                      : "hover:text-[#18181B]"
                  }`}
                >
                  Unread
                </button>
                <button
                  onClick={() => onStatusChange?.("reading")}
                  className={`py-1 rounded text-center transition-colors ${
                    book.reading_status === "reading" || (progressPercent > 0 && progressPercent < 100)
                      ? "bg-[#FAF7F2] text-[#1C1917] font-bold shadow-2xs"
                      : "hover:text-[#18181B]"
                  }`}
                >
                  Reading
                </button>
                <button
                  onClick={() => onStatusChange?.("completed")}
                  className={`py-1 rounded text-center transition-colors ${
                    book.reading_status === "completed" || progressPercent === 100
                      ? "bg-[#FAF7F2] text-[#1C1917] font-bold shadow-2xs"
                      : "hover:text-[#18181B]"
                  }`}
                >
                  Completed
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FAF7F2] hover:bg-[#F3EFE6] active:bg-[#EAE4DA] text-[#1C1917] text-xs font-medium rounded-lg border border-[#DDD5C7] shadow-2xs transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>{mergedLabels.editLabel}</span>
                </button>
                <button
                  onClick={handleAddToCollection}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FAF7F2] hover:bg-[#F3EFE6] active:bg-[#EAE4DA] text-[#1C1917] text-xs font-medium rounded-lg border border-[#DDD5C7] shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>{mergedLabels.addToLabel}</span>
                </button>
                {onTrash && (
                  <button
                    onClick={onTrash}
                    className="p-2 bg-[#FAF7F2] hover:bg-rose-50 hover:text-rose-600 active:bg-rose-100 text-[#78716C] rounded-lg border border-[#DDD5C7] shadow-2xs transition-colors"
                    title="Move to Trash"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              {onRestore && (
                <button
                  onClick={handleRestore}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{mergedLabels.restoreLabel}</span>
                </button>
              )}
              {onPermanentDelete && (
                <button
                  onClick={handlePermanentDelete}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{mergedLabels.deleteLabel}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Synopsis */}
        <div className="pt-3 space-y-2 border-t border-[#E5DFD3]">
          <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
            {mergedLabels.synopsisLabel}
          </span>
          <p className="text-xs text-[#443F39] leading-relaxed text-justify">
            {book.description?.trim()
              ? book.description
              : mergedLabels.noSynopsisMessage}
          </p>
        </div>

        {/* Metadata */}
        <div className="pt-2 space-y-2 text-xs border-t border-[#E5DFD3]">
          <div className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
            {mergedLabels.informationLabel}
          </div>
          {renderMetadata ? (
            renderMetadata(book)
          ) : (
            <>
              {book.publisher && (
                <div className="flex justify-between py-1 border-b border-[#EFEAE1]">
                  <span className="text-[#78716C]">{mergedLabels.publisherLabel}</span>
                  <span className="text-[#1C1917] font-medium">{book.publisher}</span>
                </div>
              )}
              {book.published_date && (
                <div className="flex justify-between py-1 border-b border-[#EFEAE1]">
                  <span className="text-[#78716C]">{mergedLabels.publishedDateLabel}</span>
                  <span className="text-[#1C1917] font-medium">{book.published_date}</span>
                </div>
              )}
              {book.isbn && (
                <div className="flex justify-between py-1 border-b border-[#EFEAE1]">
                  <span className="text-[#78716C]">{mergedLabels.isbnLabel}</span>
                  <span className="text-[#1C1917] font-mono text-[11px]">{book.isbn}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </aside>
  );
};