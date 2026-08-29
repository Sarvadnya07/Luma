import React, { useEffect, useState } from "react";
import { Book } from "@luma/shared-types";
import { BookCard } from "@luma/library-ui";
import { Button } from "@luma/ui";
import { LumaApi } from "../../lib/tauri";
import { useReaderStore } from "../../state/readerState";
import { BookOpen, FolderOpen, RefreshCw } from "lucide-react";

export const LibraryView: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const setCurrentBook = useReaderStore((s) => s.setCurrentBook);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const data = await LumaApi.listBooks();
      setBooks(data);
    } catch (err) {
      console.error("Failed to load books:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-sky-400" />
            Luma Library
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Local-first, distraction-free reading with robust annotation integrity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={loadBooks} size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="primary" size="sm">
            <FolderOpen className="w-4 h-4 mr-2" />
            Import Book
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          Loading library...
        </div>
      ) : books.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-800 rounded-2xl p-12">
          <BookOpen className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300">No books found in library</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4 text-center max-w-md">
            Import an EPUB or PDF document to begin reading with resilient annotation anchoring.
          </p>
          <Button variant="primary" size="md">
            <FolderOpen className="w-4 h-4 mr-2" />
            Select EPUB or PDF
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onSelect={() => setCurrentBook(book)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
