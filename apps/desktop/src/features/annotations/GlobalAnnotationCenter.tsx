import React, { useState } from "react";
import {
  BookOpen,
  Search,
  Share2,
  AlertTriangle,
  Edit3,
  ExternalLink,
  SlidersHorizontal,
  User,
  Settings,
  HelpCircle,
} from "lucide-react";
import { AnnotationRepairWorkflow } from "./AnnotationRepairWorkflow";

export interface GlobalAnnotationCenterProps {
  onOpenBook?: (bookId: string) => void;
}

export const GlobalAnnotationCenter: React.FC<GlobalAnnotationCenterProps> = ({
  onOpenBook,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilterStatus, setActiveFilterStatus] = useState<"all" | "attention" | "resolved">("all");
  const [filterHighlights, setFilterHighlights] = useState(true);
  const [filterNotes, setFilterNotes] = useState(true);
  const [filterBookmarks, setFilterBookmarks] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#FAF7F2] text-[#1C1917]">
      {/* Main Annotation Feed & Toolbar */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-y-auto w-full">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
          <div className="flex items-center gap-6">
            <h1 className="font-serif text-2xl font-bold text-[#1C1917]">Annotations</h1>
            <div className="flex items-center gap-4 text-xs font-medium text-[#78716C]">
              <span className="text-[#18181B] font-semibold cursor-pointer">Library</span>
              <span className="hover:text-[#18181B] cursor-pointer">Collections</span>
              <span className="hover:text-[#18181B] cursor-pointer">History</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
              <input
                type="text"
                placeholder="Search across annotations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFFFF] border border-[#DDD5C7] rounded-lg text-xs placeholder:text-[#A8A29E] focus:outline-none focus:border-[#18181B]"
              />
            </div>
            <button className="p-1.5 text-[#78716C] hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]">
              <User className="w-4 h-4" />
            </button>
            <button className="p-1.5 text-[#78716C] hover:text-[#18181B] rounded-lg hover:bg-[#EFEAE1]">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Annotation Cards Stream */}
        <div className="space-y-6 pt-6 pb-12 max-w-3xl">
          {/* Card 1: Meditations Note */}
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-9 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-[#8C8275]" />
                </div>
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#1C1917]">Meditations</h3>
                  <p className="text-[11px] text-[#78716C]">Marcus Aurelius • Book 4, Chapter 3</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#78716C]">
                <button className="p-1 hover:text-[#18181B]">
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quote */}
            <p className="font-serif text-base italic text-[#292524] leading-relaxed pl-3 border-l-2 border-[#D6CEC2]">
              "When you wake up in the morning, tell yourself: The people I deal with today will be meddling, ungrateful, arrogant, dishonest, jealous and surly."
            </p>

            {/* Attached Note */}
            <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                <Edit3 className="w-3.5 h-3.5 text-[#8C8275]" />
                <span className="font-semibold text-[#1C1917]">Personal Note</span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Relevant to dealing with modern client interactions. Remember the stoic frame; their behavior is a reflection of their own lack of understanding, not a personal attack.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-[#78716C] pt-2 border-t border-[#F2ECE2]">
              <span>Oct 14, 2023 • 10:42 AM</span>
              <div className="flex items-center gap-3">
                <button className="hover:text-[#18181B] font-medium">Share Note</button>
                <button
                  onClick={() => onOpenBook?.("book_meditations")}
                  className="hover:text-[#18181B] font-semibold text-[#18181B] flex items-center gap-1"
                >
                  <span>Open in Book (p.42)</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Needs Re-Anchoring */}
          <div className="bg-[#FFFFFF] border border-rose-200 rounded-2xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-9 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-[#8C8275]" />
                </div>
                <div>
                  <h3 className="font-serif text-sm font-bold text-[#1C1917]">The Design of Everyday Things</h3>
                  <p className="text-[11px] text-[#78716C]">Don Norman • Chapter 1: The Psychopathology of Everyday Things</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                NEEDS RE-ANCHORING
              </span>
            </div>

            {/* Quote */}
            <p className="font-serif text-base italic text-[#292524] leading-relaxed pl-3 border-l-2 border-rose-300">
              "Good design requires, among other things, good communication of the purpose, structure, and operation of the device to the user."
            </p>

            {/* Note with Alert */}
            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-rose-800 font-semibold">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Incomplete Thought</span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                Need to cross-reference this principle with the Affordances chapter in Gibson's book. How does visual feedback loop into that? [Finish note later]
              </p>
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#F2ECE2]">
              <button className="text-xs text-[#78716C] hover:text-[#18181B] font-medium">
                Dismiss
              </button>
              <button
                onClick={() => setIsRepairOpen(true)}
                className="py-1.5 px-3.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <span>Resolve Re-Anchor</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Filter & Sources Panel */}
      <aside className="w-72 border-l border-[#E5DFD3] bg-[#FAF7F2] p-6 space-y-6 flex-shrink-0 select-none overflow-y-auto">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C]">
            FILTER ANNOTATIONS
          </span>
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#78716C]" />
        </div>

        {/* By Type */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#1C1917] block">By Type</span>
          <div className="space-y-1.5 text-xs">
            <label className="flex items-center justify-between cursor-pointer text-[#57534E] hover:text-[#1C1917]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterHighlights}
                  onChange={(e) => setFilterHighlights(e.target.checked)}
                  className="rounded border-[#DDD5C7] text-[#18181B] focus:ring-0"
                />
                <span>Highlights</span>
              </div>
              <span className="text-[11px] font-mono text-[#78716C] bg-[#EFEAE1] px-1.5 py-0.5 rounded">142</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#57534E] hover:text-[#1C1917]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterNotes}
                  onChange={(e) => setFilterNotes(e.target.checked)}
                  className="rounded border-[#DDD5C7] text-[#18181B] focus:ring-0"
                />
                <span>Notes</span>
              </div>
              <span className="text-[11px] font-mono text-[#78716C] bg-[#EFEAE1] px-1.5 py-0.5 rounded">38</span>
            </label>

            <label className="flex items-center justify-between cursor-pointer text-[#57534E] hover:text-[#1C1917]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filterBookmarks}
                  onChange={(e) => setFilterBookmarks(e.target.checked)}
                  className="rounded border-[#DDD5C7] text-[#18181B] focus:ring-0"
                />
                <span>Bookmarks</span>
              </div>
              <span className="text-[11px] font-mono text-[#78716C] bg-[#EFEAE1] px-1.5 py-0.5 rounded">12</span>
            </label>
          </div>
        </div>

        {/* By Status */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#1C1917] block">By Status</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveFilterStatus("all")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilterStatus === "all"
                  ? "bg-[#18181B] text-white"
                  : "bg-[#FFFFFF] border border-[#DDD5C7] text-[#57534E] hover:border-[#18181B]"
              }`}
            >
              All Active
            </button>
            <button
              onClick={() => setActiveFilterStatus("attention")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                activeFilterStatus === "attention"
                  ? "bg-rose-700 text-white"
                  : "bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Needs Attention (1)</span>
            </button>
            <button
              onClick={() => setActiveFilterStatus("resolved")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                activeFilterStatus === "resolved"
                  ? "bg-[#18181B] text-white"
                  : "bg-[#FFFFFF] border border-[#DDD5C7] text-[#57534E] hover:border-[#18181B]"
              }`}
            >
              Resolved
            </button>
          </div>
        </div>

        {/* Recent Sources */}
        <div className="space-y-2 pt-2 border-t border-[#E5DFD3]">
          <div className="flex items-center justify-between text-[11px] text-[#78716C]">
            <span className="font-bold text-[#1C1917]">Recent Sources</span>
            <button className="hover:text-[#18181B]">Clear All</button>
          </div>
          <div className="space-y-1.5">
            <div
              onClick={() => onOpenBook?.("book_meditations")}
              className="flex items-center gap-2 p-2 rounded-xl bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
            >
              <div className="w-6 h-8 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                  Meditations
                </h5>
                <p className="text-[10px] text-[#78716C] truncate">Marcus Aurelius</p>
              </div>
            </div>

            <div
              onClick={() => onOpenBook?.("book_design_everyday")}
              className="flex items-center gap-2 p-2 rounded-xl bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
            >
              <div className="w-6 h-8 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                  The Design of Everyday...
                </h5>
                <p className="text-[10px] text-[#78716C] truncate">Don Norman</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Repair Modal */}
      <AnnotationRepairWorkflow
        isOpen={isRepairOpen}
        onClose={() => setIsRepairOpen(false)}
        onAcceptCandidate={() => setIsRepairOpen(false)}
      />
    </div>
  );
};
