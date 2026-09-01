import React, { useState, useCallback, useEffect, useRef } from "react";
import { CheckCircle2, HelpCircle, Search, Edit3, X, ExternalLink, ArrowRight } from "lucide-react";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface CandidateMatch {
  id: string;
  confidence: "high" | "medium" | "low"; // or use a numeric score
  location: string; // e.g., "Book 4, Section 3"
  surroundingTextBefore?: string;
  matchedQuote: string;
  surroundingTextAfter?: string;
  // Optional extra metadata
}

export interface RepairWorkflowData {
  bookTitle: string;
  originalPassage: string; // full text around the highlight
  highlightedQuote: string; // the exact highlighted text
  note: {
    text: string;
    createdAt: string; // ISO date string
  };
  candidates: CandidateMatch[];
  learnMoreUrl?: string; // if provided, show the "Learn More" link
}

export interface AnnotationRepairWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  data: RepairWorkflowData; // now required – no hardcoded content
  onAcceptCandidate?: (candidateId: string) => void;
  onFindManually?: () => void;
}

// ------------------------------------------------------------------
// Sub‑component: CandidateCard
// ------------------------------------------------------------------

interface CandidateCardProps {
  candidate: CandidateMatch;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAccept: (id: string) => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({
  candidate,
  isSelected,
  onSelect,
  onAccept,
}) => {
  const confidenceConfig = {
    high: { icon: CheckCircle2, label: "High Confidence", color: "teal" },
    medium: { icon: HelpCircle, label: "Medium Confidence", color: "amber" },
    low: { icon: HelpCircle, label: "Low Confidence", color: "gray" },
  }[candidate.confidence] || { icon: HelpCircle, label: "Unknown", color: "gray" };

  const Icon = confidenceConfig.icon;
  const colorClass = {
    teal: "border-teal-600 ring-teal-600/20 text-teal-800 bg-teal-50 border-teal-200 text-teal-950",
    amber: "border-amber-600 ring-amber-600/20 text-amber-800 bg-amber-50 border-amber-200 text-amber-950",
    gray: "border-gray-400 ring-gray-400/20 text-gray-700 bg-gray-50 border-gray-200 text-gray-800",
  }[confidenceConfig.color] || "border-gray-400 ring-gray-400/20 text-gray-700 bg-gray-50 border-gray-200 text-gray-800";

  return (
    <div
      onClick={() => onSelect(candidate.id)}
      className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
        isSelected
          ? `bg-white border-${confidenceConfig.color}-600 ring-2 ring-${confidenceConfig.color}-600/20 shadow-sm`
          : "bg-white border-[#E5DFD3] hover:border-[#DDD5C7]"
      }`}
    >
      <div className="flex items-center justify-between text-xs">
        <div className={`flex items-center gap-1.5 font-bold text-[11px] tracking-wider uppercase ${colorClass.split(" ").find(c => c.startsWith("text-")) || "text-gray-800"}`}>
          <Icon className={`w-4 h-4 ${colorClass.split(" ").find(c => c.startsWith("text-")) || "text-gray-700"}`} />
          <span>{confidenceConfig.label}</span>
        </div>
        <span className="text-[11px] text-[#78716C] font-mono">{candidate.location}</span>
      </div>

      <div className="text-xs leading-relaxed text-[#57534E] space-y-2">
        {candidate.surroundingTextBefore && <p>{candidate.surroundingTextBefore}</p>}
        <div className={`p-2.5 rounded-xl font-serif font-bold text-sm leading-snug border ${colorClass.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-")).join(" ")}`}>
          {candidate.matchedQuote}
        </div>
        {candidate.surroundingTextAfter && <p>{candidate.surroundingTextAfter}</p>}
      </div>

      {isSelected && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept(candidate.id);
            }}
            className="py-1.5 px-3.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <span>Accept Re‑Anchor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Main Component
// ------------------------------------------------------------------

export const AnnotationRepairWorkflow: React.FC<AnnotationRepairWorkflowProps> = ({
  isOpen,
  onClose,
  data,
  onAcceptCandidate,
  onFindManually,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    data.candidates?.[0]?.id ?? null
  );
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus management: when opened, move focus to the modal container.
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  const handleAccept = useCallback(
    (candidateId: string) => {
      onAcceptCandidate?.(candidateId);
      onClose();
    },
    [onAcceptCandidate, onClose]
  );

  const handleManualFind = useCallback(() => {
    onFindManually?.();
    onClose();
  }, [onFindManually, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#FAF7F2] text-[#1C1917] overflow-y-auto flex flex-col animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repair-title"
      ref={modalRef}
      tabIndex={-1}
    >
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#E5DFD3] bg-[#FAF7F2] px-8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#78716C] hover:text-[#18181B] flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-[#EFEAE1] transition-colors"
            aria-label="Close workflow"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
          <div className="h-4 w-[1px] bg-[#E5DFD3]" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] mr-2">
              RE‑ANCHORING ANNOTATION
            </span>
            <span className="font-serif text-xs font-bold text-[#1C1917]">
              {data.bookTitle}
            </span>
          </div>
        </div>

        {data.learnMoreUrl && (
          <a
            href={data.learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#78716C] hover:text-[#18181B] flex items-center gap-1 transition-colors"
          >
            <span>Learn More about Anchor System</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </header>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto w-full px-8 py-8 flex-1 space-y-8">
        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h1 id="repair-title" className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
            Content changes detected
          </h1>
          <p className="text-xs text-[#78716C] leading-relaxed max-w-2xl">
            The publisher has updated the text of this document. We need your help to find the new location for one of your highlights.
          </p>
        </div>

        {/* 2‑Column Comparison Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Original Passage */}
          <div className="space-y-4">
            <h3 className="font-serif text-sm font-bold text-[#1C1917]">
              Original Passage
            </h3>

            <div className="bg-white border border-[#E5DFD3] rounded-2xl p-6 shadow-2xs space-y-4 text-xs leading-relaxed text-[#57534E]">
              <p>{data.originalPassage}</p>
              <div className="bg-rose-50/80 border border-rose-200 text-rose-950 p-2.5 rounded-xl font-serif font-bold text-sm leading-snug">
                {data.highlightedQuote}
              </div>
            </div>

            {/* Attached Note */}
            <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                <Edit3 className="w-3.5 h-3.5 text-[#8C8275]" />
                <span className="font-semibold text-[#1C1917]">Your Note</span>
                <span>• {new Date(data.note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">{data.note.text}</p>
            </div>
          </div>

          {/* Right Column: Candidate Matches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-sm font-bold text-[#1C1917]">
                Candidate Matches
              </h3>
              <span className="text-[11px] text-[#78716C] font-mono">
                {data.candidates.length} found in new text
              </span>
            </div>

            <div className="space-y-4">
              {data.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isSelected={selectedCandidate === candidate.id}
                  onSelect={setSelectedCandidate}
                  onAccept={handleAccept}
                />
              ))}

              {/* Manual Search Button */}
              <button
                onClick={handleManualFind}
                className="w-full p-4 rounded-2xl border border-dashed border-[#DDD5C7] hover:border-[#18181B] bg-[#FAF7F2] hover:bg-white transition-all flex flex-col items-center justify-center gap-1 text-center group cursor-pointer"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#1C1917] group-hover:text-black">
                  <Search className="w-4 h-4 text-[#78716C] group-hover:text-[#1C1917]" />
                  <span>Find Manually in Document</span>
                </div>
                <p className="text-[11px] text-[#78716C]">
                  Opens the book at the approximate original location.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};