import React from "react";
import { useReaderStore } from "../state/readerState";
import { LibraryView } from "../features/library/LibraryView";
import { ReaderView } from "../features/reader/ReaderView";

export const App: React.FC = () => {
  const currentBook = useReaderStore((s) => s.currentBook);

  return (
    <main className="h-screen w-screen flex flex-col bg-[#FAF7F2] text-[#1C1917] antialiased overflow-hidden">
      {currentBook ? <ReaderView book={currentBook} /> : <LibraryView />}
    </main>
  );
};
