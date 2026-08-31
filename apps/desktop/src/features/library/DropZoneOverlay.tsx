import React from "react";
import { UploadCloud } from "lucide-react";

export interface DropZoneOverlayProps {
  isDragging: boolean;
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F2]/90 backdrop-blur-sm border-4 border-dashed border-[#18181B] flex flex-col items-center justify-center p-8 pointer-events-none animate-in fade-in duration-150">
      <div className="p-6 rounded-full bg-[#E5DFD3] mb-4 animate-bounce">
        <UploadCloud className="w-12 h-12 text-[#18181B]" />
      </div>
      <h2 className="font-serif text-2xl font-bold text-[#1C1917] tracking-tight">Drop files to import into Luma</h2>
      <p className="text-xs text-[#78716C] mt-2 max-w-md text-center font-medium">
        Supports EPUB, PDF, CBZ, Markdown, and Plaintext publications.
      </p>
    </div>
  );
};

