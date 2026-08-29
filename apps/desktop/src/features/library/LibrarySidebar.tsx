import React from "react";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  FolderTree,
  Tag as TagIcon,
  Trash2,
  Library,
} from "lucide-react";
import { Collection, Tag } from "@luma/shared-types";

export type SidebarSection =
  | "all"
  | "reading"
  | "completed"
  | "favorites"
  | "collections"
  | "tags"
  | "trash";

export interface LibrarySidebarProps {
  currentSection: SidebarSection;
  onSelectSection: (section: SidebarSection) => void;
  collections: Collection[];
  tags: Tag[];
  selectedCollectionId?: string | null;
  selectedTagId?: string | null;
  onSelectCollection?: (id: string | null) => void;
  onSelectTag?: (id: string | null) => void;
  onCreateCollection?: () => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  currentSection,
  onSelectSection,
  collections,
  tags,
  selectedCollectionId,
  selectedTagId,
  onSelectCollection,
  onSelectTag,
  onCreateCollection,
}) => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between select-none h-full overflow-y-auto">
      <div className="space-y-6">
        {/* App Branding */}
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Library className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 tracking-tight leading-none">Luma</h2>
            <span className="text-[11px] text-slate-500 font-medium">Digital Library</span>
          </div>
        </div>

        {/* Primary Views */}
        <div className="space-y-1">
          <button
            onClick={() => {
              onSelectSection("all");
              onSelectCollection?.(null);
              onSelectTag?.(null);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentSection === "all" && !selectedCollectionId && !selectedTagId
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>All Books</span>
          </button>

          <button
            onClick={() => onSelectSection("reading")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentSection === "reading"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Currently Reading</span>
          </button>

          <button
            onClick={() => onSelectSection("completed")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              currentSection === "completed"
                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Completed</span>
          </button>
        </div>

        {/* Collections */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <FolderTree className="w-3.5 h-3.5" /> Collections
            </span>
            {onCreateCollection && (
              <button
                onClick={onCreateCollection}
                className="text-sky-400 hover:text-sky-300 transition-colors"
                title="New Collection"
              >
                +
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {collections.length === 0 ? (
              <span className="px-3 text-xs text-slate-600 block">No collections</span>
            ) : (
              collections.map((col) => (
                <button
                  key={col.id}
                  onClick={() => {
                    onSelectSection("collections");
                    onSelectCollection?.(col.id);
                    onSelectTag?.(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    selectedCollectionId === col.id
                      ? "bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <span className="truncate">{col.name}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{col.book_ids.length}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="px-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <TagIcon className="w-3.5 h-3.5" /> Tags
          </div>
          <div className="flex flex-wrap gap-1.5 px-2">
            {tags.length === 0 ? (
              <span className="text-xs text-slate-600">No tags</span>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    onSelectSection("tags");
                    onSelectTag?.(tag.id);
                    onSelectCollection?.(null);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    selectedTagId === tag.id
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-medium"
                      : "bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  #{tag.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Trash */}
      <div className="pt-4 border-t border-slate-800/80">
        <button
          onClick={() => {
            onSelectSection("trash");
            onSelectCollection?.(null);
            onSelectTag?.(null);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentSection === "trash"
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
              : "text-slate-500 hover:text-rose-400 hover:bg-slate-900"
          }`}
        >
          <Trash2 className="w-4 h-4" />
          <span>Trash & Recovery</span>
        </button>
      </div>
    </aside>
  );
};
