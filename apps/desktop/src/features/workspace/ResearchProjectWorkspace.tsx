import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  History,
  Settings,
  Plus,
  Filter,
  ExternalLink,
} from "lucide-react";

export const ResearchProjectWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "evidence" | "draft">("evidence");

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
              PROJECT: SPATIAL FORMS
            </span>
            <h2 className="font-serif text-lg font-bold text-[#1C1917]">
              The History of Architecture
            </h2>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-[#78716C]">
            <button
              onClick={() => setActiveTab("overview")}
              className={`hover:text-[#18181B] ${activeTab === "overview" ? "text-[#18181B] font-bold" : ""}`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("questions")}
              className={`hover:text-[#18181B] ${activeTab === "questions" ? "text-[#18181B] font-bold" : ""}`}
            >
              Questions
            </button>
            <button
              onClick={() => setActiveTab("evidence")}
              className={`pb-1 border-b-2 ${
                activeTab === "evidence"
                  ? "border-[#18181B] text-[#18181B] font-bold"
                  : "border-transparent hover:text-[#18181B]"
              }`}
            >
              Evidence
            </button>
            <button
              onClick={() => setActiveTab("draft")}
              className={`hover:text-[#18181B] ${activeTab === "draft" ? "text-[#18181B] font-bold" : ""}`}
            >
              Draft
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#78716C]">
          <button className="p-1.5 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]">
            <Search className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]">
            <History className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-[#18181B] rounded hover:bg-[#EFEAE1]">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Claim Workspace */}
      <div className="max-w-5xl mx-auto w-full space-y-8 pt-6 pb-16">
        {/* Main Heading */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
              Claim Analysis
            </h1>
            <p className="text-xs text-[#78716C] max-w-xl leading-relaxed">
              Examining the structural evolution from Romanesque to Gothic cathedral design, specifically focusing on load distribution techniques.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="py-2 px-3 bg-[#FFFFFF] border border-[#DDD5C7] hover:bg-[#F5EFE6] text-xs font-semibold text-[#57534E] rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Claims</span>
            </button>
            <button className="py-2 px-4 bg-[#18362D] hover:bg-[#20453A] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Evidence</span>
            </button>
          </div>
        </div>

        {/* Claim Block */}
        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">
              • Claim: The pointed arch was structurally necessary, not merely aesthetic.
            </h3>
            <p className="text-[11px] text-[#78716C] font-mono">
              Hypothesis 2.4 • Last modified: 3 days ago
            </p>
          </div>

          {/* Grid of Evidence Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Evidence Card 1 (Supporting Text) */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-teal-800 font-bold text-[11px]">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    <span>Supporting</span>
                  </div>
                  <span className="text-[10px] text-[#78716C] font-mono">Strength: Strong</span>
                </div>

                <p className="font-serif text-xs italic text-[#292524] leading-relaxed pl-3 border-l-2 border-teal-600">
                  "The ogival rib-vault was one of the decisive elements: the pointed arches allowed for a significant reduction in lateral thrust compared to semi-circular Romanesque volts, meaning thinner walls and larger window openings."
                </p>
              </div>

              <div className="pt-3 border-t border-[#F2ECE2] flex items-center justify-between text-[11px] text-[#78716C]">
                <span className="truncate max-w-[240px]">
                  Viollet-le-Duc, E. (1854). Dictionnaire raisonné... Vol 4, p. 45.
                </span>
                <button className="hover:text-[#18181B] flex items-center gap-1 font-semibold flex-shrink-0">
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Evidence Card 2 (Visual Diagram) */}
            <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-teal-800 font-bold text-xs text-[11px]">
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                  <span>Supporting</span>
                </div>

                {/* Arch Diagram Box */}
                <div className="w-full h-24 bg-[#EAE4DA] rounded-lg border border-[#DDD5C7] flex flex-col items-center justify-center p-2 text-center">
                  <span className="font-serif italic text-xs text-[#78716C]">
                    Image: Arch Structural Load Vectors
                  </span>
                </div>

                <p className="text-xs text-[#57534E] leading-relaxed">
                  Visual analysis of stress distribution models confirms lower lateral thrust vectors in pointed designs.
                </p>
              </div>

              <div className="pt-3 border-t border-[#F2ECE2] text-[11px] text-[#78716C]">
                <span>Pevsner, N. (1943). An Outline of European Architecture.</span>
              </div>
            </div>

            {/* Evidence Card 3 (Counter / Complicating) - Full width */}
            <div className="md:col-span-2 bg-[#FFFFFF] border border-rose-200 rounded-2xl p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-1.5 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
                <span>Counter / Complicating</span>
              </div>

              <p className="font-serif text-xs italic text-[#292524] leading-relaxed pl-3 border-l-2 border-rose-300">
                "While the structural advantages of the pointed arch are undeniable, its initial adoption in the Ile-de-France was heavily influenced by aesthetic movements in proto-scholastic mysticism during the 12th century, suggesting aesthetic preference preceded full structural comprehension."
              </p>

              <div className="pt-3 border-t border-[#F2ECE2] flex items-center justify-between text-[11px] text-[#78716C]">
                <span>Bony, J. (1983). French Gothic Architecture of the 12th and 13th Centuries.</span>
                <button className="hover:text-[#18181B] flex items-center gap-1 font-semibold">
                  <span>Open in Source</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
