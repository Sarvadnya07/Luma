import React from "react";
import { UploadCloud } from "lucide-react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface DropZoneOverlayLabels {
  title?: string;
  subtitle?: string;
  iconLabel?: string;
}

export interface DropZoneOverlayProps {
  isDragging: boolean;
  labels?: DropZoneOverlayLabels;
  className?: string;
  iconClassName?: string;
  /** Custom icon component (defaults to UploadCloud) */
  icon?: React.ReactNode;
  /** Custom content (overrides default title/subtitle) */
  children?: React.ReactNode;
  /** Callback when overlay is clicked (only if pointer-events are enabled) */
  onOverlayClick?: () => void;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<DropZoneOverlayLabels> = {
  title: "Drop files to import into Luma",
  subtitle: "Supports EPUB, PDF, CBZ, Markdown, and Plaintext publications.",
  iconLabel: "Upload icon",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const DropZoneOverlay: React.FC<DropZoneOverlayProps> = ({
  isDragging,
  labels: customLabels = {},
  className = "",
  iconClassName = "",
  icon = <UploadCloud className="w-12 h-12 text-[#18181B]" />,
  children,
  onOverlayClick,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  if (!isDragging) return null;

  const handleOverlayClick = () => {
    onOverlayClick?.();
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#FAF7F2]/90 backdrop-blur-sm border-4 border-dashed border-[#18181B] flex flex-col items-center justify-center p-8 animate-in fade-in duration-150 ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label="Drop zone overlay"
      onClick={handleOverlayClick}
    >
      {children ?? (
        <>
          <div
            className={`p-6 rounded-full bg-[#E5DFD3] mb-4 animate-bounce ${iconClassName}`}
            aria-hidden="true"
          >
            {icon}
          </div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1917] tracking-tight text-center">
            {labels.title}
          </h2>
          <p className="text-xs text-[#78716C] mt-2 max-w-md text-center font-medium">
            {labels.subtitle}
          </p>
        </>
      )}
    </div>
  );
};