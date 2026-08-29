import React from "react";
import { Book } from "@luma/shared-types";
import { Badge } from "@luma/ui";

export interface BookCardProps {
  book: Book;
  onSelect: (bookId: string) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onSelect }) => {
  return (
    <div
      onClick={() => onSelect(book.id)}
      className="group flex flex-col p-4 bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-sky-500/50 rounded-xl cursor-pointer transition-all duration-150 shadow-sm"
    >
      <div className="aspect-[2/3] w-full bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 mb-3 overflow-hidden">
        {book.cover_image_path ? (
          <img src={book.cover_image_path} alt={book.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl font-serif text-slate-600 font-bold">{book.title.charAt(0)}</span>
        )}
      </div>
      <h3 className="font-semibold text-slate-100 text-sm line-clamp-1 group-hover:text-sky-400 transition-colors">
        {book.title}
      </h3>
      {book.subtitle && (
        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{book.subtitle}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <Badge variant="default">{book.language ?? "EPUB"}</Badge>
        <span>v{book.sync.version}</span>
      </div>
    </div>
  );
};
