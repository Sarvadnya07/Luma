import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Save, AlertCircle } from "lucide-react";
import { Book } from "@luma/shared-types";
import { Button } from "@luma/ui";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface MetadataEditModalLabels {
  title?: string;
  titleLabel?: string;
  titlePlaceholder?: string;
  subtitleLabel?: string;
  subtitlePlaceholder?: string;
  publisherLabel?: string;
  publisherPlaceholder?: string;
  publishedDateLabel?: string;
  publishedDatePlaceholder?: string;
  languageLabel?: string;
  languagePlaceholder?: string;
  isbnLabel?: string;
  isbnPlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  cancelLabel?: string;
  saveLabel?: string;
  savingLabel?: string;
  requiredHint?: string;
  errorMessage?: string;
}

export interface MetadataEditModalProps {
  book: Book;
  isOpen: boolean;
  onClose: () => void;
  onSave: (metadata: {
    title: string;
    subtitle?: string | null;
    description?: string | null;
    publisher?: string | null;
    published_date?: string | null;
    language?: string | null;
    isbn?: string | null;
  }) => Promise<void>;
  labels?: MetadataEditModalLabels;
  loading?: boolean; // external loading state
  disabled?: boolean;
  className?: string;
  overlayClassName?: string;
  /** Show/hide specific fields (default: all shown) */
  fields?: {
    title?: boolean;
    subtitle?: boolean;
    publisher?: boolean;
    publishedDate?: boolean;
    language?: boolean;
    isbn?: boolean;
    description?: boolean;
  };
  /** Custom render function for footer actions */
  renderActions?: (props: {
    onCancel: () => void;
    onSubmit: () => void;
    loading: boolean;
    disabled: boolean;
    isValid: boolean;
  }) => React.ReactNode;
  /** Extra content inserted before the footer */
  children?: React.ReactNode;
  /** Close modal when clicking backdrop */
  closeOnOverlayClick?: boolean;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<MetadataEditModalLabels> = {
  title: "Edit Publication Metadata",
  titleLabel: "Title",
  titlePlaceholder: "Enter title…",
  subtitleLabel: "Subtitle",
  subtitlePlaceholder: "Enter subtitle…",
  publisherLabel: "Publisher",
  publisherPlaceholder: "Enter publisher…",
  publishedDateLabel: "Publication Date",
  publishedDatePlaceholder: "YYYY-MM-DD",
  languageLabel: "Language",
  languagePlaceholder: "en",
  isbnLabel: "ISBN / Identifier",
  isbnPlaceholder: "Enter ISBN…",
  descriptionLabel: "Synopsis / Description",
  descriptionPlaceholder: "Enter description…",
  cancelLabel: "Cancel",
  saveLabel: "Save Changes",
  savingLabel: "Saving…",
  requiredHint: "*",
  errorMessage: "Failed to save metadata. Please try again.",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const MetadataEditModal: React.FC<MetadataEditModalProps> = ({
  book,
  isOpen,
  onClose,
  onSave,
  labels: customLabels = {},
  loading: externalLoading = false,
  disabled = false,
  className = "",
  overlayClassName = "",
  fields = {
    title: true,
    subtitle: true,
    publisher: true,
    publishedDate: true,
    language: true,
    isbn: true,
    description: true,
  },
  renderActions,
  children,
  closeOnOverlayClick = false,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  // Local state
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle || "");
  const [description, setDescription] = useState(book.description || "");
  const [publisher, setPublisher] = useState(book.publisher || "");
  const [publishedDate, setPublishedDate] = useState(book.published_date || "");
  const [language, setLanguage] = useState(book.language || "");
  const [isbn, setIsbn] = useState(book.isbn || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto‑focus on mount
  useEffect(() => {
    if (isOpen && titleInputRef.current) {
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset form when book changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle(book.title);
      setSubtitle(book.subtitle || "");
      setDescription(book.description || "");
      setPublisher(book.publisher || "");
      setPublishedDate(book.published_date || "");
      setLanguage(book.language || "");
      setIsbn(book.isbn || "");
      setError(null);
    }
  }, [isOpen, book]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !saving) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, saving, onClose]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return; // basic validation

      setError(null);
      setSaving(true);
      try {
        await onSave({
          title: trimmedTitle,
          subtitle: subtitle.trim() || null,
          description: description.trim() || null,
          publisher: publisher.trim() || null,
          published_date: publishedDate.trim() || null,
          language: language.trim() || null,
          isbn: isbn.trim() || null,
        });
        onClose();
      } catch (err) {
        console.error("Failed to save metadata:", err);
        setError(labels.errorMessage);
      } finally {
        setSaving(false);
      }
    },
    [title, subtitle, description, publisher, publishedDate, language, isbn, onSave, onClose, labels.errorMessage]
  );

  const handleCancel = useCallback(() => {
    if (!saving) onClose();
  }, [saving, onClose]);

  const isDisabled = disabled || externalLoading || saving;
  const isValid = title.trim().length > 0;

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 ${overlayClassName}`}
      onClick={closeOnOverlayClick ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="metadata-edit-title"
      aria-describedby={error ? "metadata-edit-error" : undefined}
    >
      <div
        className={`bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <h3 id="metadata-edit-title" className="font-serif text-sm font-bold text-[#1C1917]">
            {labels.title}
          </h3>
          <button
            onClick={handleCancel}
            className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]"
            aria-label="Close modal"
            disabled={isDisabled}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {fields.title !== false && (
            <div>
              <label htmlFor="meta-title" className="block text-xs font-semibold text-[#78716C] mb-1">
                {labels.titleLabel} <span className="text-rose-500">{labels.requiredHint}</span>
              </label>
              <input
                ref={titleInputRef}
                id="meta-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={labels.titlePlaceholder}
                disabled={isDisabled}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
              />
            </div>
          )}

          {fields.subtitle !== false && (
            <div>
              <label htmlFor="meta-subtitle" className="block text-xs font-semibold text-[#78716C] mb-1">
                {labels.subtitleLabel}
              </label>
              <input
                id="meta-subtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={labels.subtitlePlaceholder}
                disabled={isDisabled}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {fields.publisher !== false && (
              <div>
                <label htmlFor="meta-publisher" className="block text-xs font-semibold text-[#78716C] mb-1">
                  {labels.publisherLabel}
                </label>
                <input
                  id="meta-publisher"
                  type="text"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder={labels.publisherPlaceholder}
                  disabled={isDisabled}
                  className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
                />
              </div>
            )}
            {fields.publishedDate !== false && (
              <div>
                <label htmlFor="meta-pubdate" className="block text-xs font-semibold text-[#78716C] mb-1">
                  {labels.publishedDateLabel}
                </label>
                <input
                  id="meta-pubdate"
                  type="text"
                  value={publishedDate}
                  onChange={(e) => setPublishedDate(e.target.value)}
                  placeholder={labels.publishedDatePlaceholder}
                  disabled={isDisabled}
                  className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {fields.language !== false && (
              <div>
                <label htmlFor="meta-language" className="block text-xs font-semibold text-[#78716C] mb-1">
                  {labels.languageLabel}
                </label>
                <input
                  id="meta-language"
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder={labels.languagePlaceholder}
                  disabled={isDisabled}
                  className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
                />
              </div>
            )}
            {fields.isbn !== false && (
              <div>
                <label htmlFor="meta-isbn" className="block text-xs font-semibold text-[#78716C] mb-1">
                  {labels.isbnLabel}
                </label>
                <input
                  id="meta-isbn"
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder={labels.isbnPlaceholder}
                  disabled={isDisabled}
                  className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
                />
              </div>
            )}
          </div>

          {fields.description !== false && (
            <div>
              <label htmlFor="meta-desc" className="block text-xs font-semibold text-[#78716C] mb-1">
                {labels.descriptionLabel}
              </label>
              <textarea
                id="meta-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={labels.descriptionPlaceholder}
                disabled={isDisabled}
                className="w-full px-3 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B] disabled:opacity-50"
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              id="metadata-edit-error"
              className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
              role="alert"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Custom content injection */}
          {children}

          {/* Footer Actions */}
          <div className="pt-4 flex justify-end gap-2 border-t border-[#E5DFD3]">
            {renderActions ? (
              renderActions({
                onCancel: handleCancel,
                onSubmit: handleSubmit,
                loading: isDisabled,
                disabled: isDisabled,
                isValid,
              })
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={handleCancel}
                  disabled={isDisabled}
                >
                  {labels.cancelLabel}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isDisabled || !isValid}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {isDisabled ? labels.savingLabel : labels.saveLabel}
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