import React, { useState, useEffect } from "react";
import {
  Share2,
  Plus,
  Trash2,
  BookOpen,
  Search,
  Check,
} from "lucide-react";

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

const INITIAL_NOTES: NoteItem[] = [
  {
    id: "note_1",
    sourceType: "Book",
    sourceTitle: "Meditations",
    timeAgo: "2h ago",
    title: "On the nature of rational soul",
    preview: "The properties of the rational soul: it looks on itself, it shapes itself...",
    content: `Marcus Aurelius defines the rational soul by its capacity for self-reflection and self-determination. Unlike physical objects or even lesser forms of life, the rational soul "looks on itself, it shapes itself."

This suggests a radical autonomy of the intellect. The mind is not merely a passive recipient of impressions, but an active architect of its own character. This relates closely to his recurring theme of the 'inner citadel' — the part of us that remains free regardless of external circumstances.

Need to cross-reference this with Epictetus's concept of prohairesis (moral purpose/choice) in the Discourses.`,
    quote: "The properties of the rational soul: it looks on itself, it shapes itself, it renders itself whatever it wishes to be; it gathers for itself the fruit which it bears...",
    bookId: "book_meditations",
  },
  {
    id: "note_2",
    sourceType: "Article",
    sourceTitle: "Tractatus Logico-Philosophicus",
    timeAgo: "10:30 AM",
    title: "Logical Space and Truth",
    preview: "The world is determined by the facts, and by these being all the facts...",
    content: `Wittgenstein's Tractatus lays out the architecture of logical atomism. Facts exist in logical space as configurations of objects.

A proposition is a picture of reality. To understand a proposition means to know what is the case if it is true.

The limits of my language mean the limits of my world.`,
    quote: "The world is determined by the facts, and by these being all the facts.",
    bookId: "book_phenomenology",
  },
  {
    id: "note_3",
    sourceType: "Book",
    sourceTitle: "The Republic",
    timeAgo: "Nov 14",
    title: "The Allegory of the Cave",
    preview: "Compare our natural condition, so far as education and ignorance are concerned...",
    content: `Plato's subterranean cavern is a model for epistemic confinement. Shadows cast on the cave wall are treated as primary reality until ascent towards the sun occurs.

The philosopher's duty is not merely contemplation of the Good, but descent back into the cave to guide those still chained.`,
    quote: "Compare our natural condition, so far as education and ignorance are concerned, to a state of things like the...",
    bookId: "book_republic",
  },
];

export const NotesWorkspace: React.FC = () => {
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const saved = localStorage.getItem("luma_notes_workspace");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_NOTES;
      }
    }
    return INITIAL_NOTES;
  });

  const [selectedNoteId, setSelectedNoteId] = useState<string>(notes[0]?.id || "note_1");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCitation, setCopiedCitation] = useState(false);

  useEffect(() => {
    localStorage.setItem("luma_notes_workspace", JSON.stringify(notes));
  }, [notes]);

  const activeNote = notes.find((n) => n.id === selectedNoteId) || notes[0];

  const handleUpdateActiveNote = (updates: Partial<NoteItem>) => {
    if (!activeNote) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === activeNote.id) {
          const updated = { ...n, ...updates };
          if (updates.content) {
            updated.preview = updates.content.slice(0, 100).replace(/\n/g, " ") + "...";
          }
          return updated;
        }
        return n;
      })
    );
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
  };

  const handleDeleteActiveNote = () => {
    if (!activeNote) return;
    const remaining = notes.filter((n) => n.id !== activeNote.id);
    setNotes(remaining);
    if (remaining.length > 0) {
      setSelectedNoteId(remaining[0]!.id);
    }
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
        <div className="p-3 border-b border-[#EFEAE1]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#78716C] absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes & sources..."
              className="w-full pl-8 pr-3 py-1 bg-white border border-[#E5DFD3] rounded-lg text-xs placeholder:text-[#A8A29E] focus:outline-none focus:border-[#18181B]"
            />
          </div>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#EFEAE1]">
          {filteredNotes.map((note) => {
            const isSelected = note.id === (activeNote?.id || "");
            return (
              <div
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected ? "bg-[#FFFFFF] shadow-2xs border-l-2 border-stone-800" : "hover:bg-[#F5EFE6]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-[#78716C] mb-1 font-mono">
                  <span className="truncate max-w-[150px]">{note.sourceType}: {note.sourceTitle}</span>
                  <span>{note.timeAgo}</span>
                </div>
                <h4 className="font-serif text-xs font-bold text-[#1C1917] mb-1 truncate">
                  {note.title || "Untitled Note"}
                </h4>
                <p className="text-[11px] text-[#57534E] line-clamp-2 leading-relaxed">
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
        <div className="flex-1 flex items-center justify-center text-xs text-[#78716C]">
          Select or create a note to begin.
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
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-3 space-y-3 shadow-2xs">
              <div className="aspect-[4/3] bg-[#EAE4DA] rounded-lg overflow-hidden border border-[#DDD5C7] flex items-center justify-center p-3 text-center">
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
