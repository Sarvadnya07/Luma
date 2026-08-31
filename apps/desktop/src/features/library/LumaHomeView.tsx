import React from "react";
import { Book } from "@luma/shared-types";
import { BookOpen } from "lucide-react";

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
  const heroBook: Book = inProgressBooks[0] || books[0] || {
    id: "book_meditations",
    title: "Meditations",
    subtitle: "Book Two: On the Inner Life",
    author_ids: [],
    series_id: null,
    series_index: null,
    description: "Personal writings of Marcus Aurelius on Stoic philosophy, duty, and human nature.",
    publisher: "Modern Library",
    published_date: "180 AD",
    language: "en",
    isbn: "978-0812968255",
    cover_image_id: null,
    cover_image_path: null,
    primary_file_id: "file_meditations",
    reading_status: "reading",
    library_state: "active",
    trashed_at: null,
    sync: {
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: "dev_01",
      is_deleted: false,
    },
  };

  const heroAuthor = authorMap[heroBook.id] || "Marcus Aurelius";

  const upNextList = unreadBooks.length > 0 
    ? unreadBooks.slice(0, 3) 
    : books.filter((b) => b.id !== heroBook.id).slice(0, 3);

  const recentlyAddedList = [...books]
    .sort((a, b) => new Date(b.sync.created_at).getTime() - new Date(a.sync.created_at).getTime())
    .slice(0, 4);

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).toUpperCase();

  return (
    <div className="space-y-8 pt-4 pb-12 animate-in fade-in duration-200">
      {/* Greeting Header matching Screenshot 3 */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-[#78716C] tracking-wider uppercase">
          {todayStr || "SANCTUARY LIBRARY"}
        </span>
        <h2 className="font-serif text-xl font-medium text-[#1C1917] leading-relaxed">
          Welcome back. You have{" "}
          <span className="font-semibold text-black">
            {inProgressBooks.length} book{inProgressBooks.length === 1 ? "" : "s"} in progress
          </span>{" "}
          and{" "}
          <span className="font-semibold text-black">
            {unreadBooks.length} unread
          </span>{" "}
          in your library.
        </h2>
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
            <div className="w-36 h-48 bg-[#EAE4DA] rounded-lg border border-[#DDD5C7] overflow-hidden shadow-md flex-shrink-0 flex items-center justify-center group-hover:-translate-y-0.5 transition-transform duration-200">
              {heroBook.cover_image_path ? (
                <img
                  src={heroBook.cover_image_path}
                  alt={heroBook.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-[#F2ECE0] to-[#E3DACB]">
                  <span className="text-[9px] uppercase tracking-widest text-[#8C8275] mb-1 font-mono">
                    {heroAuthor}
                  </span>
                  <span className="font-serif text-sm font-bold text-[#2E2924] leading-tight mb-2 line-clamp-3">
                    {heroBook.title}
                  </span>
                  <div className="w-8 h-[1px] bg-[#8C8275] mb-2" />
                  <span className="text-[8px] text-[#78716C] uppercase font-mono">
                    {heroBook.subtitle || "LUMA EDITION"}
                  </span>
                </div>
              )}
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
                  {heroBook.title}
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
                      width: heroBook.reading_status === "completed" ? "100%" : "45%",
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
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectBook(item)}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-11 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 shadow-2xs overflow-hidden">
                    {item.cover_image_path ? (
                      <img src={item.cover_image_path} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                      {item.title}
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
              return (
                <div
                  key={b.id}
                  onClick={() => onSelectBook(b)}
                  className="group flex flex-col cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
                >
                  {/* Card Thumbnail */}
                  <div className="aspect-[3/4] w-full bg-[#EAE4DA] rounded-lg border border-[#DDD5C7] overflow-hidden shadow-xs flex items-center justify-center p-3 text-center">
                    {b.cover_image_path ? (
                      <img src={b.cover_image_path} alt={b.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <BookOpen className="w-5 h-5 text-[#8C8275]" />
                        <span className="font-serif text-[11px] font-bold text-[#2E2924] line-clamp-2">
                          {b.title}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Title & Author */}
                  <div className="mt-2 space-y-0.5 px-0.5">
                    <h5 className="font-semibold text-xs text-[#1C1917] truncate group-hover:text-black">
                      {b.title}
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
