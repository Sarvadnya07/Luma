import React, { useCallback, useMemo, useState, useRef } from "react";
import { Search, LayoutGrid, List, SlidersHorizontal, Plus, ChevronDown } from "lucide-react";
import { DocumentFormat, ReadingStatus, LibrarySortBy } from "@luma/shared-types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type LibraryStatusFilter = ReadingStatus | "all" | "want_to_read" | "on_hold" | "did_not_finish";

export interface FilterOption<T = string> {
  value: T;
  label: string;
}

export interface SortOption {
  value: LibrarySortBy;
  label: string;
}

export interface LibraryToolbarLabels {
  searchPlaceholder?: string;
  gridViewTooltip?: string;
  listViewTooltip?: string;
  sortButtonLabel?: string;
  addBookLabel?: string;
  reconcileLabel?: string;
  itemCountLabel?: (count: number) => string;
  allFormatsLabel?: string;
  allStatusesLabel?: string;
}

export interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  formatFilter: DocumentFormat | "all";
  onFormatChange: (fmt: DocumentFormat | "all") => void;
  statusFilter: LibraryStatusFilter;
  onStatusChange: (st: LibraryStatusFilter) => void;
  sortBy: LibrarySortBy;
  onSortByChange: (sort: LibrarySortBy) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (m: "grid" | "list") => void;
  onImportClick: () => void;
  onReconcileClick?: () => void;
  totalCount?: number;
  loading?: boolean;
  disabled?: boolean;

  // Customisation props
  labels?: LibraryToolbarLabels;
  formatOptions?: FilterOption<DocumentFormat | "all">[];
  statusOptions?: FilterOption<LibraryStatusFilter>[];
  sortOptions?: SortOption[];
  showAddButton?: boolean; // default: true
  showReconcileButton?: boolean; // default: false
  showStatusFilters?: boolean; // default: false
  showSortDropdown?: boolean; // default: true if sortOptions provided else false
  className?: string;
  containerClassName?: string;
  renderFilters?: (props: {
    formatFilter: DocumentFormat | "all";
    onFormatChange: (fmt: DocumentFormat | "all") => void;
    statusFilter: LibraryStatusFilter;
    onStatusChange: (st: LibraryStatusFilter) => void;
    sortBy: LibrarySortBy;
    onSortByChange: (sort: LibrarySortBy) => void;
  }) => React.ReactNode;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<LibraryToolbarLabels> = {
  searchPlaceholder: "Search Library...",
  gridViewTooltip: "Grid View",
  listViewTooltip: "List View",
  sortButtonLabel: "Sort",
  addBookLabel: "Add Book",
  reconcileLabel: "Reconcile",
  itemCountLabel: (count: number) => `Showing ${count} items`,
  allFormatsLabel: "All Formats",
  allStatusesLabel: "All Statuses",
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

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
  totalCount = 0,
  loading = false,
  disabled = false,
  labels: customLabels = {},
  formatOptions = [
    { value: "all", label: "All Formats" },
    { value: "epub", label: "EPUB" },
    { value: "pdf", label: "PDF" },
  ],
  statusOptions = [
    { value: "all", label: "All Statuses" },
    { value: "reading", label: "Reading" },
    { value: "completed", label: "Completed" },
    { value: "want_to_read", label: "Want to Read" },
    { value: "on_hold", label: "On Hold" },
    { value: "did_not_finish", label: "DNF" },
  ],
  sortOptions = [
    { value: "title", label: "Title" },
    { value: "author", label: "Author" },
    { value: "created_at", label: "Date Added" },
    { value: "last_read_at", label: "Last Read" },
    { value: "published_date", label: "Published" },
    { value: "file_size", label: "File Size" },
  ],
  showAddButton = true,
  showReconcileButton = false,
  showStatusFilters = false,
  showSortDropdown = true,
  className = "",
  containerClassName = "",
  renderFilters,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortButtonRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || loading;

  // Handle sort selection from dropdown
  const handleSortSelect = useCallback(
    (value: LibrarySortBy) => {
      onSortByChange(value);
      setIsSortMenuOpen(false);
    },
    [onSortByChange]
  );

  // Toggle sort menu
  const toggleSortMenu = useCallback(() => {
    if (showSortDropdown && sortOptions.length > 1) {
      setIsSortMenuOpen((prev) => !prev);
    } else {
      // Fallback to cycling if no dropdown
      const currentIndex = sortOptions.findIndex((opt) => opt.value === sortBy);
      const nextIndex = (currentIndex + 1) % Math.max(sortOptions.length, 1);
      const fallbackSortValue = sortOptions[0]?.value ?? "title";
      const nextSortValue = sortOptions[nextIndex]?.value ?? fallbackSortValue;
      onSortByChange(nextSortValue);
    }
  }, [showSortDropdown, sortOptions, sortBy, onSortByChange]);

  // Close sort menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortButtonRef.current &&
        !sortButtonRef.current.contains(event.target as Node)
      ) {
        setIsSortMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentSortLabel = useMemo(
    () => sortOptions.find((opt) => opt.value === sortBy)?.label || sortBy,
    [sortOptions, sortBy]
  );

  // Render filter pills
  const renderFilterPills = () => {
    if (renderFilters) {
      return renderFilters({
        formatFilter,
        onFormatChange,
        statusFilter,
        onStatusChange,
        sortBy,
        onSortByChange,
      });
    }

    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Format filters */}
        {formatOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onFormatChange(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              formatFilter === opt.value
                ? "bg-[#E4DED3] text-[#18181B] shadow-2xs"
                : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
            }`}
            disabled={isDisabled}
            aria-pressed={formatFilter === opt.value}
          >
            {opt.label}
          </button>
        ))}

        {/* Status filters (if enabled) */}
        {showStatusFilters && (
          <>
            <span className="w-px h-4 bg-[#E5DFD3] mx-1" />
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onStatusChange(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? "bg-[#E4DED3] text-[#18181B] shadow-2xs"
                    : "text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1]"
                }`}
                disabled={isDisabled}
                aria-pressed={statusFilter === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${containerClassName}`}>
      {/* Top Search & Actions Bar */}
      <div className={`flex items-center justify-between gap-4 ${className}`}>
        {/* Search Bar */}
        <div className="relative flex-1 max-w-xl" role="search">
          <Search className="w-3.5 h-3.5 text-[#8C8275] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={labels.searchPlaceholder}
            disabled={isDisabled}
            className="w-full pl-9 pr-4 py-2 bg-white border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] placeholder:text-[#8C8275] focus:outline-none focus:border-[#18181B] focus:ring-1 focus:ring-[#18181B]/20 transition-all shadow-2xs disabled:opacity-50"
            aria-label={labels.searchPlaceholder}
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
            title={labels.gridViewTooltip}
            aria-label={labels.gridViewTooltip}
            aria-pressed={viewMode === "grid"}
            disabled={isDisabled}
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
            title={labels.listViewTooltip}
            aria-label={labels.listViewTooltip}
            aria-pressed={viewMode === "list"}
            disabled={isDisabled}
          >
            <List className="w-4 h-4" />
          </button>

          {/* Sort Button / Dropdown */}
          <div className="relative" ref={sortButtonRef}>
            <button
              onClick={toggleSortMenu}
              className="px-2.5 py-2 rounded-lg text-[#78716C] hover:text-[#18181B] hover:bg-[#EFEAE1] transition-colors border border-transparent hover:border-[#DDD5C7] flex items-center gap-1.5"
              title={`${labels.sortButtonLabel}: ${currentSortLabel}`}
              aria-label={`${labels.sortButtonLabel}: ${currentSortLabel}`}
              aria-haspopup={showSortDropdown && sortOptions.length > 1}
              aria-expanded={isSortMenuOpen}
              disabled={isDisabled}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {showSortDropdown && sortOptions.length > 1 && (
                <>
                  <span className="text-[11px] font-medium text-[#57534E] max-w-[90px] truncate">
                    {currentSortLabel}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>

            {/* Sort Dropdown Menu */}
            {isSortMenuOpen && showSortDropdown && sortOptions.length > 1 && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-[#E5DFD3] rounded-lg shadow-lg py-1 z-10">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSortSelect(opt.value)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#EFEAE1] transition-colors ${
                      sortBy === opt.value
                        ? "bg-[#E4DED3] text-[#18181B] font-medium"
                        : "text-[#57534E]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reconcile Button (optional) */}
          {showReconcileButton && onReconcileClick && (
            <button
              onClick={onReconcileClick}
              disabled={isDisabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] shadow-2xs transition-colors"
            >
              <span>{labels.reconcileLabel}</span>
            </button>
          )}

          {/* Add Book Button (appears only when showAddButton is true) */}
          {showAddButton && (
            <button
              onClick={onImportClick}
              disabled={isDisabled}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD5C7] bg-[#FFFFFF] hover:bg-[#F3EFE6] text-xs font-medium text-[#1C1917] shadow-2xs transition-colors ml-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{labels.addBookLabel}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills & Item Count (only in list view) */}
      {viewMode === "list" && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {renderFilterPills()}
          </div>

          <span className="text-xs text-[#78716C] font-medium whitespace-nowrap">
            {labels.itemCountLabel(totalCount)}
          </span>
        </div>
      )}
    </div>
  );
};