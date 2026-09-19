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
      className={`group relative flex flex-col transition-all duration-200 ${
        isSelected ? "ring-2 ring-[#18181B] ring-offset-2 ring-offset-[#FAF7F2] rounded-lg" : ""
      }`}
    >
      {/* Book Cover Frame with realistic book depth and crisp border */}
      <div className="relative aspect-[3/4.2] w-full rounded-md bg-[#EAE4DA] overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.16),0_3px_8px_rgba(0,0,0,0.1)] group-hover:-translate-y-0.5 transition-all duration-200 border border-[#18181B]/15 dark:border-white/20">
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
            type="button"
            onClick={() => onOpenDetails()}
            className="absolute top-2 right-2 z-20 p-1.5 rounded-md bg-[#FAF7F2]/90 text-[#57534E] hover:text-[#18181B] hover:bg-[#FFFFFF] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all shadow-sm border border-[#DDD5C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]"
            aria-label={`Details for ${displayTitle}`}
            title="Inspect Details"
          >
            <MoreVertical className="w-3.5 h-3.5" aria-hidden="true" />
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

      {/* Primary action as a real button covering the card. The previous root
          `<div onClick>` was unreachable by keyboard. Rendered last so it paints
          above the cover; the details button sits above it via z-index. */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Open ${displayTitle}`}
        className="absolute inset-0 z-10 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF7F2]"
      />
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
  // Progress is only known where the reading status implies it, and format is
  // not a field of `Book` at all — so neither is invented here any more. The
  // previous implementation showed a fabricated "35%" and a format guessed by
  // substring-matching a file id.
  const getProgressNumber = (book: Book): number | null => {
    if (book.reading_status === "completed") return 100;
    if (book.reading_status === "unread") return 0;
    return null;
  };

  const getStatusMeta = (book: Book): { label: string; className: string } => {
    switch (book.reading_status) {
      case "completed":
        return { label: "Finished", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
      case "reading":
        return { label: "Reading", className: "bg-amber-50 text-amber-800 border-amber-200" };
      case "archived":
        return { label: "Archived", className: "bg-stone-100 text-stone-600 border-stone-200" };
      default:
        return { label: "Unread", className: "bg-stone-100 text-stone-600 border-stone-200" };
    }
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
    <div className="w-full bg-[#FFFFFF] border border-[#18181B]/15 dark:border-white/15 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <caption className="sr-only">Library books</caption>
        <thead>
          <tr className="border-b border-[#E5DFD3] bg-[#FAF7F2]/80 text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
            <th className="py-3 px-4 w-16">COVER</th>
            <th className="py-3 px-4">TITLE</th>
            <th className="py-3 px-4">AUTHOR</th>
            <th className="py-3 px-4">PROGRESS</th>
            <th className="py-3 px-4">STATUS</th>
            <th className="py-3 px-4">ADDED</th>
            {onOpenDetails && (
              <th className="py-3 px-4 text-right">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFEAE1] text-xs text-[#292524]">
          {books.map((book) => {
            const author = authorMap[book.id] || "Unknown Author";
            const progress = getProgressNumber(book);
            const status = getStatusMeta(book);
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
                      <button
                        type="button"
                        onClick={() => onSelectBook(book)}
                        className="font-serif font-bold text-left text-[#1C1917] group-hover:text-black rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]"
                      >
                        {book.title}
                      </button>
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

                {/* Progress — shown only when the reading status implies it */}
                <td className="py-3 px-4">
                  <span className="text-[11px] font-mono text-[#57534E]">
                    {progress === null ? "—" : `${progress}%`}
                  </span>
                </td>

                {/* Status badge — the real reading status, not a derived guess */}
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>

                {/* Added Date */}
                <td className="py-3 px-4 text-[11px] text-[#78716C]">
                  {formatDate(book.sync.created_at)}
                </td>

                {onOpenDetails && (
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenDetails(book)}
                      className="px-2 py-1 text-[11px] font-medium rounded-md border border-[#DDD5C7] text-[#57534E] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]"
                      aria-label={`Details for ${book.title}`}
                    >
                      Details
                    </button>
                  </td>
                )}
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
  /** Accessible label for the navigation landmark. */
  ariaLabel?: string;
}

const PAGE_GAP = "gap" as const;

/**
 * Windowed page numbers: first and last page are always present, with a bounded
 * neighbourhood around the current page. `"gap"` renders as an ellipsis.
 */
function pageWindow(currentPage: number, totalPages: number, siblingCount = 1): (number | typeof PAGE_GAP)[] {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), total);
  const start = Math.max(1, current - siblingCount);
  const end = Math.min(total, current + siblingCount);

  const ascending = new Set<number>([1]);
  for (let page = start; page <= end; page += 1) ascending.add(page);
  ascending.add(total);

  const numbers = Array.from(ascending).sort((a, b) => a - b);
  const tokens: (number | typeof PAGE_GAP)[] = [];
  numbers.forEach((page, index) => {
    const previous = numbers[index - 1];
    if (previous !== undefined && page - previous > 1) tokens.push(PAGE_GAP);
    tokens.push(page);
  });
  return tokens;
}

/**
 * Real pager: every rendered page number is navigable and the count comes from
 * the caller's actual total. (Previously this component was hardcoded to
 * `1, 2, 3, …, 12` regardless of how many pages existed — see FE-MED-4.)
 */
export const Pagination: React.FC<PaginationProps> = ({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  ariaLabel = "Pagination",
}) => {
  const total = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, currentPage), total);
  const tokens = pageWindow(current, total);

  const pageButtonClass = (isActive: boolean) =>
    `w-7 h-7 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B] ${
      isActive
        ? "bg-[#18181B] text-white dark:bg-[#F5F1EA] dark:text-[#18181B]"
        : "text-[#57534E] hover:bg-[#EFEAE1] hover:text-[#18181B]"
    }`;

  return (
    <nav
      aria-label={ariaLabel}
      className="flex items-center justify-center gap-1.5 py-6 select-none text-xs text-[#57534E]"
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, current - 1))}
        disabled={current === 1}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]"
      >
        <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Previous
      </button>

      <div className="flex items-center gap-1 mx-2">
        {tokens.map((token, index) =>
          token === PAGE_GAP ? (
            <span key={`gap-${index}`} className="px-1 text-[#A8A29E]" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={token}
              type="button"
              onClick={() => onPageChange(token)}
              aria-label={`Page ${token}`}
              aria-current={token === current ? "page" : undefined}
              className={pageButtonClass(token === current)}
            >
              {token}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(Math.min(total, current + 1))}
        disabled={current >= total}
        className="flex items-center gap-1 px-3 py-1 rounded-md text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18181B]"
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </nav>
  );
};

