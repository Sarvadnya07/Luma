import React, { useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { useReaderStore } from "../../state/readerState";
import { TextSelectionToolbar } from "./TextSelectionToolbar";

export const PdfReaderView: React.FC = () => {
  const currentPdfPage = useReaderStore((s) => s.currentPdfPage);
  const documentData = useReaderStore((s) => s.documentData);
  const loadPdfPage = useReaderStore((s) => s.loadPdfPage);
  const createHighlight = useReaderStore((s) => s.createHighlight);
  const toggleBookmark = useReaderStore((s) => s.toggleBookmark);

  const [zoom, setZoom] = useState<number>(100);
  const [selectionPos, setSelectionPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");

  const totalPages = documentData?.total_pages_or_spines || 1;

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setSelectionPos(null);
      setSelectedText("");
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setSelectionPos(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setSelectionPos({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  };

  return (
    <div
      className="relative w-full h-full flex flex-col bg-[#FAF7F2] select-text overflow-hidden text-[#1C1917]"
      onMouseUp={handleMouseUp}
    >
      <TextSelectionToolbar
        position={selectionPos}
        selectedText={selectedText}
        onHighlight={(colorHex, note) => {
          createHighlight(colorHex, selectedText, undefined, undefined, note);
          window.getSelection()?.removeAllRanges();
          setSelectionPos(null);
        }}
        onBookmark={toggleBookmark}
        onClose={() => setSelectionPos(null)}
      />

      {/* PDF Zoom & Page Floating Toolbar */}
      <div className="absolute top-4 right-6 z-20 flex items-center gap-1.5 bg-[#FAF7F2]/90 backdrop-blur-md border border-[#E5DFD3] rounded-full px-3 py-1.5 shadow-md text-xs text-[#78716C]">
        <button
          onClick={() => setZoom((z) => Math.max(50, z - 15))}
          className="p-1 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] px-1 text-[#1C1917]">{zoom}%</span>
        <button
          onClick={() => setZoom((z) => Math.min(200, z + 15))}
          className="p-1 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <div className="w-[1px] h-3.5 bg-[#E5DFD3] mx-1" />
        <button
          onClick={() => setZoom(100)}
          className="p-1 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]"
          title="Reset Zoom"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Document Viewport */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-8">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
          className="w-[595px] min-h-[842px] bg-white text-[#1C1917] shadow-xl rounded-sm p-12 flex flex-col justify-between transition-transform duration-100 border border-[#E5DFD3]"
        >
          <div>
            <div className="flex justify-between border-b border-[#E5DFD3] pb-2 text-[10px] text-[#78716C] font-mono mb-8">
              <span>{documentData?.metadata.title}</span>
              <span>Page {currentPdfPage} of {totalPages}</span>
            </div>
            <h2 className="text-xl font-bold mb-4 font-serif text-[#1C1917]">
              Section {currentPdfPage}: Cognitive Affordances & Design
            </h2>
            <p className="text-sm leading-relaxed mb-4 text-[#443F39]">
              This document section is rendered through Luma's high-precision PDF document engine.
              All text layer bounding geometries are normalized to the page viewport $[0.0, 1.0]$.
            </p>
            <p className="text-sm leading-relaxed mb-4 text-[#443F39]">
              Annotation anchors in PDF mode preserve both structural page references and raw character
              bounding rects to ensure highlights remain accurately positioned across different screens.
            </p>
          </div>

          <div className="text-center text-[10px] text-[#78716C] font-mono border-t border-[#E5DFD3] pt-3">
            Page {currentPdfPage}
          </div>
        </div>
      </div>

      {/* Bottom Page Navigation Bar */}
      <footer className="w-full border-t border-[#E5DFD3] bg-[#FAF7F2] px-8 py-2.5 flex items-center justify-between z-20">
        <button
          disabled={currentPdfPage <= 1}
          onClick={() => loadPdfPage(currentPdfPage - 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous Page
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-[#78716C]">
          <span>Page</span>
          <span className="text-[#1C1917] font-bold">{currentPdfPage}</span>
          <span>of {totalPages}</span>
        </div>

        <button
          disabled={currentPdfPage >= totalPages}
          onClick={() => loadPdfPage(currentPdfPage + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          Next Page
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};

