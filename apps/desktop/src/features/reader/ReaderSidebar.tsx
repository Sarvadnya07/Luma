import React, { useState } from "react";
import {
  X,
  ListTree,
  Highlighter,
  Bookmark as BookmarkIcon,
  Search,
  Trash2,
  CornerDownRight,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { AnnotationItem } from "@luma/annotation-ui";
import { useReaderStore } from "../../state/readerState";
import { TocItem } from "@luma/shared-types";

export const ReaderSidebar: React.FC = () => {
  const sidebarTab = useReaderStore((s) => s.sidebarTab);
  const setSidebarTab = useReaderStore((s) => s.setSidebarTab);
  const currentBook = useReaderStore((s) => s.currentBook);
  const documentData = useReaderStore((s) => s.documentData);
  const annotations = useReaderStore((s) => s.annotations);
  const bookmarks = useReaderStore((s) => s.bookmarks);
  const searchQuery = useReaderStore((s) => s.searchQuery);
  const searchResults = useReaderStore((s) => s.searchResults);
  const searchInDoc = useReaderStore((s) => s.searchInDoc);
  const jumpToLocator = useReaderStore((s) => s.jumpToLocator);
  const loadChapter = useReaderStore((s) => s.loadChapter);
  const deleteAnnotation = useReaderStore((s) => s.deleteAnnotation);
  const deleteBookmark = useReaderStore((s) => s.deleteBookmark);

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "Book Two": true,
  });
  const [activeSectionId, setActiveSectionId] = useState<string>("Section 3");

  if (!sidebarTab) return null;

  const toggleExpand = (title: string) => {
    setExpandedNodes((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const authorName =
    documentData?.metadata?.authors?.[0] ||
    (currentBook?.id === "book_meditations"
      ? "Marcus Aurelius"
      : currentBook?.id === "book_great_gatsby"
      ? "F. Scott Fitzgerald"
      : "E. M. Forster");

  const renderTocTree = (items: TocItem[], depth = 0) => {
    return items.map((item, idx) => {
      const isExpanded = expandedNodes[item.title] ?? true;
      const hasChildren = item.children && item.children.length > 0;

      return (
        <div key={idx} className="space-y-1">
          <div
            className={`w-full flex items-center justify-between py-1.5 px-3 rounded-lg text-xs font-medium transition-colors group cursor-pointer ${
              !hasChildren && activeSectionId === item.title
                ? "bg-[#E4DED3] text-[#1C1917] font-semibold"
                : "text-[#57534E] hover:bg-[#EBE5DB] hover:text-[#1C1917]"
            }`}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => {
              if (hasChildren) {
                toggleExpand(item.title);
              } else {
                setActiveSectionId(item.title);
                if (item.locator.startsWith("epubcfi") || item.locator.startsWith("page=")) {
                  jumpToLocator(item.locator);
                } else {
                  loadChapter(idx);
                }
              }
            }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate">{item.title}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(item.title);
                  }}
                  className="p-0.5 text-[#78716C]"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : item.play_order ? (
                <span className="text-[11px] text-[#A8A29E] font-serif">
                  {item.play_order}
                </span>
              ) : null}
            </div>
          </div>

          {hasChildren && isExpanded && (
            <div className="space-y-0.5">
              {item.children!.map((child, cIdx) => {
                const isChildActive = activeSectionId === child.title;
                return (
                  <button
                    key={cIdx}
                    onClick={() => {
                      setActiveSectionId(child.title);
                      jumpToLocator(child.locator);
                    }}
                    style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
                    className={`w-full text-left py-1.5 pr-3 rounded-lg text-xs transition-colors flex items-center justify-between ${
                      isChildActive
                        ? "bg-[#E4DED3] text-[#1C1917] font-medium shadow-2xs"
                        : "text-[#57534E] hover:bg-[#EBE5DB] hover:text-[#1C1917]"
                    }`}
                  >
                    <span className="truncate">{child.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <aside className="w-64 h-full bg-[#F3EFE6] border-r border-[#E5DFD3] flex flex-col z-30 animate-in slide-in-from-left duration-150 flex-shrink-0 select-none">
      {/* Table of Contents Header matching Screen 5 */}
      {sidebarTab === "toc" ? (
        <div className="p-4 border-b border-[#E5DFD3]">
          <h3 className="font-serif text-sm font-bold text-[#1C1917]">
            Table of Contents
          </h3>
          <p className="text-[11px] text-[#78716C] truncate mt-0.5">
            {currentBook?.title} - {authorName}
          </p>
        </div>
      ) : (
        /* Tab Switcher Header */
        <div className="flex items-center justify-between border-b border-[#E5DFD3] p-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSidebarTab("toc")}
              className="p-1.5 rounded-lg transition-colors text-[#78716C] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
              title="Table of Contents"
            >
              <ListTree className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSidebarTab("annotations")}
              className={`p-1.5 rounded-lg transition-colors relative ${
                sidebarTab === "annotations"
                  ? "bg-[#E4DED3] text-[#1C1917]"
                  : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
              }`}
              title="Annotations & Highlights"
            >
              <Highlighter className="w-4 h-4" />
              {annotations.length > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-amber-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setSidebarTab("bookmarks")}
              className={`p-1.5 rounded-lg transition-colors relative ${
                sidebarTab === "bookmarks"
                  ? "bg-[#E4DED3] text-[#1C1917]"
                  : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
              }`}
              title="Bookmarks"
            >
              <BookmarkIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSidebarTab("search")}
              className={`p-1.5 rounded-lg transition-colors ${
                sidebarTab === "search"
                  ? "bg-[#E4DED3] text-[#1C1917]"
                  : "text-[#78716C] hover:text-[#1C1917] hover:bg-[#EBE5DB]"
              }`}
              title="Search in Document"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setSidebarTab(null)}
            className="p-1.5 text-[#78716C] hover:text-[#1C1917] rounded-lg hover:bg-[#EBE5DB]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Table of Contents Tab */}
        {sidebarTab === "toc" && (
          <div className="space-y-1">
            {documentData && documentData.toc.length > 0 ? (
              renderTocTree(documentData.toc)
            ) : (
              <p className="text-xs text-[#78716C] text-center py-8">No chapters found.</p>
            )}
          </div>
        )}

        {/* Annotations Tab */}
        {sidebarTab === "annotations" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 py-1">
              <h4 className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider">
                Annotations ({annotations.length})
              </h4>
            </div>
            {annotations.length === 0 ? (
              <p className="text-xs text-[#78716C] text-center py-8">
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
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider px-1 py-1">
              Bookmarks ({bookmarks.length})
            </h4>
            {bookmarks.length === 0 ? (
              <p className="text-xs text-[#78716C] text-center py-8">
                No bookmarks saved yet. Click the bookmark icon or press 'B'.
              </p>
            ) : (
              bookmarks.map((bmk) => (
                <div
                  key={bmk.id}
                  className="group flex items-center justify-between p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] transition-colors"
                >
                  <div
                    onClick={() => jumpToLocator(bmk.locator)}
                    className="cursor-pointer truncate pr-2"
                  >
                    <h5 className="text-xs font-semibold text-[#1C1917] truncate">
                      {bmk.title || bmk.chapter_title || "Bookmark"}
                    </h5>
                    <span className="text-[10px] text-[#78716C]">
                      {new Date(bmk.sync.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => jumpToLocator(bmk.locator)}
                      className="p-1 text-[#78716C] hover:text-[#18181B] rounded"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteBookmark(bmk.id)}
                      className="p-1 text-[#78716C] hover:text-rose-600 rounded"
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
              <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-3 top-2.5" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => searchInDoc(e.target.value)}
                placeholder="Search across document..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#FFFFFF] border border-[#E5DFD3] rounded-lg text-xs text-[#1C1917] placeholder-[#78716C] focus:outline-none focus:border-[#18181B]"
              />
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block px-1">
                {searchResults.length > 0 ? `Matches (${searchResults.length})` : searchQuery ? "No results" : "Type to search"}
              </span>
              {searchResults.map((match, idx) => (
                <div
                  key={idx}
                  onClick={() => jumpToLocator(match.locator)}
                  className="p-2.5 bg-[#FFFFFF] hover:bg-[#FAF7F2] border border-[#E5DFD3] rounded-lg cursor-pointer transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#18181B] font-semibold">
                    <span>{match.chapter_title}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                  <p className="text-xs text-[#57534E] line-clamp-2 leading-relaxed">
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

