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
    <div className="group p-2.5 bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-lg transition-all space-y-1.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full border border-[#D6CEC2]"
            style={{ backgroundColor: annotation.color_hex }}
          />
          <span className="text-[9px] uppercase font-bold text-[#78716C] tracking-wider">
            {annotation.annotation_type}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onJumpTo(annotation)}
            className="p-1 text-[#78716C] hover:text-[#18181B] rounded hover:bg-[#EFEAE1]"
            title="Jump to location"
          >
            <CornerDownRight className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(annotation.id)}
              className="p-1 text-[#78716C] hover:text-rose-600 rounded hover:bg-[#EFEAE1]"
              title="Delete annotation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <blockquote
        onClick={() => onJumpTo(annotation)}
        className="text-xs text-[#292524] italic border-l-2 border-[#D6CEC2] hover:border-[#18181B] pl-2 my-1 line-clamp-3 cursor-pointer transition-colors font-serif"
      >
        "{annotation.quote}"
      </blockquote>

      {annotation.note && (
        <div className="flex items-start gap-1.5 text-xs text-[#57534E] font-sans bg-[#F7F3EB] p-2 rounded-md border border-[#E5DFD3]">
          <MessageSquare className="w-3.5 h-3.5 text-[#18181B] mt-0.5 flex-shrink-0" />
          <p className="line-clamp-3 text-[11px]">{annotation.note}</p>
        </div>
      )}
    </div>
  );
};

