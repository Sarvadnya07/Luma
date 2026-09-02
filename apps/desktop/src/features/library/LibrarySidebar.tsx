import React, { useCallback, useMemo } from "react";
import {
  Library,
  BookOpen,
  Clock,
  Layers,
  Tag as TagIcon,
  Users,
  Bookmark,
  Edit3,
  Archive,
  Trash2,
  Plus,
  Compass,
  FileText,
  HelpCircle,
  FolderKanban,
  BarChart2,
  Smartphone,
  Puzzle,
  Moon,
  Sun,
  Settings,
} from "lucide-react";
import { Collection, Tag } from "@luma/shared-types";
import { LumaLogo } from "@luma/ui";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type SidebarSection =
  | "library"
  | "all"
  | "reading"
  | "collections"
  | "tags"
  | "authors"
  | "series"
  | "annotations"
  | "history"
  | "atrium"
  | "notes"
  | "flashcards"
  | "projects"
  | "devices"
  | "plugins"
  | "archive"
  | "trash";

export interface NavigationItem {
  id: SidebarSection | string;
  label: string;
  icon: React.ElementType;
  /** Optional section grouping (e.g., "primary", "study", "explore") */
  section?: "primary" | "study" | "explore";
}

export interface LibrarySidebarLabels {
  brandName?: string;
  brandSubtitle?: string;
  primarySectionLabel?: string;
  studySectionLabel?: string;
  exploreSectionLabel?: string;
  importButtonLabel?: string;
  settingsTooltip?: string;
  darkModeToggleLabel?: string;
  lightModeToggleLabel?: string;
  noCollectionsLabel?: string;
  noTagsLabel?: string;
}

export interface LibrarySidebarProps {
  currentSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  collections?: Collection[];
  tags?: Tag[];
  selectedCollectionId?: string | null;
  selectedTagId?: string | null;
  onSelectCollection?: (id: string | null) => void;
  onSelectTag?: (id: string | null) => void;
  onCreateCollection?: () => void;
  onImportClick?: () => void;
  onOpenSettings?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  labels?: LibrarySidebarLabels;
  /** Custom navigation items – if provided, overrides the default ones */
  items?: NavigationItem[];
  /** Custom logo component (defaults to LumaLogo) */
  logo?: React.ReactNode;
  /** Custom brand wordmark (e.g., text, image) – if provided, replaces brand name + subtitle */
  brandWordmark?: React.ReactNode;
  /** Additional CSS classes for the sidebar container */
  className?: string;
  /** Additional CSS classes for each navigation item */
  itemClassName?: string;
  /** Custom icon for dark mode toggle (when dark) */
  darkModeIcon?: React.ReactNode;
  /** Custom icon for light mode toggle (when light) */
  lightModeIcon?: React.ReactNode;
  /** Custom render function for sub‑items (collections/tags) */
  renderSubItems?: (props: {
    type: "collections" | "tags";
    items: Collection[] | Tag[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
  }) => React.ReactNode;
}

// ------------------------------------------------------------------
// Default Labels
// ------------------------------------------------------------------

const DEFAULT_LABELS: Required<LibrarySidebarLabels> = {
  brandName: "Luma",
  brandSubtitle: "Digital Sanctuary",
  primarySectionLabel: "",
  studySectionLabel: "Deep Study",
  exploreSectionLabel: "Explore",
  importButtonLabel: "Import Book",
  settingsTooltip: "System & Preferences",
  darkModeToggleLabel: "Switch to light mode",
  lightModeToggleLabel: "Switch to dark mode",
  noCollectionsLabel: "No collections",
  noTagsLabel: "No tags",
};

// ------------------------------------------------------------------
// Default Navigation Items
// ------------------------------------------------------------------

const DEFAULT_ITEMS: NavigationItem[] = [
  // Primary
  { id: "library", label: "Library", icon: Library, section: "primary" },
  { id: "all", label: "All Books", icon: BookOpen, section: "primary" },
  { id: "reading", label: "Currently Reading", icon: Clock, section: "primary" },
  { id: "collections", label: "Collections", icon: Layers, section: "primary" },
  { id: "tags", label: "Tags", icon: TagIcon, section: "primary" },
  // Study
  { id: "atrium", label: "The Atrium", icon: Compass, section: "study" },
  { id: "notes", label: "Notes Workspace", icon: FileText, section: "study" },
  { id: "flashcards", label: "Flashcards", icon: HelpCircle, section: "study" },
  { id: "projects", label: "Research Projects", icon: FolderKanban, section: "study" },
  { id: "history", label: "Reading Intelligence", icon: BarChart2, section: "study" },
  // Explore
  { id: "authors", label: "Authors", icon: Users, section: "explore" },
  { id: "series", label: "Series", icon: Bookmark, section: "explore" },
  { id: "annotations", label: "Annotations", icon: Edit3, section: "explore" },
  { id: "devices", label: "Devices", icon: Smartphone, section: "explore" },
  { id: "plugins", label: "Plugins", icon: Puzzle, section: "explore" },
  { id: "archive", label: "Archive", icon: Archive, section: "explore" },
  { id: "trash", label: "Trash", icon: Trash2, section: "explore" },
];

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  currentSection,
  onSelectSection,
  collections = [],
  tags = [],
  selectedCollectionId = null,
  selectedTagId = null,
  onSelectCollection,
  onSelectTag,
  onCreateCollection,
  onImportClick,
  onOpenSettings,
  isDarkMode = false,
  onToggleDarkMode,
  labels: customLabels = {},
  items = DEFAULT_ITEMS,
  logo,
  brandWordmark,
  className = "",
  itemClassName = "",
  darkModeIcon = <Sun className="h-4 w-4" />,
  lightModeIcon = <Moon className="h-4 w-4" />,
  renderSubItems,
}) => {
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  // Group items by section
  const groupedItems = useMemo(() => {
    const groups: Record<string, NavigationItem[]> = {
      primary: [],
      study: [],
      explore: [],
    };
    items.forEach((item) => {
      const section = item.section || "primary";
      if (groups[section]) groups[section].push(item);
      else groups[section] = [item];
    });
    return groups;
  }, [items]);

  const handleSelectSection = useCallback(
    (id: SidebarSection) => {
      onSelectSection(id);
      // Clear collection/tag selection when switching away from their sections
      if (id !== "collections" && onSelectCollection) {
        onSelectCollection(null);
      }
      if (id !== "tags" && onSelectTag) {
        onSelectTag(null);
      }
    },
    [onSelectSection, onSelectCollection, onSelectTag]
  );

  const handleSelectCollection = useCallback(
    (id: string | null) => {
      onSelectCollection?.(id);
      if (id) {
        // Optionally navigate to collection view – could trigger a section change
        // but we keep it as is; parent can handle.
      }
    },
    [onSelectCollection]
  );

  const handleSelectTag = useCallback(
    (id: string | null) => {
      onSelectTag?.(id);
    },
    [onSelectTag]
  );

  // Render sub‑items for collections or tags when the section is active
  const renderSubItemsContent = () => {
    if (currentSection === "collections" && collections.length > 0) {
      if (renderSubItems) {
        return renderSubItems({
          type: "collections",
          items: collections,
          selectedId: selectedCollectionId,
          onSelect: handleSelectCollection,
        });
      }
      return (
        <div className="mt-1 ml-7 space-y-0.5">
          {collections.map((coll) => (
            <button
              key={coll.id}
              onClick={() => handleSelectCollection(coll.id)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                selectedCollectionId === coll.id
                  ? "bg-[#D6CEC2] text-[#1C1917] font-medium"
                  : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
              }`}
            >
              {coll.name}
            </button>
          ))}
          <button
            onClick={() => onCreateCollection?.()}
            className="w-full text-left px-2 py-1 text-xs text-[#78716C] hover:text-[#1C1917] flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>New Collection</span>
          </button>
        </div>
      );
    }

    if (currentSection === "tags" && tags.length > 0) {
      if (renderSubItems) {
        return renderSubItems({
          type: "tags",
          items: tags,
          selectedId: selectedTagId,
          onSelect: handleSelectTag,
        });
      }
      return (
        <div className="mt-1 ml-7 space-y-0.5">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleSelectTag(tag.id)}
              className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                selectedTagId === tag.id
                  ? "bg-[#D6CEC2] text-[#1C1917] font-medium"
                  : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderNavItem = (item: NavigationItem) => {
    const Icon = item.icon;
    const isActive = currentSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleSelectSection(item.id as SidebarSection)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${itemClassName} ${
          isActive
            ? "bg-[#E4DED3] text-[#1C1917] font-semibold shadow-xs"
            : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
        }`}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon className={`w-4 h-4 ${isActive ? "text-[#1C1917]" : "text-[#78716C]"}`} />
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <aside
      className={`w-60 border-r border-[#E5DFD3] bg-[#F3EFE6] px-4 py-5 flex flex-col justify-between select-none h-full overflow-y-auto flex-shrink-0 transition-colors dark:border-[#302C27] dark:bg-[#1A1816] ${className}`}
      role="navigation"
      aria-label="Library navigation"
    >
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-2 pt-1 pb-2 flex items-center gap-3">
          {logo ? (
            logo
          ) : (
            <LumaLogo size={32} showWordmark={false} />
          )}
          {brandWordmark ? (
            brandWordmark
          ) : (
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-xl font-black text-[#1C1917] tracking-tight leading-none dark:text-[#F5F1EA]">
                {labels.brandName}
              </h1>
              <p className="text-[9px] font-semibold tracking-[0.2em] text-[#78716C] uppercase mt-0.5 dark:text-[#B8AEA2]">
                {labels.brandSubtitle}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-[#DDD5C7] bg-[#FAF7F2] text-[#57534E] shadow-2xs transition-colors hover:bg-[#FFFFFF] hover:text-[#18181B] dark:border-[#3B3630] dark:bg-[#24211E] dark:text-[#F2C14E] dark:hover:bg-[#2D2925]"
            title={isDarkMode ? labels.darkModeToggleLabel : labels.lightModeToggleLabel}
            aria-label={isDarkMode ? labels.darkModeToggleLabel : labels.lightModeToggleLabel}
            aria-pressed={isDarkMode}
          >
            {isDarkMode ? darkModeIcon : lightModeIcon}
          </button>
        </div>

        {/* Primary Views */}
        {groupedItems.primary && groupedItems.primary.length > 0 && (
          <div className="space-y-1">
            {labels.primarySectionLabel && (
              <div className="px-3 text-[10px] font-semibold text-[#8C8275] uppercase tracking-wider mb-2">
                {labels.primarySectionLabel}
              </div>
            )}
            {groupedItems.primary.map(renderNavItem)}
            {/* Show sub-items if collections or tags are active */}
            {(currentSection === "collections" || currentSection === "tags") && renderSubItemsContent()}
          </div>
        )}

        {/* Deep Study Workspace Section */}
        {groupedItems.study && groupedItems.study.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-semibold text-[#8C8275] uppercase tracking-wider mb-2">
              {labels.studySectionLabel}
            </div>
            {groupedItems.study.map(renderNavItem)}
          </div>
        )}

        {/* Explore Section */}
        {groupedItems.explore && groupedItems.explore.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 text-[10px] font-semibold text-[#8C8275] uppercase tracking-wider mb-2">
              {labels.exploreSectionLabel}
            </div>
            {groupedItems.explore.map(renderNavItem)}
          </div>
        )}
      </div>

      {/* Bottom Actions: Settings & Import Book */}
      <div className="pt-4 border-t border-[#E5DFD3] dark:border-[#302C27] flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-2.5 rounded-lg border border-[#DDD5C7] dark:border-[#38332E] bg-[#FAF7F2] dark:bg-[#24211E] text-[#57534E] dark:text-[#C7BEB2] hover:bg-[#FFFFFF] dark:hover:bg-[#2D2824] hover:text-[#18181B] dark:hover:text-white transition-colors"
          title={labels.settingsTooltip}
          aria-label={labels.settingsTooltip}
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={onImportClick}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-[#18181B] hover:bg-[#27272A] active:bg-[#09090B] text-white text-xs font-medium rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{labels.importButtonLabel}</span>
        </button>
      </div>
    </aside>
  );
};