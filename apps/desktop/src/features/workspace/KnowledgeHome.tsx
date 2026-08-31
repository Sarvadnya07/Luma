import React from "react";
import {
  FolderOpen,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
} from "lucide-react";

export interface KnowledgeHomeProps {
  onNavigateToNotes?: () => void;
  onNavigateToFlashcards?: () => void;
  onNavigateToProjects?: () => void;
}

export const KnowledgeHome: React.FC<KnowledgeHomeProps> = ({
  onNavigateToNotes,
  onNavigateToFlashcards,
  onNavigateToProjects,
}) => {
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
              A curated overview of active inquiries, recent syntheses, and enduring questions in your scholarly pursuit.
            </p>
          </div>
          <button
            onClick={onNavigateToProjects}
            className="text-xs font-semibold text-[#1C1917] hover:underline flex items-center gap-1"
          >
            <span>View Flow</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* 2-Column Main Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left 2 Cols: Recent Syntheses & Active Enquiries */}
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Syntheses */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-base font-bold text-[#1C1917]">
                  Recent Syntheses
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Synthesis Card 1 */}
                <div
                  onClick={onNavigateToNotes}
                  className="bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-2xl p-5 shadow-2xs space-y-3 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono">
                    <span>BOOK: The Architecture of Memory</span>
                    <span>1d ago</span>
                  </div>
                  <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black">
                    Mnemonics in Classical Antiquity
                  </h4>
                  <p className="text-xs text-[#57534E] leading-relaxed line-clamp-3">
                    The transition from oral tradition to written record necessitated structural changes in how scholars retained spatial relationships...
                  </p>
                </div>

                {/* Synthesis Card 2 */}
                <div
                  onClick={onNavigateToNotes}
                  className="bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-2xl p-5 shadow-2xs space-y-3 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#78716C] font-mono">
                    <span>ARTICLE: Journal of Cognitive History</span>
                    <span>3d ago</span>
                  </div>
                  <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black">
                    Spatial Reasoning Hypothesis
                  </h4>
                  <p className="text-xs text-[#57534E] leading-relaxed line-clamp-3">
                    If physical spaces dictate cognitive mapping, then the layout of ancient libraries may reflect their taxonomic epistemologies...
                  </p>
                </div>
              </div>
            </div>

            {/* Active Enquiries */}
            <div className="space-y-4">
              <h3 className="font-serif text-base font-bold text-[#1C1917]">
                Active Enquiries
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Enquiry Card 1 */}
                <div
                  onClick={onNavigateToProjects}
                  className="bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-2xl p-5 shadow-2xs space-y-3 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-teal-800 font-bold uppercase tracking-wider">
                    <FolderOpen className="w-3.5 h-3.5 text-teal-700" />
                    <span>DISSERTATION</span>
                  </div>
                  <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black">
                    Epistemology of the Archive
                  </h4>
                  <p className="text-xs text-[#57534E] leading-relaxed">
                    Tracing the shift from monastic chronicles to state-sponsored bureaucratic memory in 19th-century Europe.
                  </p>
                </div>

                {/* Enquiry Card 2 */}
                <div
                  onClick={onNavigateToProjects}
                  className="bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-2xl p-5 shadow-2xs space-y-3 cursor-pointer transition-all group"
                >
                  <div className="text-[10px] text-[#78716C] font-mono uppercase">
                    CASE STUDY
                  </div>
                  <h4 className="font-serif text-sm font-bold text-[#1C1917] group-hover:text-black">
                    Marginalia Practices
                  </h4>
                  <p className="text-xs text-[#78716C]">
                    Last active: Yesterday
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Study Queue, Open Inquiries & Latest Reflection */}
          <div className="space-y-6">
            {/* Study Queue */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                STUDY QUEUE
              </span>
              <div className="space-y-2">
                <div
                  onClick={onNavigateToFlashcards}
                  className="p-3 bg-[#FFFFFF] border border-[#E5DFD3] hover:border-[#DDD5C7] rounded-xl flex items-center justify-between cursor-pointer shadow-2xs group"
                >
                  <div>
                    <h5 className="font-serif text-xs font-bold text-[#1C1917] group-hover:text-black">
                      Luma Numerology
                    </h5>
                    <p className="text-[10px] text-[#78716C]">Part the second • 18 cards</p>
                  </div>
                  <PlayCircle className="w-4 h-4 text-teal-700" />
                </div>

                <div className="p-3 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl flex items-center justify-between shadow-2xs opacity-75">
                  <div>
                    <h5 className="font-serif text-xs font-bold text-[#1C1917]">
                      Historiography
                    </h5>
                    <p className="text-[10px] text-[#78716C]">Section Review • Complete</p>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </div>

            {/* Open Inquiries */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                OPEN INQUIRIES
              </span>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl space-y-1.5 shadow-2xs">
                  <p className="text-[#292524] leading-relaxed">
                    "Why did the Aristotelian approach fail to account for anomalous empirical observations?"
                  </p>
                  <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#78716C] border border-[#E5DFD3]">
                    From: Draft Dissertation
                  </span>
                </div>

                <div className="p-3 bg-[#FFFFFF] border border-[#E5DFD3] rounded-xl space-y-1.5 shadow-2xs">
                  <p className="text-[#292524] leading-relaxed">
                    "Determine exact publication date of the anonymized folio."
                  </p>
                  <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#FAF7F2] text-[#78716C] border border-[#E5DFD3]">
                    Book: Reading The Republic
                  </span>
                </div>
              </div>
            </div>

            {/* Latest Reflection */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono">
                LATEST REFLECTION
              </span>
              <div className="p-4 bg-[#FAF6EE] border border-[#E2D8C3] rounded-xl space-y-2 text-xs">
                <p className="italic text-[#57534E] leading-relaxed font-serif">
                  "The act of digitizing these transcripts strips them of their tactile context. I must find a way to represent the physical marginalia in the digital database structure without losing the spatial relationship to the main text body."
                </p>
                <div className="text-right">
                  <button className="text-[10px] font-bold text-[#1C1917] hover:underline flex items-center gap-1 justify-end">
                    <span>Read Full Entry</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
