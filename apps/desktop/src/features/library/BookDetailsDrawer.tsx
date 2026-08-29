import React, { useState } from "react";
import {
  X,
  BookOpen,
  Edit3,
  Trash2,
  FileText,
  RotateCcw,
} from "lucide-react";
import { BookDetailViewData, ReadingStatus } from "@luma/shared-types";
import { Button } from "@luma/ui";

export interface BookDetailsDrawerProps {
  data: BookDetailViewData | null;
  onClose: () => void;
  onOpenReader: () => void;
  onEditMetadata: () => void;
  onStatusChange: (status: ReadingStatus) => void;
  onTrash: () => void;
  onRestore?: () => void;
  onPermanentDelete?: () => void;
  onAddTag: (name: string) => void;
}

export const BookDetailsDrawer: React.FC<BookDetailsDrawerProps> = ({
  data,
  onClose,
  onOpenReader,
  onEditMetadata,
  onStatusChange,
  onTrash,
  onRestore,
  onPermanentDelete,
  onAddTag,
}) => {
  const [newTagInput, setNewTagInput] = useState("");

  if (!data) return null;
  const { book, files, authors, series, tags, reading_progress } = data;
  const isTrashed = book.library_state === "trashed";

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-slate-950/95 border-l border-slate-800 shadow-2xl z-40 flex flex-col backdrop-blur-xl animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Publication Details
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Cover & Main Title */}
        <div className="flex gap-4">
          <div className="w-24 h-36 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
            {book.cover_image_path ? (
              <img src={book.cover_image_path} alt={book.title} className="w-full h-full object-cover" />
            ) : (
              <BookOpen className="w-8 h-8 text-slate-600" />
            )}
          </div>
          <div className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <h2 className="text-base font-bold text-slate-100 leading-snug line-clamp-2">
                {book.title}
              </h2>
              {book.subtitle && (
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">{book.subtitle}</p>
              )}
              <div className="text-xs text-sky-400 font-medium mt-1.5 truncate">
                {authors.length > 0 ? authors.map((a) => a.name).join(", ") : "Unknown Author"}
              </div>
            </div>

            {series && (
              <div className="text-[11px] text-purple-400 font-medium truncate">
                {series.title} {book.series_index ? `#${book.series_index}` : ""}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {!isTrashed ? (
            <>
              <Button variant="primary" size="sm" className="flex-1" onClick={onOpenReader}>
                <BookOpen className="w-4 h-4 mr-2" />
                Read Book
              </Button>
              <Button variant="secondary" size="sm" onClick={onEditMetadata}>
                <Edit3 className="w-4 h-4 mr-1.5" />
                Edit
              </Button>
            </>
          ) : (
            <>
              {onRestore && (
                <Button variant="primary" size="sm" className="flex-1" onClick={onRestore}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </Button>
              )}
              {onPermanentDelete && (
                <Button variant="danger" size="sm" onClick={onPermanentDelete}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete Forever
                </Button>
              )}
            </>
          )}
        </div>

        {/* Reading Progress */}
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Reading Status</span>
            <select
              value={book.reading_status}
              onChange={(e) => onStatusChange(e.target.value as ReadingStatus)}
              className="bg-slate-950 border border-slate-800 text-xs text-sky-400 rounded px-2 py-0.5"
            >
              <option value="unread">Unread</option>
              <option value="reading">Currently Reading</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {reading_progress && (
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
              <span>Progress: {(reading_progress.progress_percentage * 100).toFixed(0)}%</span>
              {reading_progress.current_page_number && (
                <span>Page {reading_progress.current_page_number} of {reading_progress.total_pages || "?"}</span>
              )}
            </div>
          )}
        </div>

        {/* Metadata Details */}
        <div className="space-y-3 text-xs">
          <div className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
            Metadata Information
          </div>
          {book.publisher && (
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Publisher</span>
              <span className="text-slate-200">{book.publisher}</span>
            </div>
          )}
          {book.published_date && (
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Published Date</span>
              <span className="text-slate-200">{book.published_date}</span>
            </div>
          )}
          {book.language && (
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">Language</span>
              <span className="text-slate-200 uppercase">{book.language}</span>
            </div>
          )}
          {book.isbn && (
            <div className="flex justify-between py-1 border-b border-slate-900">
              <span className="text-slate-400">ISBN</span>
              <span className="text-slate-200 font-mono">{book.isbn}</span>
            </div>
          )}
        </div>

        {/* Description */}
        {book.description && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Synopsis
            </span>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded-lg border border-slate-800/60 max-h-32 overflow-y-auto">
              {book.description}
            </p>
          </div>
        )}

        {/* Physical Formats & Files */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Physical Document Files</span>
            <span className="text-slate-600">{files.length} format{files.length > 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-1.5">
            {files.map((file) => (
              <div
                key={file.id}
                className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 uppercase flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-400" />
                    {file.format}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {(file.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">{file.original_filename}</div>
                <div className="text-[9px] font-mono text-slate-600 truncate">
                  SHA-256: {file.sha256_hash.slice(0, 16)}...
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Tags
          </span>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t.id} className="text-[10px] bg-slate-900 text-slate-300 border border-slate-800 px-2 py-0.5 rounded">
                #{t.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTagInput.trim()) {
                  onAddTag(newTagInput.trim());
                  setNewTagInput("");
                }
              }}
              placeholder="Add tag and press Enter..."
              className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Trash Button */}
        {!isTrashed && (
          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={onTrash}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg border border-rose-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Move to Trash
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
