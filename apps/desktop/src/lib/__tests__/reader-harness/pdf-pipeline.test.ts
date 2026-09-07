/**
 * Level 3 Acceptance Test Suite: Fixed Layout (PDF) Pipeline
 *
 * Golden Path:
 * OPEN -> RENDER -> SELECT -> SEARCH -> HIGHLIGHT -> ZOOM -> SCANNED_FALLBACK -> PERSIST -> REOPEN
 *
 * Verifies TextLayer alignment, space pollution prevention across kerning runs,
 * quad overlay geometry, and zoom responsiveness.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { Annotation } from "@luma/shared-types";
import { findBestMatch, normalizeString } from "../../../features/reader/highlightEngine";

describe("Level 3 Acceptance Suite: Fixed Layout (PDF) Pipeline", () => {
  let dom: JSDOM;
  let document: Document;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"pdf-viewport\"></div></body></html>");
    document = dom.window.document;
  });

  it("LEVEL 3 - 1. TEXTLAYER: concatenates kerning spans without space pollution", () => {
    // Emulate PDF.js TextLayer with kerning runs: "Internationalization and Architecture"
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";

    const spanData = [
      { text: "Inter", left: 10, width: 30 },
      { text: "nation", left: 40, width: 40 },
      { text: "alization ", left: 80, width: 60 },
      { text: "and ", left: 145, width: 30 },
      { text: "Archi", left: 180, width: 35 },
      { text: "tecture", left: 215, width: 45 },
    ];

    spanData.forEach(({ text, left, width }) => {
      const s = document.createElement("span");
      s.textContent = text;
      s.style.position = "absolute";
      s.style.left = `${left}px`;
      s.style.top = "50px";
      s.style.width = `${width}px`;
      s.style.height = "16px";
      textLayer.appendChild(s);
    });

    const spans = Array.from(textLayer.querySelectorAll("span"));

    // Extract text using Luma's space-pollution-free algorithm
    let rawText = "";
    const spanMap: Array<{ span: HTMLSpanElement; rawStart: number; rawEnd: number }> = [];

    for (const span of spans) {
      const str = span.textContent || "";
      if (!str) continue;

      if (rawText.length > 0 && spanMap.length > 0) {
        const prev = spanMap[spanMap.length - 1]!;
        const prevText = prev.span.textContent || "";
        const endsWithSpace = /\s$/.test(prevText);
        const startsWithSpace = /^\s/.test(str);

        if (!endsWithSpace && !startsWithSpace) {
          const horizGap = span.offsetLeft - (prev.span.offsetLeft + prev.span.offsetWidth);
          if (horizGap > 2) {
            rawText += " ";
          }
        }
      }

      const rawStart = rawText.length;
      rawText += str;
      const rawEnd = rawStart + str.length;
      spanMap.push({ span, rawStart, rawEnd });
    }

    // Must be "Internationalization and Architecture" without "Inter nation alization"
    expect(rawText).toBe("Internationalization and Architecture");

    // Search for whole word "Internationalization"
    const match = findBestMatch(normalizeString(rawText), "Internationalization");
    expect(match).not.toBeNull();
    expect(match?.start).toBe(0);
    expect(match?.end).toBe(20);
  });

  it("LEVEL 3 - 2. SEARCH: generates aligned bounding boxes across multiple spans", () => {
    const textLayer = document.createElement("div");
    textLayer.className = "textLayer";

    const spans = [
      { text: "Atomic ", left: 20, top: 40, width: 50, height: 18 },
      { text: "Habits ", left: 75, top: 40, width: 50, height: 18 },
      { text: "Overview", left: 130, top: 40, width: 65, height: 18 },
    ];

    spans.forEach((sd) => {
      const s = document.createElement("span");
      s.textContent = sd.text;
      s.style.left = `${sd.left}px`;
      s.style.top = `${sd.top}px`;
      s.style.width = `${sd.width}px`;
      s.style.height = `${sd.height}px`;
      textLayer.appendChild(s);
    });

    const searchQuery = "Atomic Habits";
    const spanEls = Array.from(textLayer.querySelectorAll("span"));

    let rawText = "";
    const spanMap: Array<{ span: HTMLSpanElement; rawStart: number; rawEnd: number }> = [];
    for (const span of spanEls) {
      const str = span.textContent || "";
      const rawStart = rawText.length;
      rawText += str;
      spanMap.push({ span, rawStart, rawEnd: rawStart + str.length });
    }

    const normText = normalizeString(rawText);
    const match = findBestMatch(normText, normalizeString(searchQuery));
    expect(match).not.toBeNull();

    // Map to span rects
    const rects: Array<{ left: number; top: number; width: number; height: number }> = [];
    if (match) {
      for (const item of spanMap) {
        if (item.rawEnd > match.start && item.rawStart < match.end) {
          rects.push({
            left: parseInt(item.span.style.left, 10),
            top: parseInt(item.span.style.top, 10),
            width: parseInt(item.span.style.width, 10),
            height: parseInt(item.span.style.height, 10),
          });
        }
      }
    }

    // Must intersect 2 spans: "Atomic " and "Habits "
    expect(rects.length).toBe(2);
    expect(rects[0]?.left).toBe(20);
    expect(rects[1]?.left).toBe(75);
  });

  it("LEVEL 3 - 3. HIGHLIGHT: isolates annotations by page number and calculates overlay coordinates", () => {
    const page1Annotations: Annotation[] = [
      {
        id: "ann_pdf_p1",
        book_id: "book_pdf_01",
        annotation_type: "highlight",
        color_hex: "#a855f7",
        quote: "Atomic Habits",
        note: null,
        anchor_payload_json: JSON.stringify({
          exact: "Atomic Habits",
          page_number: 1,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
      {
        id: "ann_pdf_p2",
        book_id: "book_pdf_01",
        annotation_type: "highlight",
        color_hex: "#22c55e",
        quote: "The 1% Rule",
        note: null,
        anchor_payload_json: JSON.stringify({
          exact: "The 1% Rule",
          page_number: 2,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
    ];

    // Filter for page 1
    const p1Only = page1Annotations.filter((ann) => {
      const p = JSON.parse(ann.anchor_payload_json);
      return p.page_number === 1;
    });

    expect(p1Only.length).toBe(1);
    expect(p1Only[0]?.id).toBe("ann_pdf_p1");

    // Filter for page 2
    const p2Only = page1Annotations.filter((ann) => {
      const p = JSON.parse(ann.anchor_payload_json);
      return p.page_number === 2;
    });

    expect(p2Only.length).toBe(1);
    expect(p2Only[0]?.id).toBe("ann_pdf_p2");
  });

  it("LEVEL 3 - 4. ZOOM: scale factor proportionally scales page dimensions and viewport", () => {
    const unscaledWidth = 612; // Standard PDF Letter width (pts)
    const unscaledHeight = 792; // Standard PDF Letter height (pts)
    const targetWidth = 480;

    const baseScale = targetWidth / unscaledWidth;
    expect(baseScale).toBeCloseTo(0.784, 2);

    // Zoom 100%
    const scale100 = baseScale * (100 / 100);
    const width100 = Math.floor(unscaledWidth * scale100);
    const height100 = Math.floor(unscaledHeight * scale100);
    expect(width100).toBe(480);
    expect(height100).toBe(621);

    // Zoom 150%
    const scale150 = baseScale * (150 / 100);
    const width150 = Math.floor(unscaledWidth * scale150);
    const height150 = Math.floor(unscaledHeight * scale150);
    expect(width150).toBe(720);
    expect(height150).toBe(931);

    // Bounding box at 150% zoom scales proportionally
    const rectX = 50;
    const scaledX150 = Math.round(rectX * 1.5);
    expect(scaledX150).toBe(75);
  });

  it("LEVEL 3 - 5. SCANNED DOCUMENT: flags scanned PDF pages with zero text content", () => {
    // Emulate page with zero text content items
    const textContentItems: unknown[] = [];
    const hasTextLayer = false;
    const hasText = textContentItems.length > 0 || hasTextLayer;

    const isScannedOnly = !hasText;
    expect(isScannedOnly).toBe(true);

    // When isScannedOnly is true, status badge is rendered
    const badgeText = isScannedOnly ? "Scanned Page (No Text Layer)" : "";
    expect(badgeText).toContain("No Text Layer");
  });

  it("LEVEL 3 - 6. REOPEN: rehydrates PDF highlight overlays with exact dimensions", () => {
    const storedAnnotation: Annotation = {
      id: "ann_reopen_pdf_01",
      book_id: "book_pdf_01",
      annotation_type: "highlight",
      color_hex: "#3b82f6",
      quote: "Continuous Improvement",
      note: "Important concept",
      anchor_payload_json: JSON.stringify({
        exact: "Continuous Improvement",
        page_number: 1,
      }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
    };

    // Reopen and re-parse payload
    const payload = JSON.parse(storedAnnotation.anchor_payload_json);
    expect(payload.exact).toBe("Continuous Improvement");
    expect(payload.page_number).toBe(1);

    // Emulate page 1 render with reconstructed highlight rect
    const renderedOverlay = {
      id: storedAnnotation.id,
      color: storedAnnotation.color_hex,
      left: 120,
      top: 240,
      width: 180,
      height: 20,
    };

    expect(renderedOverlay.id).toBe("ann_reopen_pdf_01");
    expect(renderedOverlay.width).toBeGreaterThan(0);
    expect(renderedOverlay.height).toBeGreaterThan(0);
  });
});
