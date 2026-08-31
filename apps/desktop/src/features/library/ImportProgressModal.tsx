import React from "react";
import { X, Clock, FileText } from "lucide-react";
import { ImportJob } from "@luma/shared-types";
import { Button, Badge } from "@luma/ui";

export interface ImportProgressModalProps {
  job: ImportJob | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  job,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !job) return null;

  const pct =
    job.total_files > 0
      ? Math.round(((job.completed_count + job.failed_count) / job.total_files) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-[#18181B]" />
            <h3 className="font-serif text-sm font-bold text-[#1C1917]">
              {job.status === "processing" ? "Importing Documents..." : "Import Completed"}
            </h3>
          </div>
          {job.status !== "processing" && (
            <button onClick={onClose} className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#78716C]">
              <span>Overall Progress</span>
              <span className="font-mono text-[#1C1917] font-semibold">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-[#E5DFD3] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#18181B] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-[#FFFFFF] p-2.5 rounded-lg border border-[#E5DFD3]">
              <span className="text-[#78716C] block text-[10px]">Imported</span>
              <span className="text-emerald-700 font-bold text-sm">{job.completed_count}</span>
            </div>
            <div className="bg-[#FFFFFF] p-2.5 rounded-lg border border-[#E5DFD3]">
              <span className="text-[#78716C] block text-[10px]">Skipped</span>
              <span className="text-amber-700 font-bold text-sm">{job.skipped_count}</span>
            </div>
            <div className="bg-[#FFFFFF] p-2.5 rounded-lg border border-[#E5DFD3]">
              <span className="text-[#78716C] block text-[10px]">Failed</span>
              <span className="text-rose-700 font-bold text-sm">{job.failed_count}</span>
            </div>
          </div>

          {/* Item Log */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pt-2">
            <span className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider">
              File Ingestion Log
            </span>
            {job.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileText className="w-3.5 h-3.5 text-[#78716C] flex-shrink-0" />
                  <span className="text-[#1C1917] truncate">{item.original_filename}</span>
                </div>
                {item.status === "success" ? (
                  <Badge variant="success">Success</Badge>
                ) : (
                  <Badge variant="error">Failed</Badge>
                )}
              </div>
            ))}
          </div>

          {/* Close button */}
          {job.status !== "processing" && (
            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

