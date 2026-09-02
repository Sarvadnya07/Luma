import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export const ResearchProjectWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "evidence" | "draft">("evidence");
  const [filterType, setFilterType] = useState<"all" | "supporting" | "counter">("all");

  const [evidenceList] = useState([
    {
      id: "ev_1",
      type: "supporting" as const,
      strength: "Strong",
      quote: "The ogival rib-vault was one of the decisive elements: the pointed arches allowed for a significant reduction in lateral thrust compared to semi-circular Romanesque vaults, meaning thinner walls and larger window openings.",
      citation: "Viollet-le-Duc, E. (1854). Dictionnaire raisonné du mobilier français, Vol 4, p. 45.",
      diagram: false,
    },
    {
      id: "ev_2",
      type: "supporting" as const,
      strength: "Moderate",
      quote: "Visual analysis of stress distribution models confirms lower lateral thrust vectors in pointed designs.",
      citation: "Pevsner, N. (1943). An Outline of European Architecture.",
      diagram: true,
      diagramLabel: "Arch Structural Load Vectors",
    },
    {
      id: "ev_3",
      type: "counter" as const,
      strength: "Nuanced",
      quote: "While the structural advantages of the pointed arch are undeniable, its initial adoption in the Île-de-France was heavily influenced by aesthetic movements in proto-scholastic mysticism during the 12th century, suggesting aesthetic preference preceded full structural comprehension.",
      citation: "Bony, J. (1983). French Gothic Architecture of the 12th and 13th Centuries.",
      diagram: false,
    },
  ]);

  const filteredEvidence = evidenceList.filter((ev) => {
    if (filterType === "all") return true;
    return ev.type === filterType;
  });

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
            {(["overview", "questions", "evidence", "draft"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-1 border-b-2 capitalize transition-colors ${
                  activeTab === tab
                    ? "border-[#18181B] text-[#18181B] font-bold"
                    : "border-transparent hover:text-[#18181B]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-[#78716C]">
          <span className="text-[11px] font-mono bg-[#EFEAE1] px-2 py-0.5 rounded text-stone-600 font-medium">
            3 Sources Active
          </span>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="max-w-5xl mx-auto w-full space-y-6 pt-6 pb-16">
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-6 shadow-2xs space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">Project Abstract</h3>
            <p className="text-xs text-[#57534E] leading-relaxed">
              This research project investigates how architectural innovations between the 11th and 14th centuries reflected shifts in theological epistemology, geometric mathematics, and civic institutional power in medieval Europe.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DFD3]">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Key Questions</div>
                <div className="text-base font-bold text-[#1C1917] mt-1">4 Active</div>
              </div>
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DFD3]">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Evidence Cited</div>
                <div className="text-base font-bold text-[#1C1917] mt-1">{evidenceList.length} Items</div>
              </div>
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5DFD3]">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Working Draft</div>
                <div className="text-base font-bold text-[#1C1917] mt-1">1,420 words</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTIONS TAB */}
      {activeTab === "questions" && (
        <div className="max-w-5xl mx-auto w-full space-y-4 pt-6 pb-16">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">Guiding Scholarly Inquiries</h3>
          </div>
          <div className="space-y-3">
            {[
              {
                q: "How did rib-vaulting change interior acoustic propagation in choir areas?",
                status: "Open Inquiry",
                source: "Gothic Acoustics Vol II",
              },
              {
                q: "Did proto-scholastic mysticism influence light distribution through clerestory windows?",
                status: "Evidence Corroborated",
                source: "Suger of Saint-Denis, De Consecratione",
              },
              {
                q: "What was the guild apprenticeship transmission rate for geometric stonecutters?",
                status: "Under Review",
                source: "Masons and Master Builders",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-5 shadow-2xs space-y-2 hover:border-[#DDD5C7] transition-all"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-[#78716C]">
                  <span className="text-teal-800 font-bold">{item.status}</span>
                  <span>Ref: {item.source}</span>
                </div>
                <h4 className="font-serif text-sm font-bold text-[#1C1917]">{item.q}</h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVIDENCE TAB */}
      {activeTab === "evidence" && (
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
              <div className="flex bg-[#EFEAE1] p-1 rounded-xl text-xs">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === "all" ? "bg-white text-[#1C1917] shadow-2xs font-bold" : "text-[#78716C]"
                  }`}
                >
                  All ({evidenceList.length})
                </button>
                <button
                  onClick={() => setFilterType("supporting")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === "supporting" ? "bg-white text-[#1C1917] shadow-2xs font-bold" : "text-[#78716C]"
                  }`}
                >
                  Supporting
                </button>
                <button
                  onClick={() => setFilterType("counter")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === "counter" ? "bg-white text-[#1C1917] shadow-2xs font-bold" : "text-[#78716C]"
                  }`}
                >
                  Counter
                </button>
              </div>
            </div>
          </div>

          {/* Claim Block */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-bold text-[#1C1917]">
                • Claim: The pointed arch was structurally necessary, not merely aesthetic.
              </h3>
              <p className="text-[11px] text-[#78716C] font-mono">
                Hypothesis 2.4 • 3 Evidence Items Verified
              </p>
            </div>

            {/* Grid of Evidence Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredEvidence.map((ev) => (
                <div
                  key={ev.id}
                  className={`bg-[#FFFFFF] border rounded-2xl p-5 shadow-2xs space-y-3 flex flex-col justify-between ${
                    ev.type === "counter" ? "border-rose-200 md:col-span-2" : "border-[#E5DFD3]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div
                        className={`flex items-center gap-1.5 font-bold text-[11px] ${
                          ev.type === "counter" ? "text-rose-800" : "text-teal-800"
                        }`}
                      >
                        {ev.type === "counter" ? (
                          <AlertTriangle className="w-4 h-4 text-rose-700" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-teal-700" />
                        )}
                        <span>{ev.type === "counter" ? "Counter / Complicating" : "Supporting"}</span>
                      </div>
                      <span className="text-[10px] text-[#78716C] font-mono">Strength: {ev.strength}</span>
                    </div>

                    <p
                      className={`font-serif text-xs italic text-[#292524] leading-relaxed pl-3 border-l-2 ${
                        ev.type === "counter" ? "border-rose-300" : "border-teal-600"
                      }`}
                    >
                      "{ev.quote}"
                    </p>

                    {ev.diagram && (
                      <div className="w-full h-20 bg-[#EAE4DA] rounded-lg border border-[#DDD5C7] flex flex-col items-center justify-center p-2 text-center">
                        <span className="font-serif italic text-xs text-[#78716C]">
                          Visual Diagram: {ev.diagramLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#F2ECE2] flex items-center justify-between text-[11px] text-[#78716C]">
                    <span className="truncate max-w-[280px]">{ev.citation}</span>
                    <span className="text-[10px] font-mono bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E5DFD3]">
                      Verified Source
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DRAFT TAB */}
      {activeTab === "draft" && (
        <div className="max-w-3xl mx-auto w-full space-y-6 pt-6 pb-16">
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-8 shadow-2xs space-y-4">
            <h1 className="font-serif text-2xl font-bold text-[#1C1917]">
              Section II: Load-Bearing Geometry in 12th-Century Île-de-France
            </h1>
            <div className="prose-reader text-xs leading-relaxed text-[#292524] space-y-3 text-justify">
              <p>
                The emergence of the pointed arch in the royal domain of France marked a critical juncture in Gothic architecture. By altering the thrust vectors from a radial arc toward a steeper vertical tangent, medieval master masons solved the fundamental limitation of Romanesque barrel vaulting.
              </p>
              <p>
                As documented by Viollet-le-Duc, this geometric evolution permitted vault bays of unequal spans to reach uniform apex heights without clumsy stilting or segmental distortions. Consequently, structural loads could be concentrated upon slender compound piers rather than distributed along massive continuous masonry walls.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
