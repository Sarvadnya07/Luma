import React, { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  BookOpen,
  FileText,
  HelpCircle,
} from "lucide-react";
import { LumaApi } from "../../lib/tauri";
import type { ResearchProject } from "@luma/shared-types";

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

  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([]);
  const [questionsList, setQuestionsList] = useState<QuestionItem[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Creation Modals / Inline Forms
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");

  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionSource, setNewQuestionSource] = useState("");

  const [isAddingEvidence, setIsAddingEvidence] = useState(false);
  const [newEvidenceQuote, setNewEvidenceQuote] = useState("");
  const [newEvidenceCitation, setNewEvidenceCitation] = useState("");
  const [newEvidenceType, setNewEvidenceType] = useState<"supporting" | "counter">("supporting");
  const [newEvidenceNotes, setNewEvidenceNotes] = useState("");

  const loadProjectDetails = useCallback(async (projId: string) => {
    try {
      const [questions, evidence, draft] = await Promise.all([
        LumaApi.listResearchQuestions(projId),
        LumaApi.listResearchEvidence(projId),
        LumaApi.getResearchDraft(projId),
      ]);

      setQuestionsList(
        questions.map((q) => ({
          id: q.id,
          q: q.question,
          status: q.status,
          source: "Project Inquiry",
        }))
      );

      setEvidenceList(
        evidence.map((ev) => ({
          id: ev.id,
          type: ev.stance === "counter" ? "counter" : "supporting",
          strength: "Verified",
          quote: ev.quote,
          citation: ev.source_title,
          diagram: !!ev.notes,
          diagramLabel: ev.notes || undefined,
        }))
      );

      if (draft) {
        setDraftTitle(draft.title);
        setDraftContent(draft.content);
      } else {
        setDraftTitle("Working Draft");
        setDraftContent("");
      }
    } catch (err) {
      console.error("Failed to load project details:", err);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const projs = await LumaApi.listResearchProjects();
      setProjects(projs);

      if (projs.length > 0) {
        const activeProj = selectedProjectId
          ? projs.find((p) => p.id === selectedProjectId) || projs[0]!
          : projs[0]!;
        setSelectedProjectId(activeProj.id);
        setProjectTitle(activeProj.title);
        setProjectDescription(activeProj.description || "");
        await loadProjectDetails(activeProj.id);
      } else {
        setSelectedProjectId(null);
        setProjectTitle("");
        setProjectDescription("");
        setQuestionsList([]);
        setEvidenceList([]);
        setDraftTitle("");
        setDraftContent("");
      }
    } catch (err) {
      console.error("Failed to load research projects from SQLite:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProjectId, loadProjectDetails]);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSelectProject = async (id: string) => {
    const proj = projects.find((p) => p.id === id);
    if (!proj) return;
    setSelectedProjectId(id);
    setProjectTitle(proj.title);
    setProjectDescription(proj.description || "");
    await loadProjectDetails(id);
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectTitle.trim()) return;

    const newId = `proj_${Date.now()}`;
    const newProj: ResearchProject = {
      id: newId,
      title: newProjectTitle.trim(),
      description: newProjectDesc.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
    };

    try {
      await LumaApi.createResearchProject(newProj);
      await LumaApi.saveResearchDraft({
        id: `draft_${newId}`,
        project_id: newId,
        title: "Working Draft",
        content: "",
        updated_at: new Date().toISOString(),
      });
      setNewProjectTitle("");
      setNewProjectDesc("");
      setIsCreatingProject(false);
      setSelectedProjectId(newId);
      await loadProjects();
    } catch (err) {
      console.error("Failed to create research project:", err);
    }
  };

  const handleDraftChange = (newContent: string) => {
    setDraftContent(newContent);
    if (!selectedProjectId) return;
    LumaApi.saveResearchDraft({
      id: `draft_${selectedProjectId}`,
      project_id: selectedProjectId,
      title: draftTitle || "Working Draft",
      content: newContent,
      updated_at: new Date().toISOString(),
    }).catch((e) => console.error("Failed to save research draft:", e));
  };

  const handleDraftTitleChange = (newTitle: string) => {
    setDraftTitle(newTitle);
    if (!selectedProjectId) return;
    LumaApi.saveResearchDraft({
      id: `draft_${selectedProjectId}`,
      project_id: selectedProjectId,
      title: newTitle,
      content: draftContent,
      updated_at: new Date().toISOString(),
    }).catch((e) => console.error("Failed to save draft title:", e));
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !selectedProjectId) return;

    const newQ = {
      id: `q_${Date.now()}`,
      project_id: selectedProjectId,
      question: newQuestionText.trim(),
      status: "Open Inquiry",
      created_at: new Date().toISOString(),
    };

    try {
      await LumaApi.createResearchQuestion(newQ);
      setQuestionsList((prev) => [
        ...prev,
        {
          id: newQ.id,
          q: newQ.question,
          status: newQ.status,
          source: newQuestionSource.trim() || "Project Inquiry",
        },
      ]);
      setNewQuestionText("");
      setNewQuestionSource("");
      setIsAddingQuestion(false);
    } catch (err) {
      console.error("Failed to create research question:", err);
    }
  };

  const handleAddEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvidenceQuote.trim() || !selectedProjectId) return;

    const newEv = {
      id: `ev_${Date.now()}`,
      project_id: selectedProjectId,
      question_id: null,
      source_title: newEvidenceCitation.trim() || "Reading Source",
      quote: newEvidenceQuote.trim(),
      notes: newEvidenceNotes.trim() || null,
      stance: newEvidenceType,
      book_id: null,
      locator: null,
      created_at: new Date().toISOString(),
    };

    try {
      await LumaApi.createResearchEvidence(newEv);
      setEvidenceList((prev) => [
        ...prev,
        {
          id: newEv.id,
          type: newEv.stance,
          strength: "Verified",
          quote: newEv.quote,
          citation: newEv.source_title,
          diagram: !!newEv.notes,
          diagramLabel: newEv.notes || undefined,
        },
      ]);
      setNewEvidenceQuote("");
      setNewEvidenceCitation("");
      setNewEvidenceNotes("");
      setIsAddingEvidence(false);
    } catch (err) {
      console.error("Failed to create research evidence:", err);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    try {
      await LumaApi.deleteResearchEvidence(id);
      setEvidenceList((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err) {
      console.error("Failed to delete evidence:", err);
    }
  };

  const filteredEvidence = evidenceList.filter((ev) => {
    if (filterType === "all") return true;
    return ev.type === filterType;
  });

  const supportingCount = evidenceList.filter((ev) => ev.type === "supporting").length;
  const counterCount = evidenceList.filter((ev) => ev.type === "counter").length;
  const draftWords = draftContent.trim() ? draftContent.trim().split(/\s+/).filter(Boolean).length : 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-[#FAF7F2] text-[#78716C] font-mono text-xs">
        Loading research workspace...
      </div>
    );
  }

  // Zero projects empty state
  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full bg-[#FAF7F2] text-[#1C1917] p-8">
        <div className="w-full max-w-md bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-3xl p-8 shadow-sm text-center space-y-4">
          <BookOpen className="w-10 h-10 text-[#A8A29E] mx-auto" />
          <h2 className="font-serif text-lg font-bold text-[#1C1917] dark:text-[#EAE5DC]">
            No Research Projects
          </h2>
          <p className="text-xs text-[#78716C] dark:text-[#B5ADA3] leading-relaxed">
            Create a structured research project to formulate questions, synthesize citations, and draft scholarly arguments.
          </p>
          {isCreatingProject ? (
            <form onSubmit={handleCreateProject} className="space-y-3 text-left pt-2">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Project Title
                </label>
                <input
                  type="text"
                  required
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="e.g., The Evolution of Gothic Architecture"
                  className="w-full text-xs p-2.5 bg-white border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Abstract / Thesis (Optional)
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe your research hypothesis and objectives..."
                  className="w-full text-xs p-2.5 bg-white border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B] resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl transition-colors shadow-2xs"
                >
                  Create Project
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingProject(true)}
              className="py-2 px-4 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 mx-auto transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#FAF7F2] text-[#1C1917] overflow-y-auto px-8 py-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#E5DFD3] pb-4">
        <div className="flex items-center gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#78716C] font-mono block">
                PROJECT
              </span>
              {projects.length > 1 && (
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) => handleSelectProject(e.target.value)}
                  className="text-[10px] font-mono bg-transparent border border-[#E5DFD3] rounded px-1.5 py-0.5 text-stone-600 focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
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
                {tab === "questions" && questionsList.length > 0 && ` (${questionsList.length})`}
                {tab === "evidence" && evidenceList.length > 0 && ` (${evidenceList.length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono bg-[#EFEAE1] px-2 py-0.5 rounded text-stone-600 font-medium">
            {evidenceList.length} Evidence • {draftWords} Words
          </span>
          <button
            onClick={() => setIsCreatingProject(true)}
            className="p-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded-lg flex items-center gap-1 font-semibold text-xs transition-colors shadow-2xs"
            title="Create New Project"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* New Project Modal */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-4 border border-[#E5DFD3]">
            <h3 className="font-serif text-lg font-bold text-[#1C1917]">New Research Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="e.g., Medieval Epistemology and Architecture"
                  className="w-full text-xs p-2.5 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Abstract / Thesis
                </label>
                <textarea
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  rows={3}
                  placeholder="Describe your research hypothesis..."
                  className="w-full text-xs p-2.5 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="max-w-5xl mx-auto w-full space-y-6 pt-6 pb-16">
          <div className="bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-serif text-lg font-bold text-[#1C1917] dark:text-[#EAE5DC]">Project Abstract</h3>
            <p className="text-xs text-[#57534E] dark:text-[#B5ADA3] leading-relaxed">
              {projectDescription || "No abstract provided for this project. Formulate your scholarly scope and hypothesis to orient your research."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1B18] rounded-xl border border-[#18181B]/15 dark:border-white/15 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Key Questions</div>
                <div className="text-base font-bold text-[#1C1917] dark:text-[#EAE5DC] mt-1">
                  {questionsList.length} Active
                </div>
              </div>
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1B18] rounded-xl border border-[#18181B]/15 dark:border-white/15 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Evidence Cited</div>
                <div className="text-base font-bold text-[#1C1917] dark:text-[#EAE5DC] mt-1">
                  {evidenceList.length} Items
                </div>
              </div>
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#1E1B18] rounded-xl border border-[#18181B]/15 dark:border-white/15 shadow-2xs">
                <div className="text-[10px] font-bold uppercase text-[#78716C]">Working Draft</div>
                <div className="text-base font-bold text-[#1C1917] dark:text-[#EAE5DC] mt-1">
                  {draftWords} words
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUESTIONS TAB */}
      {activeTab === "questions" && (
        <div className="max-w-5xl mx-auto w-full space-y-4 pt-6 pb-16">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1C1917] dark:text-[#EAE5DC]">Guiding Scholarly Inquiries</h3>
              <p className="text-xs text-[#78716C]">Core questions shaping the scope of this project.</p>
            </div>
            <button
              onClick={() => setIsAddingQuestion(true)}
              className="p-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded-lg flex items-center gap-1 font-semibold text-xs transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          {isAddingQuestion && (
            <form onSubmit={handleAddQuestion} className="bg-white border border-[#E5DFD3] rounded-2xl p-4 shadow-sm space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Inquiry Question
                </label>
                <input
                  type="text"
                  required
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="e.g., How did rib-vaulting change interior acoustic propagation?"
                  className="w-full text-xs p-2.5 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Source / Context (Optional)
                </label>
                <input
                  type="text"
                  value={newQuestionSource}
                  onChange={(e) => setNewQuestionSource(e.target.value)}
                  placeholder="e.g., Gothic Acoustics Vol II"
                  className="w-full text-xs p-2.5 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingQuestion(false)}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl"
                >
                  Save Question
                </button>
              </div>
            </form>
          )}

          {questionsList.length === 0 ? (
            <div className="bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-2xl p-8 text-center space-y-2">
              <HelpCircle className="w-8 h-8 text-[#A8A29E] mx-auto" />
              <p className="font-serif text-sm font-bold text-[#1C1917] dark:text-[#EAE5DC]">No inquiries yet</p>
              <p className="text-xs text-[#78716C] dark:text-[#B5ADA3]">
                Add research questions to define hypotheses and guide your source examination.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {questionsList.map((item) => (
                <div
                  key={item.id}
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
          )}
        </div>
      )}

      {/* EVIDENCE TAB */}
      {activeTab === "evidence" && (
        <div className="max-w-5xl mx-auto w-full space-y-8 pt-6 pb-16">
          {/* Main Heading */}
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h1 className="font-serif text-3xl font-bold text-[#1C1917] tracking-tight">
                Synthesized Evidence
              </h1>
              <p className="text-xs text-[#78716C] max-w-xl leading-relaxed">
                Examining corroborating and counter-evidence extracted from your library and readings.
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
                  Supporting ({supportingCount})
                </button>
                <button
                  onClick={() => setFilterType("counter")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    filterType === "counter" ? "bg-white text-[#1C1917] shadow-2xs font-bold" : "text-[#78716C]"
                  }`}
                >
                  Counter ({counterCount})
                </button>
              </div>

              <button
                onClick={() => setIsAddingEvidence(true)}
                className="p-1.5 bg-[#18181B] hover:bg-[#27272A] text-white rounded-lg flex items-center gap-1 font-semibold text-xs transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Evidence</span>
              </button>
            </div>
          </div>

          {isAddingEvidence && (
            <form onSubmit={handleAddEvidence} className="bg-white border border-[#E5DFD3] rounded-2xl p-5 shadow-sm space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Quotation / Claim
                </label>
                <textarea
                  required
                  rows={3}
                  value={newEvidenceQuote}
                  onChange={(e) => setNewEvidenceQuote(e.target.value)}
                  placeholder="Paste quotation or observed evidence..."
                  className="w-full text-xs p-2.5 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B] resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                    Citation / Source
                  </label>
                  <input
                    type="text"
                    required
                    value={newEvidenceCitation}
                    onChange={(e) => setNewEvidenceCitation(e.target.value)}
                    placeholder="e.g., Viollet-le-Duc (1854), Vol 4, p. 45"
                    className="w-full text-xs p-2 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                    Stance
                  </label>
                  <select
                    value={newEvidenceType}
                    onChange={(e) => setNewEvidenceType(e.target.value as "supporting" | "counter")}
                    className="w-full text-xs p-2 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                  >
                    <option value="supporting">Supporting</option>
                    <option value="counter">Counter / Complicating</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#78716C] font-mono block mb-1">
                  Notes / Diagram Label (Optional)
                </label>
                <input
                  type="text"
                  value={newEvidenceNotes}
                  onChange={(e) => setNewEvidenceNotes(e.target.value)}
                  placeholder="e.g., Stress distribution diagram"
                  className="w-full text-xs p-2 bg-stone-50 border border-[#E5DFD3] rounded-xl focus:outline-none focus:border-[#18181B]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingEvidence(false)}
                  className="px-3 py-1.5 text-xs text-[#78716C] hover:text-[#1C1917]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-white text-xs font-semibold rounded-xl"
                >
                  Save Evidence
                </button>
              </div>
            </form>
          )}

          {filteredEvidence.length === 0 ? (
            <div className="bg-[#FFFFFF] dark:bg-[#27231E] border border-[#18181B]/15 dark:border-white/15 rounded-2xl p-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-[#A8A29E] mx-auto" />
              <p className="font-serif text-sm font-bold text-[#1C1917] dark:text-[#EAE5DC]">No evidence items found</p>
              <p className="text-xs text-[#78716C] dark:text-[#B5ADA3]">
                Extract evidence and citations while reading to corroborate your claims.
              </p>
            </div>
          ) : (
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
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#78716C] font-mono">Strength: {ev.strength}</span>
                        <button
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="text-[#78716C] hover:text-rose-600 transition-colors"
                          title="Delete Evidence"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p
                      className={`font-serif text-xs italic text-[#292524] dark:text-[#DDD5C7] leading-relaxed pl-3 border-l-2 ${
                        ev.type === "counter" ? "border-rose-400" : "border-teal-600"
                      }`}
                    >
                      "{ev.quote}"
                    </p>

                    {ev.diagram && (
                      <div className="w-full h-16 bg-[#EAE4DA] dark:bg-[#1E1B18] rounded-lg border border-[#18181B]/15 dark:border-white/10 flex flex-col items-center justify-center p-2 text-center shadow-inner">
                        <span className="font-serif italic text-xs text-[#78716C]">
                          Diagram / Note: {ev.diagramLabel}
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
          )}
        </div>
      )}

      {/* DRAFT TAB */}
      {activeTab === "draft" && (
        <div className="max-w-3xl mx-auto w-full space-y-6 pt-6 pb-16">
          <div className="bg-[#FFFFFF] border border-[#E5DFD3] rounded-2xl p-8 shadow-2xs space-y-4">
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => handleDraftTitleChange(e.target.value)}
              placeholder="Draft Section Title..."
              className="font-serif text-2xl font-bold text-[#1C1917] w-full border-b border-transparent hover:border-[#E5DFD3] focus:border-[#18181B] focus:outline-none pb-1"
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#78716C] uppercase font-bold">
                <span>Working Draft (Auto-saved to SQLite)</span>
                <span>{draftWords} Words</span>
              </div>
              <textarea
                value={draftContent}
                onChange={(e) => handleDraftChange(e.target.value)}
                rows={14}
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
