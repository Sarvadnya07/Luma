import React from "react";
import { UploadCloud } from "lucide-react";

export interface DropZoneOverlayProps {
  isDragging: boolean;
}

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-sky-950/80 backdrop-blur-md border-4 border-dashed border-sky-400/80 flex flex-col items-center justify-center p-8 pointer-events-none animate-in fade-in duration-150">
      <div className="p-6 rounded-full bg-sky-500/20 mb-4 animate-bounce">
        <UploadCloud className="w-16 h-16 text-sky-400" />
      </div>
      <h2 className="text-2xl font-bold text-sky-100 tracking-tight">Drop files to import into Luma</h2>
      <p className="text-sm text-sky-300/80 mt-2 max-w-md text-center">
        Supports EPUB, PDF, CBZ Comics, Markdown, and Plaintext documents.
      </p>
    </div>
  );
};
