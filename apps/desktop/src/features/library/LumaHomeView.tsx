import React from "react";
import { Book } from "@luma/shared-types";
import { BookOpen, FileText } from "lucide-react";

export interface LumaHomeViewProps {
  onSelectBook: (book: Book) => void;
  onOpenReader: (book: Book) => void;
  onViewAll?: () => void;
}

export const LumaHomeView: React.FC<LumaHomeViewProps> = ({
  onSelectBook,
  onOpenReader,
  onViewAll,
}) => {
  const heroBook: Book = {
    id: "book_meditations",
    title: "Meditations",
    subtitle: "Book Two: On the Inner Life",
    author_ids: ["auth_marcus"],
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

  const upNextBooks = [
    {
      id: "book_invisible_cities",
      title: "Invisible Cities",
      author: "Italo Calvino",
      format: "EPUB",
    },
    {
      id: "book_overstory",
      title: "The Overstory",
      author: "Richard Powers",
      format: "EPUB",
    },
    {
      id: "book_untitled_manuscript",
      title: "Untitled Manuscript",
      author: "Imported Epub",
      format: "EPUB",
      isDocument: true,
    },
  ];

  const recentlyAddedBooks: { id: string; title: string; author: string; isDocument?: boolean }[] = [
    {
      id: "book_design_everyday",
      title: "The Design of Eve...",
      author: "Don Norman",
    },
    {
      id: "book_dune",
      title: "Dune",
      author: "Frank Herbert",
    },
    {
      id: "book_thinking_fast",
      title: "Thinking, Fast an...",
      author: "Daniel Kahneman",
    },
    {
      id: "book_q3_research",
      title: "Q3 Research Notes",
      author: "Local Ingestion",
      isDocument: true,
    },
  ];

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
          {todayStr || "THURSDAY, OCTOBER 26"}
        </span>
        <h2 className="font-serif text-xl font-medium text-[#1C1917] leading-relaxed">
          Good evening. You have <span className="font-semibold text-black">3 books in progress</span> and <span className="font-semibold text-black">12 unread</span> in your queue.
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
              <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-gradient-to-b from-[#F2ECE0] to-[#E3DACB]">
                <span className="text-[9px] uppercase tracking-widest text-[#8C8275] mb-1 font-mono">MARCUS AURELIUS</span>
                <span className="font-serif text-sm font-bold text-[#2E2924] leading-tight mb-2">MEDITATIONS</span>
                <div className="w-8 h-[1px] bg-[#8C8275] mb-2" />
                <span className="text-[8px] text-[#78716C] uppercase font-mono">THE INNER HARMONY</span>
              </div>
            </div>

            {/* Book Details */}
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-full text-[#57534E]">
                    Philosophy
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-full text-[#57534E]">
                    Non-Fiction
                  </span>
                </div>

                {/* Title and Author */}
                <h4 className="font-serif text-2xl font-bold text-[#1C1917] group-hover:text-black transition-colors">
                  Meditations
                </h4>
                <p className="text-xs text-[#78716C]">
                  Marcus Aurelius
                </p>
              </div>

              {/* Progress Bar & Chapter */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-[#57534E] font-medium">Chapter 4: On the Inner Life</span>
                  <span className="font-mono font-semibold text-[#1C1917]">62%</span>
                </div>
                <div className="w-full h-[3px] bg-[#E5DFD3] rounded-full overflow-hidden">
                  <div className="h-full bg-[#18181B] transition-all duration-300 w-[62%]" />
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
            {upNextBooks.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectBook({
                    id: item.id,
                    title: item.title,
                    subtitle: null,
                    author_ids: [],
                    series_id: null,
                    series_index: null,
                    description: null,
                    publisher: null,
                    published_date: null,
                    language: "en",
                    isbn: null,
                    cover_image_id: null,
                    cover_image_path: null,
                    primary_file_id: item.id,
                    reading_status: "unread",
                    library_state: "active",
                    trashed_at: null,
                    sync: {
                      version: 1,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      device_id: "dev_01",
                      is_deleted: false,
                    },
                  });
                }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
              >
                <div className="w-8 h-11 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 shadow-2xs">
                  {item.isDocument ? (
                    <FileText className="w-4 h-4 text-[#8C8275]" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                    {item.title}
                  </h5>
                  <p className="text-[10px] text-[#78716C] truncate">
                    {item.author}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recently Added Section (Bottom Shelf) */}
      <div className="space-y-4 pt-2">
        <h3 className="font-serif text-base font-bold text-[#1C1917]">
          Recently Added
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {recentlyAddedBooks.map((b) => (
            <div
              key={b.id}
              onClick={() => {
                onSelectBook({
                  id: b.id,
                  title: b.title,
                  subtitle: null,
                  author_ids: [],
                  series_id: null,
                  series_index: null,
                  description: null,
                  publisher: null,
                  published_date: null,
                  language: "en",
                  isbn: null,
                  cover_image_id: null,
                  cover_image_path: null,
                  primary_file_id: b.id,
                  reading_status: "unread",
                  library_state: "active",
                  trashed_at: null,
                  sync: {
                    version: 1,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    device_id: "dev_01",
                    is_deleted: false,
                  },
                });
              }}
              className="group flex flex-col cursor-pointer transition-transform duration-150 hover:-translate-y-0.5"
            >
              {/* Card Thumbnail */}
              <div className="aspect-[3/4] w-full bg-[#EAE4DA] rounded-lg border border-[#DDD5C7] overflow-hidden shadow-xs flex items-center justify-center p-3 text-center">
                {b.isDocument ? (
                  <div className="flex flex-col items-center gap-1.5 text-[#78716C]">
                    <FileText className="w-6 h-6 text-[#8C8275]" />
                    <span className="text-[10px] font-medium">Document</span>
                  </div>
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
                  {b.author}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
