import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { Book } from "@luma/shared-types";
import { Button } from "@luma/ui";

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
}

export const MetadataEditModal: React.FC<MetadataEditModalProps> = ({
  book,
  isOpen,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle || "");
  const [description, setDescription] = useState(book.description || "");
  const [publisher, setPublisher] = useState(book.publisher || "");
  const [publishedDate, setPublishedDate] = useState(book.published_date || "");
  const [language, setLanguage] = useState(book.language || "");
  const [isbn, setIsbn] = useState(book.isbn || "");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title,
        subtitle: subtitle || null,
        description: description || null,
        publisher: publisher || null,
        published_date: publishedDate || null,
        language: language || null,
        isbn: isbn || null,
      });
      onClose();
    } catch (err) {
      console.error("Failed to save metadata:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <h3 className="font-serif text-sm font-bold text-[#1C1917]">Edit Publication Metadata</h3>
          <button onClick={onClose} className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div>
            <label className="block text-xs font-semibold text-[#78716C] mb-1">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#78716C] mb-1">Subtitle</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#78716C] mb-1">Publisher</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#78716C] mb-1">Publication Date</label>
              <input
                type="text"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#78716C] mb-1">Language</label>
              <input
                type="text"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="en"
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#78716C] mb-1">ISBN / Identifier</label>
              <input
                type="text"
                value={isbn}
                onChange={(e) => setIsbn(e.target.value)}
                className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#78716C] mb-1">Synopsis / Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-[#E5DFD3]">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

