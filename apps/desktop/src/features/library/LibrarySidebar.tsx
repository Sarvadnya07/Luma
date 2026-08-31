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
} from "lucide-react";
import { Collection, Tag } from "@luma/shared-types";
import { LumaLogo } from "@luma/ui";

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
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  currentSection,
  onSelectSection,
  collections: _collections = [],
  tags: _tags = [],
  selectedCollectionId: _selectedCollectionId,
  selectedTagId: _selectedTagId,
  onSelectCollection,
  onSelectTag,
  onCreateCollection: _onCreateCollection,
  onImportClick,
  isDarkMode = false,
  onToggleDarkMode,
}) => {
  const navItems = [
    { id: "library", label: "Library", icon: Library },
    { id: "all", label: "All Books", icon: BookOpen },
    { id: "reading", label: "Currently Reading", icon: Clock },
    { id: "collections", label: "Collections", icon: Layers },
    { id: "tags", label: "Tags", icon: TagIcon },
  ];

  const studyItems = [
    { id: "atrium", label: "The Atrium", icon: Compass },
    { id: "notes", label: "Notes Workspace", icon: FileText },
    { id: "flashcards", label: "Flashcards", icon: HelpCircle },
    { id: "projects", label: "Research Projects", icon: FolderKanban },
    { id: "history", label: "Reading Intelligence", icon: BarChart2 },
  ];

  const exploreItems = [
    { id: "authors", label: "Authors", icon: Users },
    { id: "series", label: "Series", icon: Bookmark },
    { id: "annotations", label: "Annotations", icon: Edit3 },
    { id: "devices", label: "Devices", icon: Smartphone },
    { id: "plugins", label: "Plugins", icon: Puzzle },
    { id: "archive", label: "Archive", icon: Archive },
    { id: "trash", label: "Trash", icon: Trash2 },
  ];

  return (
    <aside className="w-60 border-r border-[#E5DFD3] bg-[#F3EFE6] px-4 py-5 flex flex-col justify-between select-none h-full overflow-y-auto flex-shrink-0 transition-colors dark:border-[#302C27] dark:bg-[#1A1816]">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="px-2 pt-1 pb-2 flex items-center gap-3">
          <LumaLogo size={32} showWordmark={false} />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-xl font-black text-[#1C1917] tracking-tight leading-none dark:text-[#F5F1EA]">
              Luma
            </h1>
            <p className="text-[9px] font-semibold tracking-[0.2em] text-[#78716C] uppercase mt-0.5 dark:text-[#B8AEA2]">
              Digital Sanctuary
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-[#DDD5C7] bg-[#FAF7F2] text-[#57534E] shadow-2xs transition-colors hover:bg-[#FFFFFF] hover:text-[#18181B] dark:border-[#3B3630] dark:bg-[#24211E] dark:text-[#F2C14E] dark:hover:bg-[#2D2925]"
            title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDarkMode}
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Primary Views */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id as SidebarSection);
                  onSelectCollection?.(null);
                  onSelectTag?.(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#E4DED3] text-[#1C1917] font-semibold shadow-xs"
                    : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#1C1917]" : "text-[#78716C]"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Deep Study Workspace Section */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-semibold text-[#8C8275] uppercase tracking-wider mb-2">
            Deep Study
          </div>
          {studyItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id as SidebarSection);
                  onSelectCollection?.(null);
                  onSelectTag?.(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#E4DED3] text-[#1C1917] font-semibold shadow-xs"
                    : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#1C1917]" : "text-[#78716C]"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Explore Section */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-semibold text-[#8C8275] uppercase tracking-wider mb-2">
            Explore
          </div>
          {exploreItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id as SidebarSection);
                  onSelectCollection?.(null);
                  onSelectTag?.(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#E4DED3] text-[#1C1917] font-semibold shadow-xs"
                    : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#1C1917]" : "text-[#78716C]"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Import Book Action */}
      <div className="pt-4 border-t border-[#E5DFD3]">
        <button
          onClick={onImportClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#18181B] hover:bg-[#27272A] active:bg-[#09090B] text-white text-xs font-medium rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Import Book</span>
        </button>
      </div>
    </aside>
  );
};
