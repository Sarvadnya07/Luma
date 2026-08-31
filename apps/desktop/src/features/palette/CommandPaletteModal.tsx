import React, { useState, useEffect } from "react";
import { Search, BookOpen, Contrast, RefreshCw, CornerDownLeft } from "lucide-react";

import { LumaApi } from "../../lib/tauri";
import { Book } from "@luma/shared-types";

export interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction: (actionId: string) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    if (isOpen) {
      LumaApi.listBooks()
        .then((b) => setBooks(b))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bookItems = books.slice(0, 5).map((b) => ({
    id: `open_book_${b.id}`,
    category: "LIBRARY",
    icon: BookOpen,
    label: `Open Book: ${b.title}`,
  }));

  const systemItems = [
    {
      id: "search_annotations",
      category: "SYSTEM",
      icon: Search,
      label: "Search Annotations...",
    },
    {
      id: "toggle_eink",
      category: "SYSTEM",
      icon: Contrast,
      label: "Change Theme to E-Ink",
    },
    {
      id: "start_backup",
      category: "SYSTEM",
      icon: RefreshCw,
      label: "Sync / Backup Library",
    },
  ];

  const items = [...bookItems, ...systemItems];

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-[#1C1917]">
        {/* Search Header */}
        <div className="relative border-b border-[#E5DFD3] flex items-center px-4 py-3.5">
          <Search className="w-4 h-4 text-[#78716C] mr-3 flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full bg-transparent border-none text-xs text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[#78716C] bg-[#EFEAE1] border border-[#DDD5C7] rounded">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-3 space-y-4 max-h-80 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-[#78716C] text-center py-6">No commands found.</p>
          ) : (
            <div className="space-y-3">
              {["RECENT", "LIBRARY", "SYSTEM"].map((cat) => {
                const group = filteredItems.filter((i) => i.category === cat);
                if (group.length === 0) return null;
                return (
                  <div key={cat} className="space-y-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-[#78716C] px-3 font-mono">
                      {cat}
                    </span>
                    <div className="space-y-0.5">
                      {group.map((item, idx) => {
                        const Icon = item.icon;
                        const isSelected = selectedIndex === idx;
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              onSelectAction(item.id);
                              onClose();
                            }}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                              isSelected
                                ? "bg-[#EFEAE1] text-[#18181B]"
                                : "text-[#57534E] hover:bg-[#F5EFE6] hover:text-[#18181B]"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <Icon className="w-4 h-4 text-[#78716C]" />
                              <span>{item.label}</span>
                            </div>
                            {isSelected && (
                              <CornerDownLeft className="w-3.5 h-3.5 text-[#78716C]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F5EFE6] border-t border-[#E5DFD3] text-[10px] text-[#78716C]">
          <div className="flex items-center gap-3">
            <span>↑ ↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span className="font-mono">Luma v0.1.0-alpha</span>
        </div>
      </div>
    </div>
  );
};
