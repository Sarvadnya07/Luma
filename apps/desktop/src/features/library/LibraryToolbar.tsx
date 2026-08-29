import React from "react";
import { Search, LayoutGrid, List, RefreshCw, FolderPlus } from "lucide-react";
import { DocumentFormat, ReadingStatus, LibrarySortBy } from "@luma/shared-types";
import { Button } from "@luma/ui";

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
  onReconcileClick: () => void;
  loading: boolean;
}

export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  searchQuery,
  onSearchChange,
  formatFilter,
  onFormatChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
  onImportClick,
  onReconcileClick,
  loading,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
      {/* Search Bar */}
      <div className="relative flex-1 min-w-[240px] max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title, author, series, or tags..."
          className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all"
        />
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Format Select */}
        <select
          value={formatFilter}
          onChange={(e) => onFormatChange(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700"
        >
          <option value="all">All Formats</option>
          <option value="epub">EPUB</option>
          <option value="pdf">PDF</option>
          <option value="cbz">CBZ Comics</option>
          <option value="txt">Plain Text</option>
          <option value="md">Markdown</option>
        </select>

        {/* Status Select */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700"
        >
          <option value="all">All Statuses</option>
          <option value="unread">Unread</option>
          <option value="reading">Reading</option>
          <option value="completed">Completed</option>
        </select>

        {/* Sort Select */}
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as any)}
          className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-slate-700"
        >
          <option value="title">Sort: Title</option>
          <option value="author">Sort: Author</option>
          <option value="created_at">Sort: Recently Added</option>
          <option value="last_read_at">Sort: Recently Read</option>
          <option value="published_date">Sort: Release Year</option>
        </select>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange("grid")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "grid" ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange("list")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "list" ? "bg-slate-800 text-sky-400" : "text-slate-500 hover:text-slate-300"
            }`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Reconcile Files */}
        <Button variant="secondary" size="sm" onClick={onReconcileClick} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Verify Integrity
        </Button>

        {/* Import */}
        <Button variant="primary" size="sm" onClick={onImportClick}>
          <FolderPlus className="w-4 h-4 mr-1.5" />
          Import
        </Button>
      </div>
    </div>
  );
};
