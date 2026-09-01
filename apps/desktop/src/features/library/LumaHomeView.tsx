import React, { useMemo, useCallback } from "react";
import { Book } from "@luma/shared-types";
import { BookOpen } from "lucide-react";
import { BookCoverThumbnail, cleanDisplayTitle } from "./BookCoverThumbnail";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface LumaHomeViewLabels {
  // Empty state
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  // Header
  headerTitle?: string;
  headerSubtitle?: (count: number) => string;
  // Sections
  continueReadingLabel?: string;
  upNextLabel?: string;
  viewAllLabel?: string;
  recentlyAddedLabel?: string;
  // Status badges
  inProgressLabel?: string;
  availableLabel?: string;
  // Book details
  continueWhereLabel?: string;
  readingStatusLabel?: string;
  unknownAuthor?: string;
}

export interface LumaHomeViewProps {
  books?: Book[];
  authorMap?: Record<string, string>;
  onSelectBook: (book: Book) => void;
  onOpenReader: (book: Book) => void;
  onViewAll?: () => void;
  /** Custom empty state action (e.g., open import) */
  onEmptyAction?: () => void;
  labels?: LumaHomeViewLabels;
  className?: string;
  style?: React.CSSProperties;
  /** Custom icon for empty state (default: BookOpen) */
  emptyStateIcon?: React.ReactNode;
  /** Label for the empty state action button */
  emptyStateActionLabel?: string;
  /** Custom render for the hero section (overrides default) */
  renderHero?: (heroBook: Book, heroAuthor: string) => React.ReactNode;
  /** Custom render for the up next list (overrides default) */
  renderUpNext?: (books: Book[]) => React.ReactNode;
  /** Custom render for the recently added grid (overrides default) */
  renderRecentlyAdded?: (books: Book[]) => React.ReactNode;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<LumaHomeViewLabels> = {
  emptyTitle: "Your Sanctuary Library is Empty",
  emptyDescription: "Import your first EPUB or PDF document to start reading and annotating.",
  emptyActionLabel: "Import Book",
  headerTitle: "Reading Sanctuary",
  headerSubtitle: (count: number) => `Your personal knowledge haven • ${count} publications`,
  continueReadingLabel: "Continue Reading",
  upNextLabel: "Up Next",
  viewAllLabel: "View All",
  recentlyAddedLabel: "Recently Added",
  inProgressLabel: "In Progress",
  availableLabel: "Available",
  continueWhereLabel: "Continue where you left off",
  readingStatusLabel: "Reading",
  unknownAuthor: "Unknown Author",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const LumaHomeView: React.FC<LumaHomeViewProps> = ({
  books = [],
  authorMap = {},
  onSelectBook,
  onOpenReader,
  onViewAll,
  onEmptyAction,
  labels: customLabels = {},
  className = "",
  style,
  emptyStateIcon = <BookOpen className="w-12 h-12 text-[#A8A29E] mb-3" />,
  emptyStateActionLabel,
  renderHero,
  renderUpNext,
  renderRecentlyAdded,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  // Derived data
  const {
    heroBook,
    heroAuthor,
    upNextBooks,
    recentlyAddedBooks,
    totalCount,
  } = useMemo(() => {
    const total = books.length;
    const inProgress = books.filter((b) => b.reading_status === "reading");
    const unread = books.filter((b) => b.reading_status === "unread");
    const hero = inProgress[0] || books[0] || null;
    const heroAuthorName = hero ? authorMap[hero.id] || labels.unknownAuthor : "";

    let upNext: Book[];
    if (unread.length > 0) {
      upNext = unread.slice(0, 3);
    } else if (hero) {
      upNext = books.filter((b) => b.id !== hero.id).slice(0, 3);
    } else {
      upNext = books.slice(0, 3);
    }

    const recentlyAdded = [...books]
      .sort(
        (a, b) =>
          new Date(b.sync?.created_at || 0).getTime() -
          new Date(a.sync?.created_at || 0).getTime()
      )
      .slice(0, 8);

    return {
      heroBook: hero,
      heroAuthor: heroAuthorName,
      upNextBooks: upNext,
      recentlyAddedBooks: recentlyAdded,
      totalCount: total,
    };
  }, [books, authorMap, labels.unknownAuthor]);

  // Handlers
  const handleSelectBook = useCallback(
    (book: Book) => {
      onSelectBook(book);
    },
    [onSelectBook]
  );

  const handleOpenReader = useCallback(
    (book: Book) => {
      onOpenReader(book);
    },
    [onOpenReader]
  );

  const handleViewAll = useCallback(() => {
    onViewAll?.();
  }, [onViewAll]);

  const handleEmptyAction = useCallback(() => {
    onEmptyAction?.();
  }, [onEmptyAction]);

  // Empty state
  if (books.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center text-[#78716C] border border-dashed border-[#DDD5C7] rounded-2xl p-16 my-8 bg-[#FFFFFF]/50 ${className}`}
        style={style}
        role="status"
        aria-label="Empty library"
      >
        {emptyStateIcon}
        <h3 className="font-serif text-lg font-bold text-[#1C1917]">
          {labels.emptyTitle}
        </h3>
        <p className="text-xs text-[#78716C] mt-1 mb-5 text-center max-w-sm">
          {labels.emptyDescription}
        </p>
        {onEmptyAction && (
          <button
            onClick={handleEmptyAction}
            className="py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg shadow-sm dark:bg-[#F2C14E] dark:text-[#141312] dark:hover:bg-[#FFD66E]"
          >
            {emptyStateActionLabel || labels.emptyActionLabel}
          </button>
        )}
      </div>
    );
  }

  // If no hero (should not happen since books > 0)
  if (!heroBook) return null;

  // Compute hero display title
  const heroDisplayTitle = cleanDisplayTitle(heroBook.title);

  return (
    <div
      className={`space-y-8 animate-in fade-in duration-200 ${className}`}
      style={style}
      role="main"
      aria-label="Library home"
    >
      {/* Header Greeting */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1917] tracking-tight">
            {labels.headerTitle}
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5 font-sans">
            {labels.headerSubtitle(totalCount)}
          </p>
        </div>
      </div>

      {/* Main Grid: Continue Reading Hero (Left) + Up Next (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Reading Hero Card */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-serif text-base font-bold text-[#1C1917]">
            {labels.continueReadingLabel}
          </h3>

          {renderHero ? (
            renderHero(heroBook, heroAuthor)
          ) : (
            <div
              onClick={() => handleOpenReader(heroBook)}
              className="group relative bg-[#F7F3EB]/90 hover:bg-[#F5EFE4] border border-[#E5DFD3] rounded-2xl p-6 flex flex-col sm:flex-row gap-6 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-sm"
              role="button"
              tabIndex={0}
              aria-label={`Continue reading ${heroDisplayTitle}`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleOpenReader(heroBook);
                }
              }}
            >
              {/* Book Cover Frame */}
              <div className="w-36 h-48 rounded-lg overflow-hidden shadow-md flex-shrink-0 flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-200">
                <BookCoverThumbnail
                  book={heroBook}
                  author={heroAuthor}
                  size="lg"
                  className="w-full h-full"
                />
              </div>

              {/* Book Details */}
              <div className="flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  {/* Category / Status Pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-white border border-[#E5DFD3] rounded-full text-[#57534E]">
                      {heroBook.reading_status === "reading"
                        ? labels.inProgressLabel
                        : labels.availableLabel}
                    </span>
                    {heroBook.language && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-white border border-[#E5DFD3] rounded-full text-[#57534E]">
                        {heroBook.language.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Title and Author */}
                  <h4 className="font-serif text-2xl font-bold text-[#1C1917] group-hover:text-black transition-colors line-clamp-2">
                    {heroDisplayTitle}
                  </h4>
                  <p className="text-xs text-[#78716C]">
                    {heroAuthor}
                  </p>
                </div>

                {/* Progress Bar & Chapter */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-[#57534E] font-medium truncate max-w-xs">
                      {heroBook.subtitle || labels.continueWhereLabel}
                    </span>
                    <span className="font-mono font-semibold text-[#1C1917]">
                      {heroBook.reading_status === "completed"
                        ? "100%"
                        : labels.readingStatusLabel}
                    </span>
                  </div>
                  <div className="w-full h-[3px] bg-[#E5DFD3] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#18181B] transition-all duration-300"
                      style={{
                        width:
                          heroBook.reading_status === "completed"
                            ? "100%"
                            : heroBook.reading_status === "reading"
                            ? "50%"
                            : "0%",
                      }}
                      role="progressbar"
                      aria-valuenow={
                        heroBook.reading_status === "completed"
                          ? 100
                          : heroBook.reading_status === "reading"
                          ? 50
                          : 0
                      }
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Up Next List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base font-bold text-[#1C1917]">
              {labels.upNextLabel}
            </h3>
            {onViewAll && (
              <button
                onClick={handleViewAll}
                className="text-[11px] text-[#78716C] hover:text-[#18181B] font-medium transition-colors"
                aria-label={labels.viewAllLabel}
              >
                {labels.viewAllLabel}
              </button>
            )}
          </div>

          {renderUpNext ? (
            renderUpNext(upNextBooks)
          ) : (
            <div className="space-y-2" role="list">
              {upNextBooks.map((item) => {
                const author = authorMap[item.id] || labels.unknownAuthor;
                const title = cleanDisplayTitle(item.title);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectBook(item)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white hover:bg-[#FAF7F2] border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
                    role="listitem"
                    tabIndex={0}
                    aria-label={`Select ${title}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectBook(item);
                      }
                    }}
                  >
                    <div className="w-8 h-11 rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 shadow-2xs overflow-hidden">
                      <BookCoverThumbnail
                        book={item}
                        author={author}
                        size="sm"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                        {title}
                      </h5>
                      <p className="text-[10px] text-[#78716C] truncate">
                        {author}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recently Added Section (Bottom Shelf) */}
      {recentlyAddedBooks.length > 0 && (
        <div className="space-y-4 pt-2">
          <h3 className="font-serif text-base font-bold text-[#1C1917]">
            {labels.recentlyAddedLabel}
          </h3>

          {renderRecentlyAdded ? (
            renderRecentlyAdded(recentlyAddedBooks)
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-4 gap-5"
              role="list"
              aria-label="Recently added books"
            >
              {recentlyAddedBooks.map((b) => {
                const author = authorMap[b.id] || labels.unknownAuthor;
                const title = cleanDisplayTitle(b.title);
                return (
                  <div
                    key={b.id}
                    onClick={() => handleSelectBook(b)}
                    className="group flex flex-col cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
                    role="listitem"
                    tabIndex={0}
                    aria-label={`Select ${title}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectBook(b);
                      }
                    }}
                  >
                    <div className="aspect-[3/4] w-full rounded-lg overflow-hidden shadow-xs flex items-center justify-center text-center">
                      <BookCoverThumbnail
                        book={b}
                        author={author}
                        size="md"
                        className="w-full h-full"
                      />
                    </div>
                    <div className="mt-2 space-y-0.5 px-0.5">
                      <h5 className="font-semibold text-xs text-[#1C1917] truncate group-hover:text-black">
                        {title}
                      </h5>
                      <p className="text-[10px] text-[#78716C] truncate">
                        {author}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};