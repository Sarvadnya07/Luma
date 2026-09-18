import React, { useCallback, useEffect, useState } from "react";
import { FolderOpen, PlayCircle, CheckCircle2, ArrowRight, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Flashcard, Note, ResearchProject, ResearchQuestion } from "@luma/shared-types";
import { LumaApi } from "../../lib/tauri";

export interface KnowledgeHomeProps {
  onNavigateToNotes?: () => void;
  onNavigateToFlashcards?: () => void;
  onNavigateToProjects?: () => void;
  /** Max rows shown per column. */
  itemLimit?: number;
}

interface AtriumData {
  notes: Note[];
  flashcards: Flashcard[];
  projects: ResearchProject[];
  questions: ResearchQuestion[];
}

const DEFAULT_LIMIT = 4;

/**
 * The Atrium.
 *
 * Every card on this screen is a view over stored knowledge — notes,
 * flashcards and research projects. When the user has none of something, the
 * column says so; it never falls back to example content.
 */
export const KnowledgeHome: React.FC<KnowledgeHomeProps> = ({
  onNavigateToNotes,
  onNavigateToFlashcards,
  onNavigateToProjects,
  itemLimit = DEFAULT_LIMIT,
}) => {
  const [data, setData] = useState<AtriumData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [notes, flashcards, projects] = await Promise.all([
        LumaApi.listNotes(),
        LumaApi.listFlashcards(),
        LumaApi.listResearchProjects(),
      ]);

      // Questions live under a project, so they are read from the most recently
      // updated project only — enough for "open inquiries" without N+1 queries.
      const mostRecent = [...projects].sort((a, b) =>
        (b.updated_at || "").localeCompare(a.updated_at || "")
      )[0];
      const questions = mostRecent ? await LumaApi.listResearchQuestions(mostRecent.id) : [];

      setData({ notes, flashcards, projects, questions });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load knowledge data.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const notes = data?.notes ?? [];
  const flashcards = data?.flashcards ?? [];
  const projects = data?.projects ?? [];
  const questions = data?.questions ?? [];

  const recentNotes = [...notes]
    .sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))
    .slice(0, itemLimit);

  const latestReflection = recentNotes.find((n) => n.content.trim().length > 0) ?? null;

  const decks = Object.entries(
    flashcards.reduce<Record<string, number>>((acc, card) => {
      acc[card.deck_id] = (acc[card.deck_id] ?? 0) + 1;
      return acc;
    }, {})
  );

  const dueCount = flashcards.filter((c) => new Date(c.due_at).getTime() <= Date.now()).length;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6">
      <div className="max-w-5xl mx-auto w-full space-y-8 pb-16">
        {/* Main Heading */}
        <div className="flex items-start justify-between border-b border-[#E5DFD3] pb-6">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
              The Atrium
            </h1>
            <p className="text-xs text-[#78716C] max-w-xl leading-relaxed">
              A view over your own notes, study material and research projects. Nothing here is
              pre-populated — it fills as you work.
            </p>
          </div>
          <button
            onClick={onNavigateToProjects}
            className="text-xs font-semibold text-[#1C1917] hover:underline flex items-center gap-1"
          >
            <span>Open Research</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
            <button onClick={() => void load()} className="underline font-semibold">
              Retry
            </button>
          </div>
        )}

        {data === null && !error && (
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-[#78716C]">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>Loading your knowledge workspace…</span>
          </div>
        )}

        {data !== null && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left 2 Cols: Notes & Projects */}
            <div className="lg:col-span-2 space-y-8">
              <section className="space-y-4">
                <h3 className="font-serif text-base font-bold text-[#1C1917]">Recent Notes</h3>
                {recentNotes.length === 0 ? (
                  <EmptyColumn
                    message="You have no notes yet."
                    hint="Capture a note from the reader or the notes workspace and it will appear here."
                    onAction={onNavigateToNotes}
                    actionLabel="Go to Notes"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {recentNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={onNavigateToNotes}
                        className="text-left bg-[#FFFFFF] border border-[#18181B]/15 dark:border-white/15 hover:border-[#18181B]/30 rounded-2xl p-5 shadow-xs space-y-3 transition-all group"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono">
                          <span className="truncate max-w-[60%]">
                            {note.source_type.toUpperCase()}
                            {note.source_title ? `: ${note.source_title}` : ""}
                          </span>
                          <span>{relativeTime(note.updated_at)}</span>
                        </div>
                        <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black line-clamp-2">
                          {note.title || "Untitled note"}
                        </h4>
                        {note.content && (
                          <p className="text-xs text-[#57534E] leading-relaxed line-clamp-3">
                            {note.content}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <h3 className="font-serif text-base font-bold text-[#1C1917]">
                  Active Enquiries
                </h3>
                {projects.length === 0 ? (
                  <EmptyColumn
                    message="No research projects yet."
                    hint="Create a project to organise questions and evidence."
                    onAction={onNavigateToProjects}
                    actionLabel="Go to Research"
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {projects.slice(0, itemLimit).map((project) => (
                      <button
                        key={project.id}
                        onClick={onNavigateToProjects}
                        className="text-left bg-[#FFFFFF] border border-[#18181B]/15 dark:border-white/15 hover:border-[#18181B]/30 rounded-2xl p-5 shadow-xs space-y-3 transition-all group"
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-teal-800 font-bold uppercase tracking-wider">
                          <FolderOpen className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                          <span>PROJECT</span>
                        </div>
                        <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black line-clamp-2">
                          {project.title}
                        </h4>
                        <p className="text-xs text-[#78716C] line-clamp-3">
                          {project.description || "No abstract recorded."}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                  STUDY QUEUE
                </span>
                {decks.length === 0 ? (
                  <EmptyColumn
                    message="No flashcards yet."
                    hint="Create a card and its deck will show up here."
                    onAction={onNavigateToFlashcards}
                    actionLabel="Go to Study"
                  />
                ) : (
                  <div className="space-y-2">
                    {decks.slice(0, itemLimit).map(([deckId, count]) => (
                      <button
                        key={deckId}
                        onClick={onNavigateToFlashcards}
                        className="w-full text-left p-3 bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl flex items-center justify-between shadow-2xs group"
                      >
                        <div>
                          <h5 className="font-serif text-xs font-bold text-[#1C1917] group-hover:text-black">
                            {deckId}
                          </h5>
                          <p className="text-[10px] text-[#78716C]">
                            {count} card{count === 1 ? "" : "s"}
                            {dueCount > 0 ? ` • ${dueCount} due` : ""}
                          </p>
                        </div>
                        <PlayCircle className="w-4 h-4 text-teal-700" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                  OPEN INQUIRIES
                </span>
                {questions.length === 0 ? (
                  <p className="text-xs text-[#78716C] p-3 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl">
                    No open questions recorded.
                  </p>
                ) : (
                  <div className="space-y-2 text-xs">
                    {questions.slice(0, itemLimit).map((question) => (
                      <div
                        key={question.id}
                        className="p-3 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl space-y-1.5 shadow-2xs"
                      >
                        <p className="text-[#292524] leading-relaxed">{question.question}</p>
                        <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#78716C] border border-[#E5DFD3]">
                          {question.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                  LATEST REFLECTION
                </span>
                {latestReflection ? (
                  <div className="p-4 bg-[#FAF6EE] border border-[#E2D8C3] rounded-xl space-y-2 text-xs">
                    <p className="italic text-[#57534E] leading-relaxed font-serif line-clamp-6">
                      {latestReflection.content}
                    </p>
                    <div className="text-right">
                      <button
                        onClick={onNavigateToNotes}
                        className="text-[10px] font-bold text-[#1C1917] hover:underline inline-flex items-center gap-1 justify-end"
                      >
                        <span>{latestReflection.title || "Open note"}</span>
                        <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#78716C] p-3 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl">
                    No reflections written yet.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyColumn: React.FC<{
  message: string;
  hint: string;
  onAction?: () => void;
  actionLabel?: string;
}> = ({ message, hint, onAction, actionLabel }) => (
  <div className="border border-dashed border-[#DDD5C7] rounded-2xl p-5 bg-[#FFFFFF]/60">
    <p className="text-xs font-semibold text-[#1C1917]">{message}</p>
    <p className="text-[11px] text-[#78716C] mt-1 leading-relaxed">{hint}</p>
    {onAction && actionLabel && (
      <button
        onClick={onAction}
        className="mt-3 text-[11px] font-semibold text-[#1C1917] hover:underline inline-flex items-center gap-1"
      >
        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
        {actionLabel}
      </button>
    )}
  </div>
);

/** Coarse relative time for real timestamps only. */
function relativeTime(iso: string | undefined | null): string {
  if (!iso) return "unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
