import React, { useState, useMemo, useCallback } from "react";
import {
  BookOpen,
  Search,
  AlertTriangle,
  Edit3,
  ExternalLink,
  SlidersHorizontal,
  Download,
  Check,
} from "lucide-react";
import { AnnotationRepairWorkflow } from "./AnnotationRepairWorkflow";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface AnnotationItem {
  id: string;
  book_id: string;
  book_title: string;
  author: string;
  quote: string;
  note: string | null;
  created_at: string; // ISO date string
  color: string; // hex
  needs_repair?: boolean;
  type?: "highlight" | "note" | "bookmark"; // for filtering
}

export interface GlobalAnnotationCenterProps {
  annotations?: AnnotationItem[];
  onOpenBook?: (bookId: string) => void;
  onRepairAccept?: (candidateId: string) => void;
  // Optional custom labels
  libraryLabel?: string;
  exportMarkdownTemplate?: (item: AnnotationItem) => string;
  // Optional filters configuration
  filterTypes?: { value: string; label: string; defaultChecked?: boolean }[];
}

// ------------------------------------------------------------------
// Sub‑component: FilterSidebar
// ------------------------------------------------------------------

interface FilterSidebarProps {
  filterTypes: { value: string; label: string; defaultChecked?: boolean }[];
  activeStatus: "all" | "attention" | "resolved";
  onStatusChange: (status: "all" | "attention" | "resolved") => void;
  typeFilters: Record<string, boolean>;
  onTypeToggle: (type: string) => void;
  counts: { total: number; attention: number; resolved: number; byType: Record<string, number> };
  onClearRecent?: () => void;
  recentBooks?: { id: string; title: string; author: string }[];
  onOpenBook?: (bookId: string) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filterTypes,
  activeStatus,
  onStatusChange,
  typeFilters,
  onTypeToggle,
  counts,
  onClearRecent,
  recentBooks = [],
  onOpenBook,
}) => {
  return (
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
          {filterTypes.map(({ value, label }) => (
            <label key={value} className="flex items-center justify-between cursor-pointer text-[#57534E] hover:text-[#1C1917]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={typeFilters[value] ?? false}
                  onChange={() => onTypeToggle(value)}
                  className="rounded border-[#DDD5C7] text-[#18181B] focus:ring-0"
                />
                <span>{label}</span>
              </div>
              <span className="text-[11px] font-mono text-[#78716C] bg-[#EFEAE1] px-1.5 py-0.5 rounded">
                {counts.byType[value] || 0}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* By Status */}
      <div className="space-y-2">
        <span className="text-[11px] font-bold text-[#1C1917] block">By Status</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onStatusChange("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeStatus === "all"
                ? "bg-[#18181B] text-white"
                : "bg-white border border-[#DDD5C7] text-[#57534E] hover:border-[#18181B]"
            }`}
          >
            All Active ({counts.total})
          </button>
          <button
            onClick={() => onStatusChange("attention")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
              activeStatus === "attention"
                ? "bg-rose-700 text-white"
                : "bg-rose-50 border border-rose-200 text-rose-800 hover:bg-rose-100"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Needs Attention ({counts.attention})</span>
          </button>
          <button
            onClick={() => onStatusChange("resolved")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              activeStatus === "resolved"
                ? "bg-[#18181B] text-white"
                : "bg-white border border-[#DDD5C7] text-[#57534E] hover:border-[#18181B]"
            }`}
          >
            Resolved ({counts.resolved})
          </button>
        </div>
      </div>

      {/* Recent Sources */}
      {recentBooks.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#E5DFD3]">
          <div className="flex items-center justify-between text-[11px] text-[#78716C]">
            <span className="font-bold text-[#1C1917]">Recent Sources</span>
            {onClearRecent && (
              <button onClick={onClearRecent} className="hover:text-[#18181B]">
                Clear All
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {recentBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => onOpenBook?.(book.id)}
                className="flex items-center gap-2 p-2 rounded-xl bg-white border border-[#E5DFD3] hover:border-[#DDD5C7] cursor-pointer transition-all shadow-2xs group"
              >
                <div className="w-6 h-8 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-[#8C8275]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate group-hover:text-black">
                    {book.title}
                  </h5>
                  <p className="text-[10px] text-[#78716C] truncate">{book.author}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const GlobalAnnotationCenter: React.FC<GlobalAnnotationCenterProps> = ({
  annotations = [],
  onOpenBook,
  onRepairAccept,
  libraryLabel = "Library",
  exportMarkdownTemplate,
  filterTypes = [
    { value: "highlight", label: "Highlights", defaultChecked: true },
    { value: "note", label: "Notes", defaultChecked: true },
    { value: "bookmark", label: "Bookmarks", defaultChecked: false },
  ],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<"all" | "attention" | "resolved">("all");
  const [typeFilters, setTypeFilters] = useState<Record<string, boolean>>(() =>
    filterTypes.reduce((acc, f) => ({ ...acc, [f.value]: f.defaultChecked ?? false }), {})
  );
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Derived counts and filtered items
  const counts = useMemo(() => {
    const total = annotations.length;
    const attention = annotations.filter((a) => a.needs_repair).length;
    const resolved = total - attention;
    const byType = filterTypes.reduce((acc, f) => {
      const count = annotations.filter((a) => (a.type || "highlight") === f.value).length;
      return { ...acc, [f.value]: count };
    }, {} as Record<string, number>);
    return { total, attention, resolved, byType };
  }, [annotations, filterTypes]);

  const filteredItems = useMemo(() => {
    return annotations.filter((item) => {
      // Status filter
      if (activeStatus === "attention" && !item.needs_repair) return false;
      if (activeStatus === "resolved" && item.needs_repair) return false;

      // Type filters
      const itemType = item.type || "highlight";
      if (!typeFilters[itemType]) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.quote.toLowerCase().includes(q) ||
          (item.note?.toLowerCase().includes(q) ?? false) ||
          item.book_title.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [annotations, activeStatus, typeFilters, searchQuery]);

  const handleTypeToggle = useCallback((type: string) => {
    setTypeFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const handleExport = useCallback(() => {
    const template = exportMarkdownTemplate || ((item: AnnotationItem) =>
      `### ${item.book_title}\n*${item.author}*\n\n> "${item.quote}"\n\n${item.note ? `**Note:** ${item.note}\n` : ""}\n*Date: ${new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}*\n\n---`
    );
    const md = filteredItems.map(template).join("\n\n");
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [filteredItems, exportMarkdownTemplate]);

  // Mock recent books (could be derived from annotations or passed as prop)
  const recentBooks = useMemo(() => {
    const uniqueBooks = Array.from(
      new Map(annotations.map((a) => [a.book_id, { id: a.book_id, title: a.book_title, author: a.author }]))
    ).map(([_, value]) => value);
    return uniqueBooks.slice(0, 3); // show top 3
  }, [annotations]);

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#FAF7F2] text-[#1C1917]">
      {/* Main Annotation Feed & Toolbar */}
      <div className="flex-1 flex flex-col px-8 py-6 overflow-y-auto w-full">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
          <div className="flex items-center gap-6">
            <h1 className="font-serif text-2xl font-bold text-[#1C1917]">Annotations</h1>
            <div className="flex items-center gap-4 text-xs font-medium text-[#78716C]">
              <span className="text-[#18181B] font-semibold cursor-pointer">
                {libraryLabel} ({annotations.length})
              </span>
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
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#DDD5C7] rounded-lg text-xs placeholder:text-[#A8A29E] focus:outline-none focus:border-[#18181B]"
                aria-label="Search annotations"
              />
            </div>
            <button
              onClick={handleExport}
              title="Export filtered annotations as Markdown"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DDD5C7] hover:border-[#18181B] rounded-lg text-xs font-medium text-[#1C1917] shadow-2xs transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-[#78716C]" />
                  <span>Export MD</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Annotation Cards Stream */}
        <div className="space-y-6 pt-6 pb-12 max-w-3xl">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#E5DFD3] rounded-2xl p-8 space-y-2">
              <BookOpen className="w-8 h-8 text-[#A8A29E] mx-auto" />
              <h3 className="font-serif text-base font-bold text-[#1C1917]">No annotations match your filter</h3>
              <p className="text-xs text-[#78716C]">Try clearing search filters or highlight text while reading.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-6 shadow-2xs space-y-4 border ${
                  item.needs_repair ? "border-rose-200" : "border-[#E5DFD3]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-9 bg-[#EAE4DA] rounded border border-[#DDD5C7] flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-[#8C8275]" />
                    </div>
                    <div>
                      <h3 className="font-serif text-sm font-bold text-[#1C1917]">{item.book_title}</h3>
                      <p className="text-[11px] text-[#78716C]">{item.author}</p>
                    </div>
                  </div>
                  {item.needs_repair && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      NEEDS RE‑ANCHORING
                    </span>
                  )}
                </div>

                {/* Quote */}
                <p className="font-serif text-base italic text-[#292524] leading-relaxed pl-3 border-l-2 border-[#D6CEC2]">
                  "{item.quote}"
                </p>

                {/* Attached Note if present */}
                {item.note && (
                  <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                      <Edit3 className="w-3.5 h-3.5 text-[#8C8275]" />
                      <span className="font-semibold text-[#1C1917]">Personal Note</span>
                    </div>
                    <p className="text-xs text-[#57534E] leading-relaxed">{item.note}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-[11px] text-[#78716C] pt-2 border-t border-[#F2ECE2]">
                  <span>{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  <div className="flex items-center gap-3">
                    {item.needs_repair ? (
                      <button
                        onClick={() => setIsRepairOpen(true)}
                        className="py-1.5 px-3.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                      >
                        <span>Resolve Re‑Anchor</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onOpenBook?.(item.book_id)}
                        className="hover:text-[#18181B] font-semibold text-[#18181B] flex items-center gap-1"
                      >
                        <span>Open in Book</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <FilterSidebar
        filterTypes={filterTypes}
        activeStatus={activeStatus}
        onStatusChange={setActiveStatus}
        typeFilters={typeFilters}
        onTypeToggle={handleTypeToggle}
        counts={counts}
        recentBooks={recentBooks}
        onOpenBook={onOpenBook}
      />

      {/* Repair Modal */}
      {isRepairOpen && (
        <AnnotationRepairWorkflow
          isOpen={isRepairOpen}
          onClose={() => setIsRepairOpen(false)}
          // We need to pass data here – ideally we have it from the annotation that triggered repair.
          // For now, we'll pass a placeholder, but in a real app you'd pass the specific item's data.
          data={{
            bookTitle: "Meditations", // should come from the item
            originalPassage: "…", // etc.
            highlightedQuote: "…",
            note: { text: "…", createdAt: new Date().toISOString() },
            candidates: [],
          }}
          onAcceptCandidate={onRepairAccept}
        />
      )}
    </div>
  );
};