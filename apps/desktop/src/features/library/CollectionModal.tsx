import React, { useState } from "react";
import { X, FolderPlus } from "lucide-react";
import { Button } from "@luma/ui";

export interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => Promise<void>;
}

export const CollectionModal: React.FC<CollectionModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate(name.trim(), description.trim() || undefined);
      setName("");
      setDescription("");
      onClose();
    } catch (err) {
      console.error("Failed to create collection:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5DFD3]">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#18181B]" />
            <h3 className="font-serif text-sm font-bold text-[#1C1917]">Create New Collection</h3>
          </div>
          <button onClick={onClose} className="text-[#78716C] hover:text-[#18181B] p-1 rounded-md hover:bg-[#EFEAE1]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#78716C] mb-1">Collection Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Modernist Classics"
              className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#78716C] mb-1">Description (Optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this collection..."
              className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#18181B]"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Collection"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

