import React, { useState } from "react";
import { Copy, MessageSquare, Bookmark, Check } from "lucide-react";
import { ANNOTATION_HIGHLIGHT_COLORS } from "@luma/design-system";

export interface TextSelectionToolbarProps {
  position: { top: number; left: number } | null;
  selectedText: string;
  onHighlight: (colorHex: string, note?: string) => void;
  onBookmark?: () => void;
  onClose: () => void;
}

export const TextSelectionToolbar: React.FC<TextSelectionToolbarProps> = ({
  position,
  selectedText,
  onHighlight,
  onBookmark,
  onClose,
}) => {
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(ANNOTATION_HIGHLIGHT_COLORS[0].hex);
  const [copied, setCopied] = useState(false);

  if (!position || !selectedText) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveNote = () => {
    onHighlight(selectedColor, noteText.trim() || undefined);
    setIsNoteInputOpen(false);
    setNoteText("");
    onClose();
  };

  return (
    <div
      style={{
        top: `${Math.max(10, position.top - 50)}px`,
        left: `${Math.max(10, position.left)}px`,
      }}
      className="fixed z-50 transform -translate-x-1/2 bg-[#FAF7F2] border border-[#E5DFD3] rounded-full shadow-xl p-1.5 flex items-center gap-1.5 text-[#1C1917] animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Color Pills for Instant Highlight */}
      <div className="flex items-center gap-1.5 px-1.5 border-r border-[#E5DFD3]">
        {ANNOTATION_HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.hex}
            onClick={() => {
              setSelectedColor(c.hex);
              onHighlight(c.hex);
              onClose();
            }}
            className="w-4 h-4 rounded-full border border-[#D6CEC2] hover:scale-125 transition-transform shadow-xs"
            style={{ backgroundColor: c.hex }}
            title={`Highlight ${c.name}`}
          />
        ))}
      </div>

      {/* Add Note Button */}
      <button
        onClick={() => setIsNoteInputOpen(!isNoteInputOpen)}
        className={`p-1.5 rounded-full hover:bg-[#EFEAE1] transition-colors ${
          isNoteInputOpen ? "text-[#18181B] bg-[#EFEAE1]" : "text-[#78716C]"
        }`}
        title="Add Note"
      >
        <MessageSquare className="w-3.5 h-3.5" />
      </button>

      {/* Copy Button */}
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-full hover:bg-[#EFEAE1] text-[#78716C] transition-colors"
        title="Copy text"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>

      {/* Bookmark Action */}
      {onBookmark && (
        <button
          onClick={() => {
            onBookmark();
            onClose();
          }}
          className="p-1.5 rounded-full hover:bg-[#EFEAE1] text-[#78716C] transition-colors"
          title="Add bookmark here"
        >
          <Bookmark className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Note Input Popover */}
      {isNoteInputOpen && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-72 bg-[#FAF7F2] border border-[#E5DFD3] rounded-xl p-3 shadow-2xl z-50 text-xs">
          <textarea
            autoFocus
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Write your note or insight..."
            className="w-full bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg p-2 text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#18181B]"
          />
          <div className="flex justify-between items-center mt-2">
            <div className="flex gap-1">
              {ANNOTATION_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => setSelectedColor(c.hex)}
                  className={`w-3.5 h-3.5 rounded-full ${
                    selectedColor === c.hex ? "ring-2 ring-[#18181B]" : ""
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <button
              onClick={handleSaveNote}
              className="px-3 py-1 bg-[#18181B] hover:bg-[#27272A] text-white rounded-lg font-medium transition-colors text-xs"
            >
              Save Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

