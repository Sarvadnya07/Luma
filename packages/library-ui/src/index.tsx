import React from "react";
import { Book } from "@luma/shared-types";
import { Badge } from "@luma/ui";
import { BookOpen, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";

export interface BookCardProps {
  book: Book;
  authorName?: string;
  isSelected?: boolean;
  onSelect: () => void;
  onOpenDetails?: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  authorName = "Unknown Author",
  isSelected = false,
  onSelect,
  onOpenDetails,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col cursor-pointer transition-all duration-200 ${
        isSelected ? "ring-2 ring-[#18181B] ring-offset-2 ring-offset-[#FAF7F2] rounded-lg" : ""
      }`}
    >
      {/* Book Cover Frame with realistic book depth */}
      <div className="relative aspect-[3/4.2] w-full rounded-md bg-[#EAE4DA] overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.08)] group-hover:-translate-y-0.5 transition-all duration-200 border border-[#DDD5C7]/60">
        {book.cover_image_path ? (
          <img
            src={book.cover_image_path}
            alt={book.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#F5EFE6] to-[#EAE2D5]">
            <BookOpen className="w-8 h-8 text-[#8C8275] mb-2" />
            <span className="font-serif text-xs font-semibold text-[#3D3833] line-clamp-2 px-1">
              {book.title}
            </span>
          </div>
        )}

        {/* Hover Inspect Details Button */}
        {onOpenDetails && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetails();
            }}
            className="absolute top-2 right-2 p-1.5 rounded-md bg-[#FAF7F2]/90 text-[#57534E] hover:text-[#18181B] hover:bg-[#FFFFFF] opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-[#DDD5C7]"
            title="Inspect Details"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Book Metadata below cover */}
      <div className="mt-2.5 px-0.5 space-y-0.5">
        <h3
          className="text-xs font-semibold text-[#1C1917] line-clamp-1 group-hover:text-black transition-colors"
          title={book.title}
        >
          {book.title}
        </h3>
        <p className="text-[11px] text-[#78716C] line-clamp-1 hover:underline underline-offset-2">
          {authorName}
        </p>
      </div>
    </div>
  );
};

export interface BookTableProps {
  books: Book[];
  authorMap?: Record<string, string>;
  selectedBookId?: string | null;
  onSelectBook: (book: Book) => void;
  onOpenDetails?: (book: Book) => void;
}

export const BookTable: React.FC<BookTableProps> = ({
  books,
  authorMap = {},
  selectedBookId,
  onSelectBook,
  onOpenDetails,
}) => {
  const getProgressLabel = (book: Book) => {
    if (book.reading_status === "completed") return "Read";
    if (book.id === "book_arch_stillness") return "75%";
    if (book.id === "book_great_gatsby") return "66%";
    if (book.id === "book_meditations") return "45%";
    if (book.id === "book_design_everyday") return "12%";
    if (book.reading_status === "unread") return "0%";
    return "25%";
  };

  const getFormat = (book: Book) => {
    return book.id === "book_design_everyday" ? "PDF" : "EPUB";
  };

  const getSeries = (book: Book) => {
    if (book.series_id || book.id === "book_foundation") return "Foundation #1";
    return "—";
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return "Oct 12, 2023";
    }
  };

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E5DFD3] bg-[#F7F3EB]/70 text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
            <th className="py-3 px-4 w-16">COVER</th>
            <th className="py-3 px-4">TITLE</th>
            <th className="py-3 px-4">AUTHOR</th>
            <th className="py-3 px-4">SERIES</th>
            <th className="py-3 px-4">FORMAT</th>
            <th className="py-3 px-4">PROGRESS</th>
            <th className="py-3 px-4">ADDED</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFEAE1] text-xs text-[#292524]">
          {books.map((book) => {
            const author = authorMap[book.id] || "Unknown Author";
            const progress = getProgressLabel(book);
            const isSelected = selectedBookId === book.id;

            return (
              <tr
                key={book.id}
                onClick={() => onSelectBook(book)}
                className={`hover:bg-[#FAF6EF] transition-colors cursor-pointer group ${
                  isSelected ? "bg-[#F5EFE6]" : ""
                }`}
              >
                {/* Cover thumbnail */}
                <td className="py-2.5 px-4">
                  <div className="w-9 h-12 rounded bg-[#EAE4DA] overflow-hidden border border-[#DDD5C7] shadow-xs flex items-center justify-center">
                    {book.cover_image_path ? (
                      <img src={book.cover_image_path} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-4 h-4 text-[#8C8275]" />
                    )}
                  </div>
                </td>

                {/* Title */}
                <td className="py-2.5 px-4 font-semibold text-[#1C1917] group-hover:text-black">
                  {book.title}
                </td>

                {/* Author */}
                <td className="py-2.5 px-4 text-[#57534E]">
                  {author}
                </td>

                {/* Series */}
                <td className="py-2.5 px-4 text-[#78716C]">
                  {getSeries(book)}
                </td>

                {/* Format */}
                <td className="py-2.5 px-4">
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-[#D6CEC2] bg-[#F2EDE4] text-[#443F39]">
                    {getFormat(book)}
                  </span>
                </td>

                {/* Progress */}
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[#A8A29E]">—</span>
                    <span className="text-xs text-[#57534E] font-medium min-w-[32px]">{progress}</span>
                  </div>
                </td>

                {/* Added Date */}
                <td className="py-2.5 px-4 text-[#78716C] whitespace-nowrap">
                  {formatDate(book.sync.created_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 12,
  onPageChange,
}) => {
  return (
    <div className="flex items-center justify-center gap-1.5 py-6 select-none text-xs text-[#57534E]">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Previous
      </button>

      <div className="flex items-center gap-1 mx-2">
        <button
          onClick={() => onPageChange(1)}
          className={`w-7 h-7 rounded-md font-medium transition-colors ${
            currentPage === 1
              ? "bg-[#18181B] text-white"
              : "text-[#57534E] hover:bg-[#EFEAE1] hover:text-[#18181B]"
          }`}
        >
          1
        </button>

        <button
          onClick={() => onPageChange(2)}
          className={`w-7 h-7 rounded-md font-medium transition-colors ${
            currentPage === 2
              ? "bg-[#18181B] text-white"
              : "text-[#57534E] hover:bg-[#EFEAE1] hover:text-[#18181B]"
          }`}
        >
          2
        </button>

        <button
          onClick={() => onPageChange(3)}
          className={`w-7 h-7 rounded-md font-medium transition-colors ${
            currentPage === 3
              ? "bg-[#18181B] text-white"
              : "text-[#57534E] hover:bg-[#EFEAE1] hover:text-[#18181B]"
          }`}
        >
          3
        </button>

        <span className="px-1 text-[#A8A29E]">...</span>

        <button
          onClick={() => onPageChange(12)}
          className={`w-7 h-7 rounded-md font-medium transition-colors ${
            currentPage === 12
              ? "bg-[#18181B] text-white"
              : "text-[#57534E] hover:bg-[#EFEAE1] hover:text-[#18181B]"
          }`}
        >
          12
        </button>
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

