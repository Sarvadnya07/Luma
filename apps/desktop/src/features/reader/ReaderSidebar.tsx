import React from "react";
import {
  X,
  ListTree,
  Highlighter,
  Bookmark as BookmarkIcon,
  Search,
  Trash2,
  CornerDownRight,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { AnnotationItem } from "@luma/annotation-ui";
import { useReaderStore } from "../../state/readerState";
import { TocItem } from "@luma/shared-types";

export const ReaderSidebar: React.FC = () => {
  const sidebarTab = useReaderStore((s) => s.sidebarTab);
  const setSidebarTab = useReaderStore((s) => s.setSidebarTab);
  const documentData = useReaderStore((s) => s.documentData);
  const currentSpineIndex = useReaderStore((s) => s.currentSpineIndex);
  const annotations = useReaderStore((s) => s.annotations);
  const bookmarks = useReaderStore((s) => s.bookmarks);
  const searchQuery = useReaderStore((s) => s.searchQuery);
  const searchResults = useReaderStore((s) => s.searchResults);
  const searchInDoc = useReaderStore((s) => s.searchInDoc);
  const jumpToLocator = useReaderStore((s) => s.jumpToLocator);
  const loadChapter = useReaderStore((s) => s.loadChapter);
  const deleteAnnotation = useReaderStore((s) => s.deleteAnnotation);
  const deleteBookmark = useReaderStore((s) => s.deleteBookmark);

  if (!sidebarTab) return null;

  const renderTocTree = (items: TocItem[], depth = 0) => {
    return items.map((item, idx) => {
      const isActive = idx === currentSpineIndex;
      return (
        <div key={idx} className="space-y-1">
          <button
            onClick={() => {
              if (item.locator.startsWith("epubcfi") || item.locator.startsWith("page=")) {
                jumpToLocator(item.locator);
              } else {
                loadChapter(idx);
              }
            }}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            className={`w-full text-left py-2 pr-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-between group ${
              isActive
                ? "bg-sky-500/10 text-sky-400 font-semibold"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
            }`}
          >
            <span className="truncate">{item.title}</span>
            {item.play_order && (
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-mono ml-2">
                {item.play_order}
              </span>
            )}
          </button>
          {item.children && item.children.length > 0 && renderTocTree(item.children, depth + 1)}
        </div>
      );
    });
  };

  return (
    <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 flex flex-col z-30 animate-in slide-in-from-left-2 duration-150 flex-shrink-0">
      {/* Tab Switcher Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSidebarTab("toc")}
            className={`p-2 rounded-lg transition-colors ${
              sidebarTab === "toc" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200"
            }`}
            title="Table of Contents"
          >
            <ListTree className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSidebarTab("annotations")}
            className={`p-2 rounded-lg transition-colors relative ${
              sidebarTab === "annotations" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200"
            }`}
            title="Annotations & Highlights"
          >
            <Highlighter className="w-4 h-4" />
            {annotations.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-sky-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setSidebarTab("bookmarks")}
            className={`p-2 rounded-lg transition-colors relative ${
              sidebarTab === "bookmarks" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200"
            }`}
            title="Bookmarks"
          >
            <BookmarkIcon className="w-4 h-4" />
            {bookmarks.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setSidebarTab("search")}
            className={`p-2 rounded-lg transition-colors ${
              sidebarTab === "search" ? "bg-slate-800 text-sky-400" : "text-slate-400 hover:text-slate-200"
            }`}
            title="Search in Document"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={() => setSidebarTab(null)}
          className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Table of Contents Tab */}
        {sidebarTab === "toc" && (
          <div className="space-y-1">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">
              Table of Contents
            </h3>
            {documentData && documentData.toc.length > 0 ? (
              renderTocTree(documentData.toc)
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">No table of contents found.</p>
            )}
          </div>
        )}

        {/* Annotations Tab */}
        {sidebarTab === "annotations" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Annotations ({annotations.length})
              </h3>
            </div>
            {annotations.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                Select text to create highlights and notes.
              </p>
            ) : (
              annotations.map((ann) => (
                <AnnotationItem
                  key={ann.id}
                  annotation={ann}
                  onJumpTo={(a) => {
                    try {
                      const payload = JSON.parse(a.anchor_payload_json);
                      if (payload.spine_index !== undefined) {
                        loadChapter(payload.spine_index);
                      }
                    } catch (e) {
                      console.error("Invalid anchor payload:", e);
                    }
                  }}
                  onDelete={deleteAnnotation}
                />
              ))
            )}
          </div>
        )}

        {/* Bookmarks Tab */}
        {sidebarTab === "bookmarks" && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">
              Bookmarks ({bookmarks.length})
            </h3>
            {bookmarks.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">
                No bookmarks saved yet. Click the bookmark icon or press 'B'.
              </p>
            ) : (
              bookmarks.map((bmk) => (
                <div
                  key={bmk.id}
                  className="group flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-850 hover:border-slate-700 transition-colors"
                >
                  <div
                    onClick={() => jumpToLocator(bmk.locator)}
                    className="cursor-pointer truncate pr-2"
                  >
                    <h4 className="text-xs font-semibold text-slate-200 group-hover:text-sky-400 truncate">
                      {bmk.title || bmk.chapter_title || "Bookmark"}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {new Date(bmk.sync.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => jumpToLocator(bmk.locator)}
                      className="p-1 text-slate-400 hover:text-sky-400 rounded"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBookmark(bmk.id)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Search Tab */}
        {sidebarTab === "search" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => searchInDoc(e.target.value)}
                placeholder="Search across document..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">
                {searchResults.length > 0 ? `Matches (${searchResults.length})` : searchQuery ? "No results" : "Type to search"}
              </span>
              {searchResults.map((match, idx) => (
                <div
                  key={idx}
                  onClick={() => jumpToLocator(match.locator)}
                  className="p-3 bg-slate-950/60 hover:bg-slate-800/60 border border-slate-850 hover:border-slate-700 rounded-xl cursor-pointer transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-sky-400 font-semibold">
                    <span>{match.chapter_title}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {match.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
