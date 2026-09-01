import React from "react";
import { Annotation } from "@luma/shared-types";
import { AnnotationItem } from "@luma/annotation-ui";
import { BookmarkCheck } from "lucide-react";

export interface AnnotationListProps {
  annotations: Annotation[];
  onJumpTo: (annotation: Annotation) => void;
  /** Optional title for the header */
  title?: string;
  /** Optional empty state message */
  emptyMessage?: string;
  /** Additional CSS classes for the container */
  className?: string;
  /** Whether data is loading (shows a spinner or skeleton) */
  isLoading?: boolean;
}

export const AnnotationList: React.FC<AnnotationListProps> = ({
  annotations,
  onJumpTo,
  title = "Annotations",
  emptyMessage = "No highlights or notes recorded in this document yet. Select text to create an anchor.",
  className = "",
  isLoading = false,
}) => {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
          <BookmarkCheck className="w-4 h-4 text-sky-400" />
          {title} ({annotations.length})
        </h2>
      </div>
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8 text-xs text-slate-500" aria-live="polite">
            Loading annotations…
          </div>
        ) : annotations.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500" aria-live="polite">
            {emptyMessage}
          </div>
        ) : (
          annotations.map((ann) => (
            <AnnotationItem
              key={ann.id}
              annotation={ann}
              onJumpTo={onJumpTo}
            />
          ))
        )}
      </div>
    </div>
  );
};