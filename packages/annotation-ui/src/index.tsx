import React from "react";
import { Annotation } from "@luma/shared-types";
import { Trash2, MessageSquare, CornerDownRight } from "lucide-react";

export interface AnnotationItemProps {
  annotation: Annotation;
  onJumpTo: (annotation: Annotation) => void;
  onDelete?: (annotationId: string) => void;
}

export const AnnotationItem: React.FC<AnnotationItemProps> = ({
  annotation,
  onJumpTo,
  onDelete,
}) => {
  return (
    <div className="group p-3 bg-slate-900/60 hover:bg-slate-850 border border-slate-800 rounded-xl transition-all space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-800"
            style={{ backgroundColor: annotation.color_hex }}
          />
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            {annotation.annotation_type}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onJumpTo(annotation)}
            className="p-1 text-slate-400 hover:text-sky-400 rounded hover:bg-slate-800"
            title="Jump to location"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(annotation.id)}
              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
              title="Delete annotation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <blockquote
        onClick={() => onJumpTo(annotation)}
        className="text-xs text-slate-200 italic border-l-2 border-slate-700 hover:border-sky-500 pl-2.5 my-1 line-clamp-3 cursor-pointer transition-colors"
      >
        "{annotation.quote}"
      </blockquote>

      {annotation.note && (
        <div className="flex items-start gap-1.5 text-xs text-slate-400 font-sans bg-slate-950/80 p-2 rounded-lg border border-slate-850">
          <MessageSquare className="w-3.5 h-3.5 text-sky-400 mt-0.5 flex-shrink-0" />
          <p className="line-clamp-3">{annotation.note}</p>
        </div>
      )}
    </div>
  );
};
