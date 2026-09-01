import React from "react";
import { Book } from "@luma/shared-types";
import { BookOpen, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";

export function cleanDisplayTitle(raw: string): string {
  if (!raw) return "Untitled Document";
  let t = raw.trim();
  t = t.replace(/^[0-9a-fA-F]{24,64}[\s_-]+/, "");
  t = t.replace(/\s*(\(\s*(?:pdfdrive|z-lib\.org|oceanofpdf|libgen|retail|original)\s*\)|retailnbsped|nbsped)\s*/gi, " ");
  t = t.replace(/[_-]/g, " ").trim();

  if (t === t.toLowerCase() || t === t.toUpperCase()) {
    t = t
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return t || "Untitled Document";
}

const PALETTES = [
  { bg: "from-[#2C1810] to-[#1A0F0A]", border: "border-[#4A2E20]", text: "text-[#E6C280]", sub: "text-[#A88B58]" },
  { bg: "from-[#0F2027] to-[#203A43]", border: "border-[#2C5364]", text: "text-[#E0EAFC]", sub: "text-[#8BA4B8]" },
  { bg: "from-[#134E5E] to-[#2B580C]", border: "border-[#3B6E1E]", text: "text-[#E2F0D9]", sub: "text-[#9EBF88]" },
  { bg: "from-[#3D0C11] to-[#631922]", border: "border-[#8A2938]", text: "text-[#FCE4E6]", sub: "text-[#D48995]" },
  { bg: "from-[#232526] to-[#414345]", border: "border-[#55585C]", text: "text-[#F5F5F5]", sub: "text-[#9E9E9E]" },
  { bg: "from-[#4A2810] to-[#6E3B18]", border: "border-[#8F4E22]", text: "text-[#FDEBD0]", sub: "text-[#D29F68]" },
];

function getPalette(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length]!;
}

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
  const displayTitle = cleanDisplayTitle(book.title);
  const palette = getPalette(book.id + book.title);

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
          <div className="relative w-full h-full">
            <img
              src={book.cover_image_path}
              alt={displayTitle}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/25 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${palette.bg} ${palette.border} border p-3 flex flex-col justify-between text-center relative overflow-hidden shadow-inner`}>
            <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/40 to-transparent pointer-events-none" />
            <span className={`text-[8px] uppercase tracking-widest ${palette.sub} font-mono block truncate pt-0.5`}>
              {authorName !== "Unknown Author" ? authorName : "Luma Classic"}
            </span>
            <div className="my-auto px-0.5">
              <BookOpen className="w-3.5 h-3.5 mx-auto mb-1 opacity-60 text-white" />
              <span className={`font-serif text-[11px] font-semibold leading-tight ${palette.text} line-clamp-3`}>
                {displayTitle}
              </span>
            </div>
            <span className="text-[7px] text-white/30 uppercase tracking-wider font-mono pb-0.5">
              {book.primary_file_id ? "Digital Copy" : "Luma"}
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
          title={displayTitle}
        >
          {displayTitle}
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
  onOpenDetails: _onOpenDetails,
}) => {
  const getProgressNumber = (book: Book) => {
    if (book.reading_status === "completed") return 100;
    if (book.reading_status === "unread") return 0;
    return 35;
  };

  const getFormat = (book: Book) => {
    if (book.primary_file_id) {
      const lower = book.primary_file_id.toLowerCase();
      if (lower.includes("pdf")) return "PDF";
      if (lower.includes("cbz")) return "CBZ";
      if (lower.includes("md")) return "MD";
      if (lower.includes("txt")) return "TXT";
    }
    return "EPUB";
  };

  const getCategory = (book: Book) => {
    if (book.subtitle) return book.subtitle;
    if (book.language) return `Language: ${book.language.toUpperCase()}`;
    return "Publication";
  };

  const getSeriesTag = (book: Book) => {
    if (book.series_id) {
      return book.series_index ? `${book.series_id} #${book.series_index}` : book.series_id;
    }
    return null;
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    } catch {
      return "Recent";
    }
  };

  return (
    <div className="w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl overflow-hidden shadow-2xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#E5DFD3] bg-[#FAF7F2]/80 text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
            <th className="py-3 px-4 w-16">COVER</th>
            <th className="py-3 px-4">TITLE</th>
            <th className="py-3 px-4">AUTHOR</th>
            <th className="py-3 px-4">FORMAT</th>
            <th className="py-3 px-4">PROGRESS</th>
            <th className="py-3 px-4">STATUS</th>
            <th className="py-3 px-4">ADDED</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFEAE1] text-xs text-[#292524]">
          {books.map((book) => {
            const author = authorMap[book.id] || "Unknown Author";
            const progress = getProgressNumber(book);
            const isSelected = selectedBookId === book.id;
            const seriesTag = getSeriesTag(book);
            const category = getCategory(book);

            return (
              <tr
                key={book.id}
                onClick={() => onSelectBook(book)}
                className={`hover:bg-[#FAF6EF] transition-colors cursor-pointer group ${
                  isSelected ? "bg-[#F5EFE6]" : ""
                }`}
              >
                {/* Cover thumbnail */}
                <td className="py-3 px-4">
                  <div className="w-8 h-11 rounded bg-[#EAE4DA] overflow-hidden border border-[#DDD5C7] shadow-xs flex items-center justify-center flex-shrink-0">
                    {book.cover_image_path ? (
                      <img src={book.cover_image_path} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
                    )}
                  </div>
                </td>

                {/* Title & Tags */}
                <td className="py-3 px-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-serif font-bold text-[#1C1917] group-hover:text-black">
                        {book.title}
                      </span>
                      {seriesTag && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EFEAE1] text-[#78716C] border border-[#DDD5C7]">
                          {seriesTag}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#78716C]">
                      {category}
                    </p>
                  </div>
                </td>

                {/* Author */}
                <td className="py-3 px-4 text-[#57534E] font-medium">
                  {author}
                </td>

                {/* Format */}
                <td className="py-3 px-4">
                  <span className="inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border border-[#D6CEC2] bg-[#F2EDE4] text-[#443F39]">
                    {getFormat(book)}
                  </span>
                </td>

                {/* Progress */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#78716C]">—</span>
                    <span className="text-[11px] font-mono text-[#57534E] min-w-[32px]">
                      {progress}%
                    </span>
                  </div>
                </td>

                {/* Status Badge */}
                <td className="py-3 px-4">
                  {progress === 100 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      Finished
                    </span>
                  ) : progress > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                      <BookOpen className="w-3 h-3 text-amber-700" />
                      Reading
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                      Unread
                    </span>
                  )}
                </td>

                {/* Added Date */}
                <td className="py-3 px-4 text-[11px] text-[#78716C]">
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

