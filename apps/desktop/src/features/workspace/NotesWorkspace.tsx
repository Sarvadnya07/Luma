import React, { useState } from "react";
import {
  Bold,
  Italic,
  List,
  Quote,
  Filter,
  Share2,
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

export const NotesWorkspace: React.FC = () => {
  const [selectedNoteId, setSelectedNoteId] = useState<string>("note_1");

  const notes: NoteItem[] = [
    {
      id: "note_1",
      sourceType: "Book",
      sourceTitle: "Meditations",
      timeAgo: "2h ago",
      title: "On the nature of rational soul",
      preview: "The properties of the rational soul: it looks on itself, it shapes itself, it renders itself whatever it wishes to be...",
      content: `Marcus Aurelius defines the rational soul by its capacity for self-reflection and self-determination. Unlike physical objects or even lesser forms of life, the rational soul "looks on itself, it shapes itself."

This suggests a radical autonomy of the intellect. The mind is not merely a passive recipient of impressions, but an active architect of its own character. This relates closely to his recurring theme of the 'inner citadel' — the part of us that remains free regardless of external circumstances.

Need to cross-reference this with Epictetus's concept of prohairesis (moral purpose/choice) in the Discourses.`,
      quote: "The properties of the rational soul: it looks on itself, it shapes itself, it renders itself whatever it wishes to be; it gathers for itself the fruit which it bears...",
      bookId: "book_meditations",
    },
    {
      id: "note_2",
      sourceType: "Article",
      sourceTitle: "Phenomenology",
      timeAgo: "10:30 AM",
      title: "Logical Space and Truth",
      preview: "The world is determined by the facts, and by these being all the facts. For the totality of facts determines both...",
      content: "Wittgenstein's Tractatus lays out the architecture of logical atomism. Facts exist in logical space as configurations of objects.",
      quote: "The world is determined by the facts, and by these being all the facts.",
      bookId: "book_phenomenology",
    },
    {
      id: "note_3",
      sourceType: "Book",
      sourceTitle: "Republic",
      timeAgo: "Nov 14",
      title: "The Allegory of the Cave",
      preview: "Compare our natural condition, so far as education and ignorance are concerned, to a state of things like the...",
      content: "Plato's subterranean cavern is a model for epistemic confinement. Shadows cast on the cave wall are treated as primary reality until ascent towards the sun occurs.",
      quote: "Compare our natural condition, so far as education and ignorance are concerned, to a state of things like the...",
      bookId: "book_republic",
    },
  ];

  const activeNote = notes.find((n) => n.id === selectedNoteId) || notes[0]!;

  return (
    <div className="flex-1 flex h-full bg-[#FAF7F2] text-[#1C1917] overflow-hidden">
      {/* Middle-Left: Recent Notes Sidebar */}
      <div className="w-80 border-r border-[#E5DFD3] bg-[#FAF7F2] flex flex-col flex-shrink-0 select-none">
        {/* Header */}
        <div className="p-4 border-b border-[#E5DFD3] flex items-center justify-between">
          <span className="font-serif text-sm font-bold text-[#1C1917]">Recent Notes</span>
          <button className="p-1 hover:text-[#18181B] text-[#78716C] rounded hover:bg-[#EFEAE1]">
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Note List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#EFEAE1]">
          {notes.map((note) => {
            const isSelected = note.id === selectedNoteId;
            return (
              <div
                key={note.id}
                onClick={() => setSelectedNoteId(note.id)}
                className={`p-4 cursor-pointer transition-all ${
                  isSelected ? "bg-[#FFFFFF] shadow-2xs" : "hover:bg-[#F5EFE6]"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] text-[#78716C] mb-1 font-mono">
                  <span>{note.sourceType}: {note.sourceTitle}</span>
                  <span>{note.timeAgo}</span>
                </div>
                <h4 className="font-serif text-xs font-bold text-[#1C1917] mb-1">
                  {note.title}
                </h4>
                <p className="text-[11px] text-[#57534E] line-clamp-2 leading-relaxed">
                  {note.preview}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center: Note Editor */}
      <div className="flex-1 flex flex-col bg-[#FFFFFF] overflow-y-auto border-r border-[#E5DFD3]">
        {/* Formatting Toolbar */}
        <div className="h-12 border-b border-[#E5DFD3] px-6 flex items-center gap-2 text-[#78716C] z-10 flex-shrink-0 bg-[#FFFFFF]">
          <button className="p-1.5 hover:text-[#18181B] hover:bg-[#FAF7F2] rounded">
            <Bold className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] hover:bg-[#FAF7F2] rounded">
            <Italic className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] hover:bg-[#FAF7F2] rounded">
            <List className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] hover:bg-[#FAF7F2] rounded">
            <Quote className="w-4 h-4" />
          </button>
        </div>

        {/* Note Body */}
        <div className="max-w-2xl mx-auto w-full px-8 py-8 space-y-6">
          <h1 className="font-serif text-2xl font-bold text-[#1C1917] leading-tight">
            {activeNote.title}
          </h1>

          <div className="prose-reader text-xs leading-relaxed text-[#292524] space-y-4">
            <p>
              Marcus Aurelius defines the rational soul by its capacity for self-reflection and self-determination. Unlike physical objects or even lesser forms of life, the rational soul "looks on itself, it shapes itself."
            </p>

            {activeNote.quote && (
              <blockquote className="my-4 pl-4 border-l-2 border-[#D6CEC2] italic text-[#57534E] font-serif text-xs">
                "{activeNote.quote}"
              </blockquote>
            )}

            <p>
              This suggests a radical autonomy of the intellect. The mind is not merely a passive recipient of impressions, but an active architect of its own character. This relates closely to his recurring theme of the 'inner citadel' — the part of us that remains free regardless of external circumstances.
            </p>

            <p>
              Need to cross-reference this with Epictetus's concept of <span className="font-semibold text-[#18181B]">prohairesis</span> (moral purpose/choice) in the Discourses.
            </p>
          </div>
        </div>
      </div>

      {/* Far-Right: Context & Connected Citations */}
      <aside className="w-72 border-l border-[#E5DFD3] bg-[#FAF7F2] p-5 flex flex-col justify-between flex-shrink-0 select-none overflow-y-auto">
        <div className="space-y-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
            CONNECTED CITATION
          </span>

          {/* Book Card Preview */}
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl p-3 space-y-3 shadow-2xs">
            <div className="aspect-[4/3] bg-[#EAE4DA] rounded-lg overflow-hidden border border-[#DDD5C7] flex items-center justify-center p-3 text-center">
              <span className="font-serif italic text-xs text-[#8C8275]">
                Marcus Aurelius, Meditations, Book XI
              </span>
            </div>

            <div className="space-y-1">
              <h5 className="font-serif text-xs font-bold text-[#1C1917]">
                Meditations, Book XI, 1
              </h5>
              <p className="text-[10px] text-[#78716C]">
                Standard Loeb Classical Library Edition
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full py-2 px-3 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors">
          <Share2 className="w-3.5 h-3.5" />
          <span>Format Citation</span>
        </button>
      </aside>
    </div>
  );
};
