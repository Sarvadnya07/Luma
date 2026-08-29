import React, { useState } from "react";
import { Book, Annotation, MatchCandidate } from "@luma/shared-types";
import { Button, Badge } from "@luma/ui";
import { ANNOTATION_HIGHLIGHT_COLORS } from "@luma/design-system";
import { LumaApi } from "../../lib/tauri";
import { useReaderStore } from "../../state/readerState";
import { AnnotationList } from "../annotations/AnnotationList";
import {
  ArrowLeft,
  Settings,
  Highlighter,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export interface ReaderViewProps {
  book: Book;
}

const SAMPLE_TEXT = `Chapter 1: The Principle of Architecture

In software engineering, local-first systems prioritize user ownership and data autonomy. When network partitions occur, the application continues to operate without interruption.

Annotation integrity is the cornerstone of any serious reading system. If a highlight drifts or attaches to the wrong sentence after font changes, reader trust is permanently broken.

Every highlight must maintain multiple anchor signals: exact text quote, surrounding prefix and suffix context, normalized character sequences, and format-specific coordinates.`;

export const ReaderView: React.FC<ReaderViewProps> = ({ book }) => {
  const setCurrentBook = useReaderStore((s) => s.setCurrentBook);
  const annotations = useReaderStore((s) => s.annotations);
  const addAnnotation = useReaderStore((s) => s.addAnnotation);

  const [fontSize, setFontSize] = useState<number>(18);
  const [lineHeight, setLineHeight] = useState<number>(1.7);
  const [fontFamily, setFontFamily] = useState<"serif" | "sans" | "mono">("serif");
  const [selectedText, setSelectedText] = useState<string>("");
  const [prefixContext, setPrefixContext] = useState<string>("");
  const [suffixContext, setSuffixContext] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>(ANNOTATION_HIGHLIGHT_COLORS[0].hex);
  const [resolvedMatch, setResolvedMatch] = useState<MatchCandidate | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text) return;

    const fullDoc = SAMPLE_TEXT;
    const idx = fullDoc.indexOf(text);
    if (idx !== -1) {
      const prefix = fullDoc.substring(Math.max(0, idx - 40), idx).trim();
      const suffix = fullDoc.substring(idx + text.length, Math.min(fullDoc.length, idx + text.length + 40)).trim();
      setSelectedText(text);
      setPrefixContext(prefix);
      setSuffixContext(suffix);
    } else {
      setSelectedText(text);
      setPrefixContext("");
      setSuffixContext("");
    }
  };

  const handleCreateHighlight = async () => {
    if (!selectedText) return;

    const newAnn: Annotation = {
      id: `ann_${Date.now()}`,
      book_id: book.id,
      annotation_type: "highlight",
      color_hex: selectedColor,
      quote: selectedText,
      note: null,
      anchor_payload_json: JSON.stringify({
        exact: selectedText,
        prefix: prefixContext,
        suffix: suffixContext,
      }),
      sync: {
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        device_id: "dev_local_primary",
        is_deleted: false,
      },
    };

    addAnnotation(newAnn);
    setStatusMessage(`Saved anchor for "${selectedText.slice(0, 30)}..."`);
    setSelectedText("");
  };

  const handleVerifyAnchor = async (ann: Annotation) => {
    try {
      const payload = JSON.parse(ann.anchor_payload_json);
      const res = await LumaApi.resolveAnchor(
        payload.exact,
        payload.prefix ?? null,
        payload.suffix ?? null,
        SAMPLE_TEXT
      );

      if (res.status === "highconfidence") {
        setResolvedMatch(res.data);
        setStatusMessage(`Anchor resolved with ${(res.data.confidence_score * 100).toFixed(1)}% confidence score`);
      } else if (res.status === "ambiguous") {
        setStatusMessage("Anchor is ambiguous across multiple locations");
      } else {
        setStatusMessage(`Anchor failed: ${res.data.reason}`);
      }
    } catch (e) {
      setStatusMessage(`Verification error: ${String(e)}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Header Bar */}
      <div className="h-14 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentBook(null)}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Library
          </Button>
          <span className="text-slate-600">|</span>
          <h2 className="text-sm font-medium text-slate-200 truncate max-w-md">
            {book.title}
          </h2>
        </div>

        {/* Reflow Controls Toolbar */}
        <div className="flex items-center gap-4 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/60">
          <Sliders className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">Size:</span>
            <input
              type="range"
              min="14"
              max="28"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20 accent-sky-400"
            />
            <span className="text-xs text-slate-300 w-6">{fontSize}px</span>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-700 pl-3">
            <span className="text-xs text-slate-400">Font:</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as "serif" | "sans" | "mono")}
              className="bg-slate-900 text-xs text-slate-200 rounded px-1.5 py-0.5 border border-slate-700"
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans</option>
              <option value="mono">Monospace</option>
            </select>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-700 pl-3">
            <span className="text-xs text-slate-400">Leading:</span>
            <input
              type="range"
              min="1.2"
              max="2.2"
              step="0.1"
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-16 accent-sky-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success">Phase 1 Spike Active</Badge>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Reading View */}
        <div className="flex-1 flex flex-col p-8 overflow-y-auto items-center">
          <div
            onMouseUp={handleTextSelection}
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
              fontFamily: fontFamily === "serif" ? "Georgia, Cambria, serif" : fontFamily === "mono" ? "monospace" : "sans-serif",
            }}
            className="max-w-2xl w-full p-8 bg-slate-900/40 border border-slate-800/80 rounded-2xl text-slate-200 select-text whitespace-pre-line shadow-lg"
          >
            {SAMPLE_TEXT}
          </div>

          {/* Selection Highlight Action Bar */}
          {selectedText && (
            <div className="mt-4 p-3 bg-slate-900 border border-sky-500/40 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs text-slate-400 font-medium">Highlight:</span>
              <div className="flex items-center gap-1.5">
                {ANNOTATION_HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setSelectedColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                      selectedColor === c.hex ? "scale-125 border-white" : "border-transparent"
                    }`}
                  />
                ))}
              </div>
              <Button size="sm" variant="primary" onClick={handleCreateHighlight}>
                <Highlighter className="w-3.5 h-3.5 mr-1" />
                Create Anchor
              </Button>
            </div>
          )}

          {/* Status / Anchor Verification Banner */}
          {statusMessage && (
            <div className="mt-4 px-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-sky-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {statusMessage}
            </div>
          )}
        </div>

        {/* Sidebar: Annotations & Resilience Inspector */}
        <div className="w-80 border-l border-slate-800 bg-slate-900/30 flex flex-col">
          <AnnotationList
            annotations={annotations}
            onJumpTo={handleVerifyAnchor}
          />
        </div>
      </div>
    </div>
  );
};
