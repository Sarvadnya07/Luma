import React from "react";
import { Book } from "@luma/shared-types";
import { BookOpen } from "lucide-react";
import { BookCoverThumbnail, cleanDisplayTitle } from "./BookCoverThumbnail";

export interface LumaHomeViewProps {
  books?: Book[];
  authorMap?: Record<string, string>;
  onSelectBook: (book: Book) => void;
  onOpenReader: (book: Book) => void;
  onViewAll?: () => void;
}

export const LumaHomeView: React.FC<LumaHomeViewProps> = ({
  books = [],
  authorMap = {},
  onSelectBook,
  onOpenReader,
  onViewAll,
}) => {
  const inProgressBooks = books.filter((b) => b.reading_status === "reading");
  const unreadBooks = books.filter((b) => b.reading_status === "unread");

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-[#78716C] border border-dashed border-[#DDD5C7] rounded-2xl p-16 my-8 bg-[#FFFFFF]/50">
        <BookOpen className="w-12 h-12 text-[#A8A29E] mb-3" />
        <h3 className="font-serif text-lg font-bold text-[#1C1917]">
          Your Sanctuary Library is Empty
        </h3>
        <p className="text-xs text-[#78716C] mt-1 mb-5 text-center max-w-sm">
          Import your first EPUB or PDF document to start reading and annotating.
        </p>
      </div>
    );
  }

  const heroBook: Book = inProgressBooks[0] || books[0]!;
  const heroAuthor = authorMap[heroBook.id] || "Unknown Author";

  const upNextList =
    unreadBooks.length > 0
      ? unreadBooks.slice(0, 3)
      : books.filter((b) => b.id !== heroBook.id).slice(0, 3);

  const recentlyAddedList = [...books]
    .sort(
      (a, b) =>
        new Date(b.sync.created_at).getTime() -
        new Date(a.sync.created_at).getTime()
    )
    .slice(0, 8);

  const heroDisplayTitle = cleanDisplayTitle(heroBook.title);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header Greeting */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1917] tracking-tight">
            Reading Sanctuary
          </h2>
          <p className="text-xs text-[#78716C] mt-0.5 font-sans">
            Your personal knowledge haven • {books.length} publications
          </p>
        </div>
      </div>

      {/* Main Grid: Continue Reading Hero (Left) + Up Next (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Continue Reading Hero Card */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="font-serif text-base font-bold text-[#1C1917]">
            Continue Reading
          </h3>
          <div
            onClick={() => onOpenReader(heroBook)}
            className="group relative bg-[#F7F3EB]/90 hover:bg-[#F5EFE4] border border-[#E5DFD3] rounded-2xl p-6 flex flex-col sm:flex-row gap-6 cursor-pointer transition-all duration-200 shadow-2xs hover:shadow-sm"
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
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-full text-[#57534E]">
                    {heroBook.reading_status === "reading" ? "In Progress" : "Available"}
                  </span>
                  {heroBook.language && (
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-full text-[#57534E]">
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
                    {heroBook.subtitle || "Continue where you left off"}
                  </span>
                  <span className="font-mono font-semibold text-[#1C1917]">
                    {heroBook.reading_status === "completed" ? "100%" : "Reading"}
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
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Up Next List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-base font-bold text-[#1C1917]">
              Up Next
            </h3>
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="text-[11px] text-[#78716C] hover:text-[#18181B] font-medium transition-colors"
              >
                View All
              </button>
            )}
          </div>

          <div className="space-y-2">
            {upNextList.map((item) => {
              const author = authorMap[item.id] || "Unknown Author";
              const title = cleanDisplayTitle(item.title);
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectBook(item)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
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
        </div>
      </div>

      {/* Recently Added Section (Bottom Shelf) */}
      {recentlyAddedList.length > 0 && (
        <div className="space-y-4 pt-2">
          <h3 className="font-serif text-base font-bold text-[#1C1917]">
            Recently Added
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {recentlyAddedList.map((b) => {
              const author = authorMap[b.id] || "Unknown Author";
              const title = cleanDisplayTitle(b.title);
              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBook(b)}
                  className="group flex flex-col cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
                >
                  {/* Card Thumbnail */}
                  <div className="aspect-[3/4] w-full rounded-lg overflow-hidden shadow-xs flex items-center justify-center text-center">
                    <BookCoverThumbnail
                      book={b}
                      author={author}
                      size="md"
                      className="w-full h-full"
                    />
                  </div>

                  {/* Title & Author */}
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
        </div>
      )}
    </div>
  );
};
