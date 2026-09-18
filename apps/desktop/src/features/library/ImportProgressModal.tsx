import React from "react";
import { ImportJob } from "@luma/shared-types";
import { Loader2, CheckCircle2, AlertCircle, X, FileText } from "lucide-react";

export interface ImportProgressModalProps {
  job: ImportJob | null;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Set when the import could not start at all, so no job exists to report
   * progress with. Without this the only trace of a rejected import was a
   * console line and the user saw nothing happen.
   */
  error?: string | null;
}

export const ImportProgressModal: React.FC<ImportProgressModalProps> = ({
  job,
  isOpen,
  onClose,
  error = null,
}) => {
  const hasError = Boolean(error);
  if (!isOpen || (!job && !hasError)) return null;

  const progressPercent =
    job && job.total_files > 0
      ? Math.round(
          ((job.completed_count + job.failed_count + job.skipped_count) / job.total_files) * 100
        )
      : 0;

  const isFinished = Boolean(
    job &&
      (job.status === "completed" ||
        job.status === "failed" ||
        job.status === "cancelled" ||
        (job.status as string) === "success")
  );

  const isSuccess = Boolean(
    job && (job.status === "completed" || (job.status as string) === "success")
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
    >
      <div className="w-full max-w-md bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-[#1C1917]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5DFD3] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {hasError ? (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : !isFinished ? (
              <Loader2 className="w-4 h-4 text-[#18181B] animate-spin" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <h3 id="import-modal-title" className="font-serif text-sm font-bold text-[#1C1917]">
              {hasError ? "Import Failed" : isFinished ? "Import Finished" : "Importing Books..."}
            </h3>
          </div>

          {(isFinished || hasError) && (
            <button
              onClick={onClose}
              className="p-1 text-[#78716C] hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1] transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {hasError && (
            <p role="alert" className="text-xs text-[#1C1917] leading-relaxed">
              {error}
            </p>
          )}

          {job && (
            <>
              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-[#78716C]">
                  <span>
                    {job.completed_count} of {job.total_files} processed
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-[#E5DFD3] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#18181B] transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Item List */}
              <div className="max-h-48 overflow-y-auto divide-y divide-[#EFEAE1] border border-[#E5DFD3] rounded-xl bg-white p-2">
                {job.items.map((item, idx) => (
                  <div key={idx} className="py-2 px-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="w-3.5 h-3.5 text-[#78716C] flex-shrink-0" />
                      <span className="truncate text-[#1C1917] font-medium">
                        {item.original_filename}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                        item.status === "completed" || item.status === "success"
                          ? "text-emerald-700 bg-emerald-50"
                          : item.status === "failed"
                          ? "text-rose-700 bg-rose-50"
                          : "text-amber-700 bg-amber-50"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {(isFinished || hasError) && (
          <div className="px-6 py-3 bg-[#F5EFE6] border-t border-[#E5DFD3] flex justify-end">
            <button
              onClick={onClose}
              className="py-1.5 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
