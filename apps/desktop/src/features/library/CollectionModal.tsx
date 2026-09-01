import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, FolderPlus, AlertCircle } from "lucide-react";
import { Button } from "@luma/ui";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface CollectionModalLabels {
  title?: string;
  nameLabel?: string;
  descriptionLabel?: string;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  cancelLabel?: string;
  createLabel?: string;
  creatingLabel?: string;
  requiredHint?: string;
  errorMessage?: string;
}

export interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
  labels?: CollectionModalLabels;
  className?: string;
  overlayClassName?: string;
  /** Custom render function for footer actions (overrides default buttons) */
  renderActions?: (props: {
    onCancel: () => void;
    onSubmit: (e?: React.FormEvent) => Promise<void>;
    loading: boolean;
    isValid: boolean;
  }) => React.ReactNode;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<CollectionModalLabels> = {
  title: "Create New Collection",
  nameLabel: "Collection Name",
  descriptionLabel: "Description (Optional)",
  namePlaceholder: "e.g. Modernist Classics",
  descriptionPlaceholder: "Brief description of this collection...",
  cancelLabel: "Cancel",
  createLabel: "Create Collection",
  creatingLabel: "Creating...",
  requiredHint: "*",
  errorMessage: "Failed to create collection. Please try again.",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  labels: customLabels = {},
  className = "",
  overlayClassName = "",
  renderActions,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
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

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmedName = name.trim();
      if (!trimmedName) return;
      setError(null);
      setLoading(true);
      try {
        await onCreate(trimmedName, description.trim() || undefined);
        setName("");
        setDescription("");
        onClose();
      } catch (err) {
        console.error("Failed to create collection:", err);
        setError(labels.errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [name, description, onCreate, onClose, labels.errorMessage]
  );

  const handleCancel = useCallback(() => {
    if (!loading) {
      setName("");
      setDescription("");
      setError(null);
      onClose();
    }
  }, [loading, onClose]);

  const isValid = name.trim().length > 0;

  if (!isOpen) return null;

  // Portal overlay
  const modalContent = (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 ${overlayClassName}`}
    >
      <div
        className={`bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-modal-title"
        aria-describedby="collection-modal-desc"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#18181B]" />
            <h3 id="collection-modal-title" className="font-serif text-sm font-bold text-[#1C1917]">
              {labels.title}
            </h3>
          </div>
          <button
            onClick={handleCancel}
            className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]"
            aria-label="Close modal"
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Field */}
          <div>
            <label htmlFor="collection-name" className="block text-xs font-semibold text-[#78716C] mb-1">
              {labels.nameLabel} {labels.requiredHint && <span className="text-rose-500">{labels.requiredHint}</span>}
            </label>
            <input
              ref={nameInputRef}
              id="collection-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={labels.namePlaceholder}
              disabled={loading}
              className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
            />
          </div>

          {/* Description Field */}
          <div>
            <label htmlFor="collection-desc" className="block text-xs font-semibold text-[#78716C] mb-1">
              {labels.descriptionLabel}
            </label>
            <textarea
              id="collection-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={labels.descriptionPlaceholder}
              disabled={loading}
              className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end gap-2">
            {renderActions ? (
              renderActions({
                onCancel: handleCancel,
                onSubmit: handleSubmit,
                loading,
                isValid,
              })
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  {labels.cancelLabel}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={loading || !isValid}
                >
                  {loading ? labels.creatingLabel : labels.createLabel}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};