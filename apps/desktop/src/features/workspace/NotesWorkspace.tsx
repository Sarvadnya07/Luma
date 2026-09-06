import React, { useState, useEffect } from "react";
import {
  Share2,
  Plus,
  Trash2,
  BookOpen,
  Search,
  Check,
} from "lucide-react";
import { LumaApi } from "../../lib/tauri";

export interface NoteItem {
  id: string;
  sourceType: string;
  sourceTitle: string;
  timeAgo: string;
  title: string;
  preview: string;
  content: string;
  quote?: string;
  bookId?: string;
}

export const NotesWorkspace: React.FC = () => {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCitation, setCopiedCitation] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadNotes() {
      try {
        await LumaApi.migrateLegacyKnowledge();
        const fetched = await LumaApi.listNotes();
        if (mounted) {
          const items: NoteItem[] = fetched.map((n) => ({
            id: n.id,
            sourceType: n.source_type,
            sourceTitle: n.source_title,
            timeAgo: "Saved",
            title: n.title,
            preview: n.content.slice(0, 100).replace(/\n/g, " ") + (n.content.length > 100 ? "..." : ""),
            content: n.content,
            quote: n.quote || undefined,
            bookId: n.book_id || undefined,
          }));
          setNotes(items);
          if (items.length > 0) {
            setSelectedNoteId((curr) => (curr && items.some((i) => i.id === curr) ? curr : items[0]!.id));
          } else {
            setSelectedNoteId("");
          }
        }
      } catch (err) {
        console.error("Failed to load notes from SQLite:", err);
      }
    }
    loadNotes();
    return () => {
      mounted = false;
    };
  }, []);

  const activeNote = notes.find((n) => n.id === selectedNoteId);

  const handleUpdateActiveNote = (updates: Partial<NoteItem>) => {
    if (!activeNote) return;
    const updatedNote = { ...activeNote, ...updates };
    if (updates.content !== undefined) {
      updatedNote.preview = updates.content.slice(0, 100).replace(/\n/g, " ") + (updates.content.length > 100 ? "..." : "");
    }

    setNotes((prev) => prev.map((n) => (n.id === activeNote.id ? updatedNote : n)));

    // Persist to SQLite
    LumaApi.updateNote({
      id: updatedNote.id,
      book_id: updatedNote.bookId || null,
      annotation_id: null,
      source_type: updatedNote.sourceType,
      source_title: updatedNote.sourceTitle,
      title: updatedNote.title,
      content: updatedNote.content,
      quote: updatedNote.quote || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    }).catch((e) => console.error("Failed to persist note update:", e));
  };

  const handleCreateNote = () => {
    const newNote: NoteItem = {
      id: `note_${Date.now()}`,
      sourceType: "Research",
      sourceTitle: "Personal Synthesis",
      timeAgo: "Just now",
      title: "Untitled Study Note",
      preview: "Start writing thoughts, synthesis, and connected citations...",
      content: "",
      quote: undefined,
    };
    setNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);

    LumaApi.createNote({
      id: newNote.id,
      book_id: null,
      annotation_id: null,
      source_type: newNote.sourceType,
      source_title: newNote.sourceTitle,
      title: newNote.title,
      content: newNote.content,
      quote: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    }).catch((e) => console.error("Failed to create note in SQLite:", e));
  };

  const handleDeleteActiveNote = () => {
    if (!activeNote) return;
    const noteId = activeNote.id;
    const remaining = notes.filter((n) => n.id !== noteId);
    setNotes(remaining);
    if (remaining.length > 0) {
      setSelectedNoteId(remaining[0]!.id);
    }
    LumaApi.deleteNote(noteId).catch((e) => console.error("Failed to delete note from SQLite:", e));
  };

  const handleFormatCitation = () => {
    if (!activeNote) return;
    const citation = `${activeNote.sourceTitle} — "${activeNote.title}"\n${activeNote.quote ? `Quote: "${activeNote.quote}"\n` : ""}\nNotes:\n${activeNote.content}`;
    navigator.clipboard.writeText(citation).then(() => {
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    });
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.sourceTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex h-full bg-[#FAF7F2] text-[#1C1917] overflow-hidden">
      {/* Left Column: Recent Notes Sidebar */}
      <div className="w-80 border-r border-[#E5DFD3] bg-[#FAF7F2] flex flex-col flex-shrink-0 select-none">
        {/* Header */}
        <div className="p-4 border-b border-[#E5DFD3] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif text-sm font-bold text-[#1C1917]">Notes Workspace</span>
            <span className="text-[10px] bg-[#EFEAE1] px-1.5 py-0.5 rounded font-mono font-bold text-[#78716C]">
              {notes.length}
            </span>
          </div>
          <button
            onClick={handleCreateNote}
            className="p-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded-lg flex items-center gap-1 text-xs font-semibold shadow-2xs transition-colors"
            title="Create New Note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Search Notes */}
        <div className="p-3 border-b border-[#EFEAE1] dark:border-[#38332B]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes & sources..."
              className="w-full pl-8 pr-3 py-1 bg-white dark:bg-[#27231E] border border-[#18181B]/20 dark:border-white/15 rounded-lg text-xs placeholder:text-[#A8A29E] focus:outline-none focus:border-[#18181B] shadow-2xs"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#EFEAE1] dark:divide-[#38332B]">
          {filteredNotes.map((note) => {
            const isSelected = note.id === (activeNote?.id || "");
            return (
              <div
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[#FFFFFF] dark:bg-[#27231E] shadow-sm border-l-2 border-stone-800 dark:border-stone-200 border-y border-y-[#18181B]/10 dark:border-y-white/10"
                    : "hover:bg-[#F5EFE6] dark:hover:bg-[#2C2722]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-[#78716C] mb-1 font-mono">
                  <span className="truncate max-w-[150px]">{note.sourceType}: {note.sourceTitle}</span>
                  <span>{note.timeAgo}</span>
                </div>
                <h4 className="font-serif text-xs font-bold text-[#1C1917] dark:text-[#EAE5DC] mb-1 truncate">
                  {note.title || "Untitled Note"}
                </h4>
                <p className="text-[11px] text-[#57534E] dark:text-[#B5ADA3] line-clamp-2 leading-relaxed">
                  {note.preview || "No content yet..."}
                </p>
              </div>
            );
          })}
          {filteredNotes.length === 0 && (
            <div className="p-6 text-center text-xs text-[#78716C]">
              No matching notes found.
            </div>
          )}
        </div>
      </div>

      {/* Center Column: Note Editor */}
      {activeNote ? (
        <div className="flex-1 flex flex-col bg-[#FFFFFF] overflow-y-auto border-r border-[#E5DFD3]">
          {/* Formatting & Action Toolbar */}
          <div className="h-12 border-b border-[#E5DFD3] px-6 flex items-center justify-between text-[#78716C] z-10 flex-shrink-0 bg-[#FFFFFF]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#78716C]">
                {activeNote.sourceType} • {activeNote.sourceTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteActiveNote}
                className="p-1.5 text-[#78716C] hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Delete Note"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Note Body Editor */}
          <div className="max-w-2xl mx-auto w-full px-8 py-8 space-y-6 flex-1 flex flex-col">
            <input
              type="text"
              value={activeNote.title}
              onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
              placeholder="Note title..."
              className="font-serif text-2xl font-bold text-[#1C1917] leading-tight border-none outline-none w-full bg-transparent placeholder:text-[#A8A29E]"
            />

            {activeNote.quote && (
              <blockquote className="my-2 pl-4 border-l-2 border-[#D6CEC2] italic text-[#57534E] font-serif text-xs bg-[#FAF7F2] p-3 rounded-r-lg">
                "{activeNote.quote}"
              </blockquote>
            )}

            <textarea
              value={activeNote.content}
              onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
              placeholder="Write your reflection, notes, cross-references, or syntheses here..."
              rows={16}
              className="w-full flex-1 resize-none border-none outline-none font-serif text-xs leading-relaxed text-[#292524] placeholder:text-[#A8A29E] bg-transparent"
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[#78716C] bg-[#FAF7F2]">
          <BookOpen className="w-10 h-10 text-[#A8A29E] mb-3" />
          <h3 className="font-serif text-base font-bold text-[#1C1917]">No note selected</h3>
          <p className="text-xs text-[#78716C] max-w-sm mt-1 mb-4">
            Select a note from the list or create a new note to start capturing your thoughts and citations.
          </p>
          <button
            onClick={handleCreateNote}
            className="py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Note</span>
          </button>
        </div>
      )}

      {/* Right Column: Connected Source & Citation */}
      {activeNote && (
        <aside className="w-72 border-l border-[#E5DFD3] bg-[#FAF7F2] p-5 flex flex-col justify-between flex-shrink-0 select-none overflow-y-auto">
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
              CONNECTED SOURCE
            </span>

            {/* Book Card Preview */}
            <div className="bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-xl p-3 space-y-3 shadow-sm">
              <div className="aspect-[4/3] bg-[#EAE4DA] dark:bg-[#1E1B18] rounded-lg overflow-hidden border border-[#18181B]/15 dark:border-white/10 flex items-center justify-center p-3 text-center shadow-inner">
                <BookOpen className="w-5 h-5 text-[#8C8275] mb-1" />
              </div>

              <div className="space-y-1">
                <h5 className="font-serif text-xs font-bold text-[#1C1917] truncate">
                  {activeNote.sourceTitle}
                </h5>
                <p className="text-[10px] text-[#78716C]">
                  {activeNote.sourceType} Reference
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-[#E5DFD3]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] block">
                SOURCE METADATA
              </span>
              <div className="text-[11px] text-[#57534E] space-y-1 font-mono">
                <div>Source: {activeNote.sourceType}</div>
                <div>Created: {activeNote.timeAgo}</div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleFormatCitation}
            className="w-full py-2 px-3 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
          >
            {copiedCitation ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Citation Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Copy Formatted Citation</span>
              </>
            )}
          </button>
        </aside>
      )}
    </div>
  );
};
