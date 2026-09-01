import React, { useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, AlertTriangle, BookOpen, FileCheck2 } from "lucide-react";
import { Book } from "@luma/shared-types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface DuplicateReviewModalLabels {
  title?: string;
  alertTitle?: string;
  alertMessage?: string;
  existingSectionLabel?: string;
  importingSectionLabel?: string;
  statusLabel?: string;
  publishedLabel?: string;
  formatLabel?: string;
  sizeLabel?: string;
  inLibraryStatus?: string;
  newStagedFileLabel?: string;
  cancelLabel?: string;
  useExistingLabel?: string;
  addAsNewFormatLabel?: string;
  existingBookFallbackTitle?: string;
  authorFallbackLabel?: string;
}

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
  labels?: DuplicateReviewModalLabels;
  /** Whether an async operation is in progress (disables buttons) */
  loading?: boolean;
  /** If true, buttons are disabled (e.g., during processing) */
  disabled?: boolean;
  className?: string;
  overlayClassName?: string;
  /** Custom render function for footer actions (overrides default buttons) */
  renderActions?: (props: {
    onCancel: () => void;
    onUseExisting: () => void;
    onAddAsNewFormat: () => void;
    loading: boolean;
    disabled: boolean;
  }) => React.ReactNode;
  /** Custom content injected between the alert and the comparison cards */
  children?: React.ReactNode;
  /** Allow clicking on the backdrop to close */
  closeOnOverlayClick?: boolean;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<DuplicateReviewModalLabels> = {
  title: "Importing Library",
  alertTitle: "Duplicate Detected",
  alertMessage:
    "A document with a matching title, hash, or publication identifier already exists in your library.",
  existingSectionLabel: "EXISTING FILE",
  importingSectionLabel: "IMPORTING FILE",
  statusLabel: "Status:",
  publishedLabel: "Published:",
  formatLabel: "Format:",
  sizeLabel: "Size:",
  inLibraryStatus: "In Library",
  newStagedFileLabel: "New Staged File",
  cancelLabel: "Cancel",
  useExistingLabel: "Use Existing",
  addAsNewFormatLabel: "Add as New Format",
  existingBookFallbackTitle: "Existing Publication",
  authorFallbackLabel: "Library Record",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const DuplicateReviewModal: React.FC<DuplicateReviewModalProps> = ({
  isOpen,
  onClose,
  onUseExisting,
  onAddAsNewFormat,
  existingBook,
  importingFile,
  labels: customLabels = {},
  loading = false,
  disabled = false,
  className = "",
  overlayClassName = "",
  renderActions,
  children,
  closeOnOverlayClick = false,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the close button when modal opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleUseExisting = useCallback(() => {
    onUseExisting?.();
  }, [onUseExisting]);

  const handleAddAsNewFormat = useCallback(() => {
    onAddAsNewFormat?.();
  }, [onAddAsNewFormat]);

  if (!isOpen) return null;

  const title = existingBook?.title || labels.existingBookFallbackTitle;
  const author = (() => {
    const anyBook = existingBook as any;
    if (Array.isArray(anyBook?.authors)) {
      return anyBook.authors.map((a: any) => a.name).join(', ') || labels.authorFallbackLabel;
    }
    // Fallback to other possible single-author fields
    if (typeof anyBook?.author === 'string' && anyBook.author.trim()) {
      return anyBook.author;
    }
    return labels.authorFallbackLabel;
  })();

  const isDisabled = loading || disabled;

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 ${overlayClassName}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-review-title"
      aria-describedby="duplicate-review-desc"
    >
      <div
        className={`bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-[#1C1917] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <h3 id="duplicate-review-title" className="font-serif text-base font-bold text-[#1C1917]">
            {labels.title}
          </h3>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]"
            aria-label="Close modal"
            disabled={isDisabled}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Duplicate Alert Box */}
          <div className="bg-[#FBF6EE] border border-[#E8DFC8] rounded-xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>{labels.alertTitle}</span>
            </div>
            <p id="duplicate-review-desc" className="text-xs text-[#6B6358] leading-relaxed pl-6">
              {labels.alertMessage}
            </p>
          </div>

          {/* Side-by-Side Comparison */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            {/* Existing File */}
            <div className="bg-white border border-[#E5DFD3] rounded-xl p-3.5 space-y-3 shadow-2xs">
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">
                {labels.existingSectionLabel}
              </span>
              <div className="flex items-start gap-3">
                <div className="w-10 h-14 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                  {existingBook?.cover_image_path ? (
                    <img
                      src={existingBook.cover_image_path}
                      alt={title}
                      className="w-full h-full object-cover"
                    />
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
                  <span>{labels.statusLabel}</span>
                  <span className="font-mono font-semibold text-[#1C1917]">{labels.inLibraryStatus}</span>
                </div>
                {existingBook?.published_date && (
                  <div className="flex justify-between text-[#78716C]">
                    <span>{labels.publishedLabel}</span>
                    <span className="text-[#57534E]">{existingBook.published_date}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Importing File */}
            <div className="bg-white border border-[#E5DFD3] rounded-xl p-3.5 space-y-3 shadow-2xs relative">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 absolute top-3 right-3" />
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                {labels.importingSectionLabel}
              </span>
              <div className="flex items-start gap-3">
                <div className="w-10 h-14 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0 overflow-hidden shadow-xs">
                  <FileCheck2 className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="font-serif font-bold text-[#1C1917] truncate">
                    {importingFile?.filename || title}
                  </h4>
                  <p className="text-[11px] text-[#78716C] truncate">{labels.newStagedFileLabel}</p>
                </div>
              </div>
              <div className="space-y-1 pt-1 border-t border-[#F2ECE2] text-[11px]">
                <div className="flex justify-between text-[#78716C]">
                  <span>{labels.formatLabel}</span>
                  <span className="font-mono font-semibold text-[#1C1917]">
                    {importingFile?.format?.toUpperCase() || "DIGITAL"}
                  </span>
                </div>
                {importingFile?.size && (
                  <div className="flex justify-between text-[#78716C]">
                    <span>{labels.sizeLabel}</span>
                    <span className="font-mono text-[#57534E]">{importingFile.size}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Custom content injection */}
          {children}

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5DFD3]">
            {renderActions ? (
              renderActions({
                onCancel: onClose,
                onUseExisting: handleUseExisting,
                onAddAsNewFormat: handleAddAsNewFormat,
                loading,
                disabled: isDisabled,
              })
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#18181B] font-medium transition-colors disabled:opacity-50"
                  disabled={isDisabled}
                >
                  {labels.cancelLabel}
                </button>
                <button
                  onClick={handleUseExisting}
                  className="px-3.5 py-1.5 bg-white border border-[#DDD5C7] hover:bg-[#F7F3EB] text-xs font-semibold text-[#1C1917] rounded-lg transition-colors shadow-2xs disabled:opacity-50"
                  disabled={isDisabled}
                >
                  {labels.useExistingLabel}
                </button>
                <button
                  onClick={handleAddAsNewFormat}
                  className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-xs font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  disabled={isDisabled}
                >
                  {labels.addAsNewFormatLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};