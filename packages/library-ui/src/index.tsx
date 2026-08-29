import React from "react";
import { Book } from "@luma/shared-types";
import { Badge } from "@luma/ui";
import { BookOpen, MoreVertical } from "lucide-react";

export interface BookCardProps {
  book: Book;
  onSelect: () => void;
  onOpenDetails?: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onSelect,
  onOpenDetails,
}) => {
  const statusColor =
    book.reading_status === "completed"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : book.reading_status === "reading"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
      : "bg-slate-800 text-slate-400 border-slate-700";

  return (
    <div className="group relative flex flex-col bg-slate-900/60 border border-slate-800/80 rounded-xl overflow-hidden hover:border-slate-700 hover:shadow-xl transition-all duration-200">
      {/* Cover / Preview Box */}
      <div
        onClick={onSelect}
        className="relative aspect-[3/4] bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden border-b border-slate-800/60 group-hover:scale-[1.01] transition-transform"
      >
        {book.cover_image_path ? (
          <img
            src={book.cover_image_path}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <BookOpen className="w-10 h-10 text-slate-700 mb-2 group-hover:text-sky-400 transition-colors" />
            <span className="text-xs text-slate-500 font-medium line-clamp-2 px-2">
              {book.title}
            </span>
          </div>
        )}

        {/* Status Badge Overlay */}
        <div className="absolute top-2 left-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusColor}`}>
            {book.reading_status}
          </span>
        </div>

        {/* Action button */}
        {onOpenDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-400 hover:text-slate-100 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-md"
            title="Inspect Details"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Book Metadata */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <h3
            onClick={onSelect}
            className="text-sm font-semibold text-slate-100 line-clamp-1 group-hover:text-sky-400 cursor-pointer transition-colors"
            title={book.title}
          >
            {book.title}
          </h3>
          {book.subtitle && (
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{book.subtitle}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/60 text-xs text-slate-500">
          <span className="truncate max-w-[120px]">
            {book.publisher || "Local Document"}
          </span>
          {book.published_date && <span>{book.published_date.slice(0, 4)}</span>}
        </div>
      </div>
    </div>
  );
};

export interface BookListItemProps {
  book: Book;
  onSelect: () => void;
  onOpenDetails?: () => void;
}

export const BookListItem: React.FC<BookListItemProps> = ({
  book,
  onSelect,
  onOpenDetails,
}) => {
  return (
    <div
      onClick={onSelect}
      className="group flex items-center justify-between p-3 rounded-xl bg-slate-900/40 hover:bg-slate-850 border border-slate-800/60 hover:border-slate-700 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-10 h-14 bg-slate-950 rounded border border-slate-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {book.cover_image_path ? (
            <img src={book.cover_image_path} alt={book.title} className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-5 h-5 text-slate-600 group-hover:text-sky-400" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-slate-100 group-hover:text-sky-400 truncate">
            {book.title}
          </h4>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {book.subtitle || book.publisher || "Local Publication"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <Badge variant={book.reading_status === "completed" ? "success" : "default"}>
          {book.reading_status}
        </Badge>
        {onOpenDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
