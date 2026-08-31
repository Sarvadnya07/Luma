import React, { useState } from "react";
import { Clock, RotateCcw, Check, Sparkles } from "lucide-react";

export const StudyFlashcards: React.FC = () => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  const cards = [
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
      answer: "The commanding faculty or ruling center of the soul (located in the heart according to early Stoics), responsible for synthesizing perceptions, generating assent, evaluating impressions, and directing impulse/action.",
      citation: "Marcus Aurelius, Meditations, Book IV; Long & Sedley 53.",
    },
  ];

  const currentCard = cards[currentCardIndex % cards.length];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentCardIndex((i) => (i + 1) % cards.length);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-14 border-b border-[#E5DFD3] px-8 flex items-center justify-between z-10 flex-shrink-0 bg-[#FAF7F2]">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
            DECK: {currentCard.deck}
          </span>
          <h2 className="font-serif text-sm font-bold text-[#1C1917]">
            Session Review
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#78716C] font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>Schedule: {currentCardIndex + 14} / 20 Cards</span>
        </div>
      </div>

      {/* Main Flashcard Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-full max-w-xl aspect-[16/10] bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-3xl p-10 shadow-xl flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-300 hover:shadow-2xl"
        >
          <div className="w-full flex justify-between items-center text-[10px] text-[#78716C] font-mono">
            <span>{isFlipped ? "EXPLANATION / ANSWER" : "QUESTION"}</span>
            <span>CARD {currentCardIndex + 1} OF {cards.length}</span>
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
                <p className="text-[10px] text-[#78716C] font-mono italic">
                  {currentCard.citation}
                </p>
              </div>
            )}
          </div>

          <div className="text-[11px] text-[#78716C] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#8C8275]" />
            <span>{isFlipped ? "Click to see prompt again" : "Tap to reveal reasoning"}</span>
          </div>
        </div>

        {/* Spaced Repetition Response Controls (Shown when card is flipped) */}
        {isFlipped && (
          <div className="flex items-center gap-3 mt-6 animate-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={handleNext}
              className="py-2 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-semibold shadow-2xs transition-colors"
            >
              Again (&lt; 10m)
            </button>
            <button
              onClick={handleNext}
              className="py-2 px-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold shadow-2xs transition-colors"
            >
              Hard (1d)
            </button>
            <button
              onClick={handleNext}
              className="py-2 px-4 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold shadow-2xs transition-colors"
            >
              Good (3d)
            </button>
            <button
              onClick={handleNext}
              className="py-2 px-4 rounded-xl bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors"
            >
              Easy (7d)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
