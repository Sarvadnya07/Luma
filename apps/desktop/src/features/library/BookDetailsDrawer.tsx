import React from "react";
import {
  X,
  BookOpen,
  Edit,
  Plus,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { BookDetailViewData, ReadingStatus } from "@luma/shared-types";

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
}

export const BookDetailsDrawer: React.FC<BookDetailsDrawerProps> = ({
  data,
  onClose,
  onOpenReader,
  onEditMetadata,
  onStatusChange: _onStatusChange,
  onTrash: _onTrash,
  onRestore,
  onPermanentDelete,
  onAddTag: _onAddTag,
  onAddToCollection,
}) => {
  if (!data) return null;
  const { book, authors, reading_progress } = data;
  const isTrashed = book.library_state === "trashed";

  const authorName =
    authors.length > 0 ? authors.map((a) => a.name).join(", ") : "E. M. Forster";

  const progressPercent = reading_progress
    ? Math.round(reading_progress.progress_percentage * 100)
    : book.id === "book_arch_stillness"
    ? 75
    : book.id === "book_great_gatsby"
    ? 66
    : book.id === "book_meditations"
    ? 45
    : 0;

  return (
    <aside className="fixed inset-y-0 right-0 w-[380px] bg-[#FAF7F2] border-l border-[#E5DFD3] shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200 select-none">
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
        <span className="text-[11px] font-semibold text-[#78716C] uppercase tracking-wider">
          Details
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* Book Cover Frame with realistic book elevation & depth */}
        <div className="flex justify-center">
          <div className="relative w-44 aspect-[3/4.4] rounded-lg bg-[#EAE4DA] overflow-hidden shadow-[0_12px_28px_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.08)] border border-[#DDD5C7]/70">
            {book.cover_image_path ? (
              <img
                src={book.cover_image_path}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#F5EFE6] to-[#EAE2D5]">
                <BookOpen className="w-10 h-10 text-[#8C8275] mb-2" />
                <span className="font-serif text-xs font-semibold text-[#3D3833] line-clamp-3">
                  {book.title}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Title, Subtitle, Author */}
        <div className="text-center space-y-1.5 px-2">
          <h2 className="font-serif text-xl font-bold text-[#1C1917] leading-tight">
            {book.title}
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

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          {!isTrashed ? (
            <>
              {/* Primary Continue Reading button */}
              <button
                onClick={onOpenReader}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#18181B] hover:bg-[#27272A] active:bg-[#09090B] text-white text-xs font-medium rounded-lg shadow-sm transition-all"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  {progressPercent > 0 ? `Continue Reading (${progressPercent}%)` : "Read Book"}
                </span>
              </button>

              {/* Secondary Actions Row */}
              <div className="flex gap-2.5">
                <button
                  onClick={onEditMetadata}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FAF7F2] hover:bg-[#F3EFE6] active:bg-[#EAE4DA] text-[#1C1917] text-xs font-medium rounded-lg border border-[#DDD5C7] shadow-2xs transition-colors"
                >
                  <Edit className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={onAddToCollection}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#FAF7F2] hover:bg-[#F3EFE6] active:bg-[#EAE4DA] text-[#1C1917] text-xs font-medium rounded-lg border border-[#DDD5C7] shadow-2xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-[#57534E]" />
                  <span>Add to</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex gap-2">
              {onRestore && (
                <button
                  onClick={onRestore}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              )}
              {onPermanentDelete && (
                <button
                  onClick={onPermanentDelete}
                  className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded-lg"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Synopsis Section matching Screen 1 */}
        <div className="pt-3 space-y-2 border-t border-[#E5DFD3]">
          <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
            Synopsis
          </span>
          <p className="text-xs text-[#443F39] leading-relaxed text-justify">
            {book.description ||
              "In this profound exploration of spatial dynamics within literature, the author examines how the physical environments constructed by modernist writers serve as vessels for silence and psychological depth. Drawing on architectural theory and literary analysis, the book offers a new perspective on the deliberate use of emptiness in narrative structure."}
          </p>
        </div>

        {/* Metadata Details */}
        <div className="pt-2 space-y-2 text-xs border-t border-[#E5DFD3]">
          <div className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
            Information
          </div>
          {book.publisher && (
            <div className="flex justify-between py-1 border-b border-[#EFEAE1]">
              <span className="text-[#78716C]">Publisher</span>
              <span className="text-[#1C1917] font-medium">{book.publisher}</span>
            </div>
          )}
          {book.published_date && (
            <div className="flex justify-between py-1 border-b border-[#EFEAE1]">
              <span className="text-[#78716C]">Published Date</span>
              <span className="text-[#1C1917] font-medium">{book.published_date}</span>
            </div>
          )}
          {book.isbn && (
            <div className="flex justify-between py-1 border-b border-[#EFEAE1]">
              <span className="text-[#78716C]">ISBN</span>
              <span className="text-[#1C1917] font-mono text-[11px]">{book.isbn}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

