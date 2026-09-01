import React from "react";
import { X, AlertTriangle, BookOpen, FileCheck2 } from "lucide-react";
import { Book } from "@luma/shared-types";

export interface DuplicateReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUseExisting?: () => void;
  onAddAsNewFormat?: () => void;
  existingBook?: Book | null;
  importingFile?: {
    filename: string;
    format: string;
    size: string;
    quality?: string;
  } | null;
}

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({
  isOpen,
  onClose,
  onUseExisting,
  onAddAsNewFormat,
  existingBook,
  importingFile,
}) => {
  if (!isOpen) return null;

  const title = existingBook?.title || "Existing Publication";
  const author = "Library Record";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-[#1C1917]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <h3 className="font-serif text-base font-bold text-[#1C1917]">Importing Library</h3>
          <button
            onClick={onClose}
            className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Duplicate Alert Box */}
          <div className="bg-[#FBF6EE] border border-[#E8DFC8] rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>Duplicate Detected</span>
            </div>
            <p className="text-xs text-[#6B6358] leading-relaxed pl-6">
              A document with a matching title, hash, or publication identifier already exists in your library.
            </p>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Existing File */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-3.5 space-y-3 shadow-2xs">
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">
                EXISTING FILE
              </span>
              <div className="flex items-start gap-3">
                <div className="w-10 h-14 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                  {existingBook?.cover_image_path ? (
                    <img src={existingBook.cover_image_path} alt={title} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen className="w-5 h-5 text-[#8C8275]" />
                  )}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-serif font-bold text-[#1C1917] truncate">{title}</h4>
                  <p className="text-[11px] text-[#78716C] truncate">{author}</p>
                </div>
              </div>
              <div className="space-y-1 pt-1 border-t border-[#F2ECE2] text-[11px]">
                <div className="flex justify-between text-[#78716C]">
                  <span>Status:</span>
                  <span className="font-mono font-semibold text-[#1C1917]">In Library</span>
                </div>
                {existingBook?.published_date && (
                  <div className="flex justify-between text-[#78716C]">
                    <span>Published:</span>
                    <span className="text-[#57534E]">{existingBook.published_date}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Importing File */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-3.5 space-y-3 shadow-2xs relative">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 absolute top-3 right-3" />
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                IMPORTING FILE
              </span>
              <div className="flex items-start gap-3">
                <div className="w-10 h-14 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                  <FileCheck2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-serif font-bold text-[#1C1917] truncate">
                    {importingFile?.filename || title}
                  </h4>
                  <p className="text-[11px] text-[#78716C] truncate">New Staged File</p>
                </div>
              </div>
              <div className="space-y-1 pt-1 border-t border-[#F2ECE2] text-[11px]">
                <div className="flex justify-between text-[#78716C]">
                  <span>Format:</span>
                  <span className="font-mono font-semibold text-[#1C1917]">
                    {importingFile?.format?.toUpperCase() || "DIGITAL"}
                  </span>
                </div>
                {importingFile?.size && (
                  <div className="flex justify-between text-[#78716C]">
                    <span>Size:</span>
                    <span className="font-mono text-[#57534E]">{importingFile.size}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5DFD3]">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#18181B] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onUseExisting?.();
                onClose();
              }}
              className="px-3.5 py-1.5 bg-[#FFFFFF] border border-[#DDD5C7] hover:bg-[#F7F3EB] text-xs font-semibold text-[#1C1917] rounded-lg transition-colors shadow-2xs"
            >
              Use Existing
            </button>
            <button
              onClick={() => {
                onAddAsNewFormat?.();
                onClose();
              }}
              className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-xs font-semibold text-white rounded-lg transition-colors shadow-sm"
            >
              Add as New Format
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
