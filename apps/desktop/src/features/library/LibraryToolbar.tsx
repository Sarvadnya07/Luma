import React from "react";
import { Search, LayoutGrid, List, SlidersHorizontal, Plus } from "lucide-react";
import { DocumentFormat, ReadingStatus, LibrarySortBy } from "@luma/shared-types";

export interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  formatFilter: DocumentFormat | "all";
  onFormatChange: (fmt: DocumentFormat | "all") => void;
  statusFilter: ReadingStatus | "all";
  onStatusChange: (st: ReadingStatus | "all") => void;
  sortBy: LibrarySortBy;
  onSortByChange: (sort: LibrarySortBy) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (m: "grid" | "list") => void;
  onImportClick: () => void;
  onReconcileClick?: () => void;
  totalCount?: number;
  loading?: boolean;
}

export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  searchQuery,
  onSearchChange,
  formatFilter,
  onFormatChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onImportClick,
  totalCount = 42,
}) => {
  return (
    <div className="space-y-4">
      {/* Top Search & Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search Bar matching screenshots */}
        <div className="relative flex-1 max-w-xl">
          <Search className="w-3.5 h-3.5 text-[#8C8275] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search Library..."
            className="w-full pl-9 pr-4 py-2 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] placeholder:text-[#8C8275] focus:outline-none focus:border-[#18181B] focus:ring-1 focus:ring-[#18181B]/20 transition-all shadow-2xs"
          />
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Grid View Toggle */}
          <button
            onClick={() => onViewModeChange("grid")}
            className={`p-2 rounded-lg transition-colors border ${
              viewMode === "grid"
                ? "bg-[#EAE4DA] text-[#18181B] border-[#DDD5C7] shadow-2xs"
                : "bg-transparent text-[#78716C] border-transparent hover:bg-[#EFEAE1] hover:text-[#18181B]"
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          {/* List View Toggle */}
          <button
            onClick={() => onViewModeChange("list")}
            className={`p-2 rounded-lg transition-colors border ${
              viewMode === "list"
                ? "bg-[#EAE4DA] text-[#18181B] border-[#DDD5C7] shadow-2xs"
                : "bg-transparent text-[#78716C] border-transparent hover:bg-[#EFEAE1] hover:text-[#18181B]"
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>

          {/* Sort / Filter Button */}
          <button
            onClick={() => {
              const nextSort: Record<LibrarySortBy, LibrarySortBy> = {
                title: "author",
                author: "created_at",
                created_at: "last_read_at",
                last_read_at: "published_date",
                published_date: "file_size",
                file_size: "title",
              };
              onSortByChange(nextSort[sortBy] || "title");
            }}
            className="p-2 rounded-lg text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors border border-transparent hover:border-[#DDD5C7]"
            title={`Sort: ${sortBy}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Add Book Button in list toolbar */}
          {viewMode === "list" && (
            <button
              onClick={onImportClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] shadow-2xs transition-colors ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Book</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs / Pills in List View or Grid View */}
      {viewMode === "list" && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onFormatChange("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                formatFilter === "all"
                  ? "bg-[#E4DED3] text-[#18181B] shadow-2xs"
                  : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
              }`}
            >
              All Formats
            </button>
            <button
              onClick={() => onFormatChange("epub")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                formatFilter === "epub"
                  ? "bg-[#E4DED3] text-[#18181B] shadow-2xs"
                  : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
              }`}
            >
              EPUB
            </button>
            <button
              onClick={() => onFormatChange("pdf")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                formatFilter === "pdf"
                  ? "bg-[#E4DED3] text-[#18181B] shadow-2xs"
                  : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
              }`}
            >
              PDF
            </button>
          </div>

          <span className="text-xs text-[#78716C] font-medium">
            Showing {totalCount} items
          </span>
        </div>
      )}
    </div>
  );
};

