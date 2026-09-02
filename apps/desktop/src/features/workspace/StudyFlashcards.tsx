import React, { useState, useEffect, useCallback } from "react";
import { Clock, Sparkles, Plus, RotateCcw, CheckCircle2 } from "lucide-react";

export interface Flashcard {
  id: string;
  deck: string;
  question: string;
  answer: string;
  citation: string;
}

const INITIAL_CARDS: Flashcard[] = [
  {
    id: "card_1",
    deck: "EPISTEMOLOGY & LOGIC",
    question: "What is the 'Problem of Induction' as articulated by David Hume?",
    answer: "Hume argues that inductive reasoning—inferring universal causal laws from past observations—presupposes the principle of the uniformity of nature, which cannot itself be rationally justified through either deductive logic or non-circular empirical observation.",
    citation: "Hume, D. (1748). An Enquiry Concerning Human Understanding, Section IV.",
  },
  {
    id: "card_2",
    deck: "ANCIENT PHILOSOPHY",
    question: "What constitutes the 'Hegemonikon' in Stoic psychological theory?",
    answer: "The commanding faculty or ruling center of the soul, responsible for synthesizing perceptions, generating assent, evaluating impressions, and directing impulse and action.",
    citation: "Marcus Aurelius, Meditations, Book IV; Long & Sedley 53.",
  },
  {
    id: "card_3",
    deck: "PHILOSOPHY OF SCIENCE",
    question: "How does Karl Popper demarcate scientific theories from non-scientific ones?",
    answer: "Through the criterion of falsifiability: a statement or theory is scientific if and only if it is capable of being conflicting with possible, or conceivable, observations.",
    citation: "Popper, K. (1934). The Logic of Scientific Discovery.",
  },
];

export const StudyFlashcards: React.FC = () => {
  const [cards, setCards] = useState<Flashcard[]>(() => {
    const saved = localStorage.getItem("luma_flashcards");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return INITIAL_CARDS;
      }
    }
    return INITIAL_CARDS;
  });

  const [isFlipped, setIsFlipped] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [newCitation, setNewCitation] = useState("");
  const [newDeck, setNewDeck] = useState("GENERAL STUDY");

  useEffect(() => {
    localStorage.setItem("luma_flashcards", JSON.stringify(cards));
  }, [cards]);

  const currentCard = cards[currentCardIndex % (cards.length || 1)] || INITIAL_CARDS[0]!;
  const isSessionComplete = reviewedCount >= cards.length && cards.length > 0;

  const handleNext = useCallback((_grade?: string) => {
    setIsFlipped(false);
    setReviewedCount((r) => r + 1);
    setCurrentCardIndex((i) => (i + 1) % cards.length);
  }, [cards.length]);

  const handleRestart = () => {
    setIsFlipped(false);
    setCurrentCardIndex(0);
    setReviewedCount(0);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    const card: Flashcard = {
      id: `card_${Date.now()}`,
      deck: newDeck.trim().toUpperCase() || "GENERAL STUDY",
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      citation: newCitation.trim() || "User Created Note",
    };
    setCards([...cards, card]);
    setNewQuestion("");
    setNewAnswer("");
    setNewCitation("");
    setIsAddingCard(false);
  };

  // Keyboard shortcut: Space to flip, 1-4 for grading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAddingCard) return;
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((f) => !f);
      } else if (isFlipped && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        handleNext(e.key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, isAddingCard, handleNext]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-14 border-b border-[#E5DFD3] px-8 flex items-center justify-between z-10 flex-shrink-0 bg-[#FAF7F2]">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
            DECK: {currentCard.deck}
          </span>
          <h2 className="font-serif text-sm font-bold text-[#1C1917]">
            Spaced Repetition Review
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs text-[#78716C]">
          <div className="flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Progress: {Math.min(reviewedCount, cards.length)} / {cards.length} Cards</span>
          </div>

          <button
            onClick={() => setIsAddingCard(true)}
            className="p-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded-lg flex items-center gap-1 font-semibold text-xs transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Card</span>
          </button>
        </div>
      </div>

      {/* Main Flashcard Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {isSessionComplete ? (
          <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5DFD3] rounded-3xl p-8 shadow-xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <CheckCircle2 className="w-12 h-12 text-teal-700 mx-auto" />
            <h2 className="font-serif text-xl font-bold text-[#1C1917]">Session Complete!</h2>
            <p className="text-xs text-[#57534E] leading-relaxed">
              You reviewed all {cards.length} cards in this review round.
            </p>
            <button
              onClick={handleRestart}
              className="mt-2 py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 mx-auto transition-colors shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Review Again</span>
            </button>
          </div>
        ) : (
          <>
            <div
              onClick={() => setIsFlipped(!isFlipped)}
              className="w-full max-w-xl aspect-[16/10] bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-3xl p-10 shadow-xl flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-300 hover:shadow-2xl"
            >
              <div className="w-full flex justify-between items-center text-[10px] text-[#78716C] font-mono">
                <span>{isFlipped ? "EXPLANATION / ANSWER" : "QUESTION"}</span>
                <span>CARD {(currentCardIndex % cards.length) + 1} OF {cards.length}</span>
              </div>

              {/* Flashcard Body */}
              <div className="max-w-md my-auto space-y-4">
                {!isFlipped ? (
                  <h1 className="font-serif text-2xl font-bold text-[#1C1917] leading-relaxed">
                    {currentCard.question}
                  </h1>
                ) : (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <p className="font-serif text-sm leading-relaxed text-[#292524]">
                      {currentCard.answer}
                    </p>
                    {currentCard.citation && (
                      <p className="text-[10px] text-[#78716C] font-mono italic">
                        {currentCard.citation}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="text-[11px] text-[#78716C] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8C8275]" />
                <span>{isFlipped ? "Click to flip back (Space)" : "Click to reveal reasoning (Space)"}</span>
              </div>
            </div>

            {/* Spaced Repetition Response Controls */}
            {isFlipped && (
              <div className="flex items-center gap-3 mt-6 animate-in slide-in-from-bottom-2 duration-200">
                <button
                  onClick={() => handleNext("again")}
                  className="py-2 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold shadow-2xs transition-colors"
                >
                  Again (1)
                </button>
                <button
                  onClick={() => handleNext("hard")}
                  className="py-2 px-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold shadow-2xs transition-colors"
                >
                  Hard (2)
                </button>
                <button
                  onClick={() => handleNext("good")}
                  className="py-2 px-4 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition-colors"
                >
                  Good (3)
                </button>
                <button
                  onClick={() => handleNext("easy")}
                  className="py-2 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold shadow-2xs transition-colors"
                >
                  Easy (4)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Card Modal */}
      {isAddingCard && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCard}
            className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4"
          >
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">Create Study Flashcard</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[#78716C] block mb-1">Deck / Subject</label>
                <input
                  type="text"
                  value={newDeck}
                  onChange={(e) => setNewDeck(e.target.value)}
                  placeholder="e.g. PHILOSOPHY, COMPUTER SCIENCE..."
                  className="w-full p-2 bg-white border border-[#DDD5C7] rounded-lg text-xs focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div>
                <label className="font-bold text-[#78716C] block mb-1">Prompt / Question</label>
                <textarea
                  required
                  rows={2}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What is the concept or question?"
                  className="w-full p-2 bg-white border border-[#DDD5C7] rounded-lg text-xs focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div>
                <label className="font-bold text-[#78716C] block mb-1">Explanation / Answer</label>
                <textarea
                  required
                  rows={3}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Key explanation, reasoning, or solution..."
                  className="w-full p-2 bg-white border border-[#DDD5C7] rounded-lg text-xs focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div>
                <label className="font-bold text-[#78716C] block mb-1">Source Citation (Optional)</label>
                <input
                  type="text"
                  value={newCitation}
                  onChange={(e) => setNewCitation(e.target.value)}
                  placeholder="e.g. Author, Title, Chapter"
                  className="w-full p-2 bg-white border border-[#DDD5C7] rounded-lg text-xs focus:outline-none focus:border-[#18181B]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5DFD3]">
              <button
                type="button"
                onClick={() => setIsAddingCard(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#DDD5C7] hover:bg-[#EFEAE1]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-medium rounded-lg"
              >
                Save Card
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
