import React, { useState } from "react";
import { CheckCircle2, HelpCircle, Search, Edit3, X, ExternalLink, ArrowRight } from "lucide-react";

export interface AnnotationRepairWorkflowProps {
  isOpen: boolean;
  onClose: () => void;
  onAcceptCandidate?: (candidateId: string) => void;
  onFindManually?: () => void;
}

export const AnnotationRepairWorkflow: React.FC<AnnotationRepairWorkflowProps> = ({
  isOpen,
  onClose,
  onAcceptCandidate,
  onFindManually,
}) => {
  const [selectedCandidate, setSelectedCandidate] = useState<string>("cand_1");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#FAF7F2] text-[#1C1917] overflow-y-auto flex flex-col animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-[#E5DFD3] bg-[#FAF7F2] px-8 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#78716C] hover:text-[#18181B] flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-[#EFEAE1] transition-colors"
          >
            <X className="w-4 h-4" />
            <span>close</span>
          </button>
          <div className="h-4 w-[1px] bg-[#E5DFD3]" />
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716C] mr-2">
              RE-ANCHORING ANNOTATION
            </span>
            <span className="font-serif text-xs font-bold text-[#1C1917]">
              Meditations (Standard Edition Update)
            </span>
          </div>
        </div>

        <a
          href="#anchor-system"
          onClick={(e) => e.preventDefault()}
          className="text-xs text-[#78716C] hover:text-[#18181B] flex items-center gap-1 transition-colors"
        >
          <span>Learn More about Anchor System</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </header>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto w-full px-8 py-8 flex-1 space-y-8">
        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
            Content changes detected
          </h1>
          <p className="text-xs text-[#78716C] leading-relaxed max-w-2xl">
            The publisher has updated the text of this document. We need your help to find the new location for one of your highlights.
          </p>
        </div>

        {/* 2-Column Comparison Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Original Passage */}
          <div className="space-y-4">
            <h3 className="font-serif text-sm font-bold text-[#1C1917]">
              Original Passage
            </h3>

            {/* Original Quote Excerpt */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 shadow-2xs space-y-4 text-xs leading-relaxed text-[#57534E]">
              <p>
                ... Constantly observe the things which take place, and how they change, and accustom thyself to consider that the nature of the Universe loves nothing so much as to change the things which are and to make new things like them. For everything that exists is in a manner the seed of that which will be.
              </p>
              <div className="bg-rose-50/80 border border-rose-200 text-rose-950 p-2.5 rounded-xl font-serif font-bold text-sm leading-snug">
                The universe is transformation: life is opinion.
              </div>
              <p>
                Consider that before long thou wilt be nobody and nowhere, nor will any of the things exist which thou now seest, nor any of those who are now living. ...
              </p>
            </div>

            {/* Attached Note */}
            <div className="bg-[#FAF7F2] border border-[#E5DFD3] rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                <Edit3 className="w-3.5 h-3.5 text-[#8C8275]" />
                <span className="font-semibold text-[#1C1917]">Your Note</span>
                <span>• Oct 14, 2023</span>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                A foundational stoic principle. It directly connects to the concept of framing our own reality through perception rather than objective truth.
              </p>
            </div>
          </div>

          {/* Right Column: Candidate Matches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-sm font-bold text-[#1C1917]">
                Candidate Matches
              </h3>
              <span className="text-[11px] text-[#78716C] font-mono">
                2 found in new text
              </span>
            </div>

            <div className="space-y-4">
              {/* Candidate 1 (High Confidence) */}
              <div
                onClick={() => setSelectedCandidate("cand_1")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                  selectedCandidate === "cand_1"
                    ? "bg-[#FFFFFF] border-teal-600 ring-2 ring-teal-600/20 shadow-sm"
                    : "bg-[#FFFFFF] border-[#E5DFD3] hover:border-[#DDD5C7]"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-teal-800 font-bold text-[11px] tracking-wider uppercase">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    <span>HIGH CONFIDENCE MATCH</span>
                  </div>
                  <span className="text-[11px] text-[#78716C] font-mono">Book 4, Section 3</span>
                </div>

                <div className="text-xs leading-relaxed text-[#57534E] space-y-2">
                  <p>... For everything that exists is in a manner the seed of that which will be.</p>
                  <div className="bg-teal-50 border border-teal-200 text-teal-950 p-2.5 rounded-xl font-serif font-bold text-sm leading-snug">
                    The universe is change; our life is what our thoughts make it.
                  </div>
                  <p>Consider that before long thou wilt be nobody and nowhere...</p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcceptCandidate?.("cand_1");
                      onClose();
                    }}
                    className="py-1.5 px-3.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <span>Accept Re-Anchor</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Candidate 2 (Medium Confidence) */}
              <div
                onClick={() => setSelectedCandidate("cand_2")}
                className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                  selectedCandidate === "cand_2"
                    ? "bg-[#FFFFFF] border-amber-600 ring-2 ring-amber-600/20 shadow-sm"
                    : "bg-[#FFFFFF] border-[#E5DFD3] hover:border-[#DDD5C7]"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px] tracking-wider uppercase">
                    <HelpCircle className="w-4 h-4 text-amber-700" />
                    <span>MEDIUM CONFIDENCE</span>
                  </div>
                  <span className="text-[11px] text-[#78716C] font-mono">Book 8, Section 12</span>
                </div>

                <div className="text-xs leading-relaxed text-[#57534E] space-y-2">
                  <p>... driven by universal transformation.</p>
                  <div className="bg-amber-50 border border-amber-200 text-amber-950 p-2.5 rounded-xl font-serif font-bold text-sm leading-snug">
                    Life is essentially a matter of opinion, shaped by continuous change.
                  </div>
                  <p>Therefore, one must align their perceptions of...</p>
                </div>
              </div>

              {/* Manual Search Button */}
              <button
                onClick={onFindManually}
                className="w-full p-4 rounded-2xl border border-dashed border-[#DDD5C7] hover:border-[#18181B] bg-[#FAF7F2] hover:bg-[#FFFFFF] transition-all flex flex-col items-center justify-center gap-1 text-center group cursor-pointer"
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
