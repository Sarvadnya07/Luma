import React from "react";
import { Annotation } from "@luma/shared-types";

export interface AnnotationItemProps {
  annotation: Annotation;
  onJumpTo: (annotation: Annotation) => void;
  onDelete?: (annotationId: string) => void;
}

export const AnnotationItem: React.FC<AnnotationItemProps> = ({
  annotation,
  onJumpTo,
}) => {
  return (
    <div
      onClick={() => onJumpTo(annotation)}
      className="p-3 bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/80 rounded-lg cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: annotation.color_hex }}
        />
        <span className="text-xs uppercase font-semibold text-slate-400">
          {annotation.annotation_type}
        </span>
        <span className="text-[10px] text-slate-500 ml-auto">
          {new Date(annotation.sync.created_at).toLocaleDateString()}
        </span>
      </div>
      <blockquote className="text-xs text-slate-200 italic border-l-2 border-slate-700 pl-2.5 my-1 line-clamp-3">
        "{annotation.quote}"
      </blockquote>
      {annotation.note && (
        <p className="text-xs text-slate-400 mt-2 font-sans bg-slate-950/40 p-2 rounded">
          {annotation.note}
        </p>
      )}
    </div>
  );
};
