import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { LumaApi } from "../../lib/tauri";

interface EvidenceItem {
  id: string;
  type: "supporting" | "counter";
  strength: string;
  quote: string;
  citation: string;
  diagram?: boolean;
  diagramLabel?: string;
}

interface QuestionItem {
  id: string;
  q: string;
  status: string;
  source: string;
}

export const ResearchProjectWorkspace: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "evidence" | "draft">("evidence");
  const [filterType, setFilterType] = useState<"all" | "supporting" | "counter">("all");
  const [projectId, setProjectId] = useState("proj_spatial_forms");
  const [projectTitle, setProjectTitle] = useState("The History of Architecture");
  const [projectDescription, setProjectDescription] = useState(
    "This research project investigates how architectural innovations between the 11th and 14th centuries reflected shifts in theological epistemology, geometric mathematics, and civic institutional power in medieval Europe."
  );

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([
    {
      id: "ev_1",
      type: "supporting",
      strength: "Strong",
      quote: "The ogival rib-vault was one of the decisive elements: the pointed arches allowed for a significant reduction in lateral thrust compared to semi-circular Romanesque vaults, meaning thinner walls and larger window openings.",
      citation: "Viollet-le-Duc, E. (1854). Dictionnaire raisonné du mobilier français, Vol 4, p. 45.",
      diagram: false,
    },
    {
      id: "ev_2",
      type: "supporting",
      strength: "Moderate",
      quote: "Visual analysis of stress distribution models confirms lower lateral thrust vectors in pointed designs.",
      citation: "Pevsner, N. (1943). An Outline of European Architecture.",
      diagram: true,
      diagramLabel: "Arch Structural Load Vectors",
    },
    {
      id: "ev_3",
      type: "counter",
      strength: "Nuanced",
      quote: "While the structural advantages of the pointed arch are undeniable, its initial adoption in the Île-de-France was heavily influenced by aesthetic movements in proto-scholastic mysticism during the 12th century, suggesting aesthetic preference preceded full structural comprehension.",
      citation: "Bony, J. (1983). French Gothic Architecture of the 12th and 13th Centuries.",
      diagram: false,
    },
  ]);

  const [questionsList, setQuestionsList] = useState<QuestionItem[]>([
    {
      id: "q_1",
      q: "How did rib-vaulting change interior acoustic propagation in choir areas?",
      status: "Open Inquiry",
      source: "Gothic Acoustics Vol II",
    },
    {
      id: "q_2",
      q: "Did proto-scholastic mysticism influence light distribution through clerestory windows?",
      status: "Evidence Corroborated",
      source: "Suger of Saint-Denis, De Consecratione",
    },
    {
      id: "q_3",
      q: "What was the guild apprenticeship transmission rate for geometric stonecutters?",
      status: "Under Review",
      source: "Masons and Master Builders",
    },
  ]);

  const [draftTitle, setDraftTitle] = useState("Section II: Load-Bearing Geometry in 12th-Century Île-de-France");
  const [draftContent, setDraftContent] = useState(
    "The emergence of the pointed arch in the royal domain of France marked a critical juncture in Gothic architecture. By altering the thrust vectors from a radial arc toward a steeper vertical tangent, medieval master masons solved the fundamental limitation of Romanesque barrel vaulting.\n\nAs documented by Viollet-le-Duc, this geometric evolution permitted vault bays of unequal spans to reach uniform apex heights without clumsy stilting or segmental distortions. Consequently, structural loads could be concentrated upon slender compound piers rather than distributed along massive continuous masonry walls."
  );

  useEffect(() => {
    let mounted = true;
    async function loadProjectData() {
      try {
        let projects = await LumaApi.listResearchProjects();
        if (projects.length === 0) {
          // Seed initial project into SQLite
          await LumaApi.createResearchProject({
            id: "proj_spatial_forms",
            title: "The History of Architecture",
            description: projectDescription,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false,
          });

          // Seed questions
          for (const q of questionsList) {
            await LumaApi.createResearchQuestion({
              id: q.id,
              project_id: "proj_spatial_forms",
              question: q.q,
              status: q.status,
              created_at: new Date().toISOString(),
            });
          }

          // Seed evidence
          for (const ev of evidenceList) {
            await LumaApi.createResearchEvidence({
              id: ev.id,
              project_id: "proj_spatial_forms",
              question_id: null,
              source_title: ev.citation,
              quote: ev.quote,
              notes: ev.diagramLabel || null,
              stance: ev.type,
              book_id: null,
              locator: null,
              created_at: new Date().toISOString(),
            });
          }

          // Seed draft
          await LumaApi.saveResearchDraft({
            id: "draft_spatial_forms",
            project_id: "proj_spatial_forms",
            title: draftTitle,
            content: draftContent,
            updated_at: new Date().toISOString(),
          });

          projects = await LumaApi.listResearchProjects();
        }

        if (mounted && projects.length > 0) {
          const currentProj = projects[0]!;
          setProjectId(currentProj.id);
          setProjectTitle(currentProj.title);
          if (currentProj.description) setProjectDescription(currentProj.description);

          // Fetch questions
          const qFromDb = await LumaApi.listResearchQuestions(currentProj.id);
          if (qFromDb.length > 0) {
            setQuestionsList(
              qFromDb.map((q) => ({
                id: q.id,
                q: q.question,
                status: q.status,
                source: "Project Inquiry",
              }))
            );
          }

          // Fetch evidence
          const evFromDb = await LumaApi.listResearchEvidence(currentProj.id);
          if (evFromDb.length > 0) {
            setEvidenceList(
              evFromDb.map((ev) => ({
                id: ev.id,
                type: ev.stance === "counter" ? "counter" : "supporting",
                strength: "Verified",
                quote: ev.quote,
                citation: ev.source_title,
                diagram: !!ev.notes,
                diagramLabel: ev.notes || undefined,
              }))
            );
          }

          // Fetch draft
          const draftFromDb = await LumaApi.getResearchDraft(currentProj.id);
          if (draftFromDb) {
            setDraftTitle(draftFromDb.title);
            setDraftContent(draftFromDb.content);
          }
        }
      } catch (err) {
        console.error("Failed to load research project from SQLite:", err);
      }
    }
    loadProjectData();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDraftChange = (newContent: string) => {
    setDraftContent(newContent);
    LumaApi.saveResearchDraft({
      id: `draft_${projectId}`,
      project_id: projectId,
      title: draftTitle,
      content: newContent,
      updated_at: new Date().toISOString(),
    }).catch((e) => console.error("Failed to save research draft:", e));
  };

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
              {projectTitle}
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
          <div className="bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1917] dark:text-[#EAE5DC]">Project Abstract</h3>
            <p className="text-xs text-[#57534E] dark:text-[#B5ADA3] leading-relaxed">
              This research project investigates how architectural innovations between the 11th and 14th centuries reflected shifts in theological epistemology, geometric mathematics, and civic institutional power in medieval Europe.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1B18] rounded-xl border border-[#18181B]/15 dark:border-white/15 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Key Questions</div>
                <div className="text-base font-bold text-[#1C1917] dark:text-[#EAE5DC] mt-1">4 Active</div>
              </div>
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1B18] rounded-xl border border-[#18181B]/15 dark:border-white/15 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Evidence Cited</div>
                <div className="text-base font-bold text-[#1C1917] dark:text-[#EAE5DC] mt-1">{evidenceList.length} Items</div>
              </div>
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1B18] rounded-xl border border-[#18181B]/15 dark:border-white/15 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Working Draft</div>
                <div className="text-base font-bold text-[#1C1917] dark:text-[#EAE5DC] mt-1">1,420 words</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTIONS TAB */}
      {activeTab === "questions" && (
        <div className="max-w-5xl mx-auto w-full space-y-4 pt-6 pb-16">
          <div className="flex justify-between items-center">
            <h3 className="font-serif text-lg font-bold text-[#1C1917] dark:text-[#EAE5DC]">Guiding Scholarly Inquiries</h3>
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
                className="bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-2xl p-5 shadow-xs space-y-2 hover:border-[#18181B]/30 dark:hover:border-white/30 hover:shadow-sm transition-all"
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
                  className={`bg-[#FFFFFF] dark:bg-[#27231E] border rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between transition-all ${
                    ev.type === "counter"
                      ? "border-rose-300 dark:border-rose-900/60 md:col-span-2 shadow-rose-900/5"
                      : "border-[#18181B]/15 dark:border-white/15"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div
                        className={`flex items-center gap-1.5 font-bold text-[11px] ${
                          ev.type === "counter" ? "text-rose-800 dark:text-rose-400" : "text-teal-800 dark:text-teal-400"
                        }`}
                      >
                        {ev.type === "counter" ? (
                          <AlertTriangle className="w-4 h-4 text-rose-700 dark:text-rose-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                        )}
                        <span>{ev.type === "counter" ? "Counter / Complicating" : "Supporting"}</span>
                      </div>
                      <span className="text-[10px] text-[#78716C] font-mono">Strength: {ev.strength}</span>
                    </div>

                    <p
                      className={`font-serif text-xs italic text-[#292524] dark:text-[#DDD5C7] leading-relaxed pl-3 border-l-2 ${
                        ev.type === "counter" ? "border-rose-400" : "border-teal-600"
                      }`}
                    >
                      "{ev.quote}"
                    </p>

                    {ev.diagram && (
                      <div className="w-full h-20 bg-[#EAE4DA] dark:bg-[#1E1B18] rounded-lg border border-[#18181B]/15 dark:border-white/10 flex flex-col items-center justify-center p-2 text-center shadow-inner">
                        <span className="font-serif italic text-xs text-[#78716C]">
                          Visual Diagram: {ev.diagramLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#F2ECE2] dark:border-white/10 flex items-center justify-between text-[11px] text-[#78716C]">
                    <span className="truncate max-w-[280px]">{ev.citation}</span>
                    <span className="text-[10px] font-mono bg-[#FAF7F2] dark:bg-[#1E1B18] px-1.5 py-0.5 rounded border border-[#18181B]/15 dark:border-white/10">
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
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => {
                setDraftTitle(e.target.value);
                LumaApi.saveResearchDraft({
                  id: `draft_${projectId}`,
                  project_id: projectId,
                  title: e.target.value,
                  content: draftContent,
                  updated_at: new Date().toISOString(),
                }).catch(console.error);
              }}
              className="font-serif text-2xl font-bold text-[#1C1917] w-full border-b border-transparent hover:border-[#E5DFD3] focus:border-[#18181B] focus:outline-none pb-1"
            />
            <div className="space-y-2">
              <span className="text-[10px] font-mono text-[#78716C] uppercase font-bold">
                Working Draft (Auto-saved to SQLite)
              </span>
              <textarea
                value={draftContent}
                onChange={(e) => handleDraftChange(e.target.value)}
                rows={12}
                className="w-full text-xs leading-relaxed text-[#292524] bg-stone-50/50 border border-[#E5DFD3] rounded-xl p-4 focus:outline-none focus:border-[#18181B] resize-y font-serif"
                placeholder="Compose research draft, synthesizing claims and citations..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
