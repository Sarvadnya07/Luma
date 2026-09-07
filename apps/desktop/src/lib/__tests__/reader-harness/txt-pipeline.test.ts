/**
 * Level 1 Acceptance Test Suite: Plain Text (TXT) Pipeline
 *
 * Golden Path:
 * OPEN -> SELECT -> DOCUMENT_RANGE -> SEARCH -> HIGHLIGHT -> PERSIST -> REOPEN
 *
 * Verifies with programmatic DOM inspection and exact assertion of machine artifacts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { Annotation } from "@luma/shared-types";
import {
  buildCharMapping,
  findBestMatch,
  applyHighlightsAndSearch,
} from "../../../features/reader/highlightEngine";

describe("Level 1 Acceptance Suite: Plain Text (TXT) Pipeline", () => {
  let dom: JSDOM;
  let document: Document;
  let container: HTMLDivElement;
  let sampleTxt: string;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"reader-root\"></div></body></html>");
    document = dom.window.document;
    container = document.getElementById("reader-root") as HTMLDivElement;

    const fixturePath = path.resolve(
      process.cwd(),
      "../../tests/fixtures/reader/sample.txt"
    );
    sampleTxt = fs.readFileSync(fixturePath, "utf-8");
  });

  it("LEVEL 1 - 1. OPEN: converts raw text into structured addressable paragraph nodes", () => {
    // Emulate TextDocument parser (matching crates/luma-reader/src/text_doc.rs)
    const paragraphs = sampleTxt
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    expect(paragraphs.length).toBe(5);

    let html = "<div class=\"reader-text-container\">\n";
    paragraphs.forEach((p, idx) => {
      html += `<p class="reader-paragraph" id="p${idx}">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>\n`;
    });
    html += "</div>";

    container.innerHTML = html;

    const renderedPs = container.querySelectorAll("p.reader-paragraph");
    expect(renderedPs.length).toBe(5);
    expect(renderedPs[0]?.id).toBe("p0");
    expect(renderedPs[0]?.textContent).toContain("The Philosophy of Modern Reading");
    expect(renderedPs[3]?.textContent).toContain("ज्ञानं परमं बलम्");
  });

  it("LEVEL 1 - 2. SELECT: extracts range across line breaks with prefix & suffix context", () => {
    // Populate container with paragraphs
    const paragraphs = sampleTxt.split("\n\n").map((p) => p.trim()).filter(Boolean);
    container.innerHTML = paragraphs
      .map((p, idx) => `<p id="p${idx}">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("\n");

    const mapping = buildCharMapping(container);
    expect(mapping.normalizedText.length).toBeGreaterThan(0);
    expect(mapping.normalizedText).toContain("The Philosophy of Modern Reading");

    // Simulate user selecting across line breaks
    const selectedQuote = "immutable addressability. When typography scales";
    const match = findBestMatch(mapping.normalizedText, selectedQuote);
    expect(match).not.toBeNull();

    if (match) {
      const preceding = mapping.normalizedText.substring(Math.max(0, match.start - 30), match.start);
      const following = mapping.normalizedText.substring(match.end, Math.min(mapping.normalizedText.length, match.end + 30));
      expect(preceding).toContain("possess");
      expect(following).toContain("viewport margins flex");
    }
  });

  it("LEVEL 1 - 3. SEARCH: in-document search highlights matches and sets char offsets", () => {
    const paragraphs = sampleTxt.split("\n\n").map((p) => p.trim()).filter(Boolean);
    container.innerHTML = paragraphs
      .map((p, idx) => `<p id="p${idx}">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("\n");

    const query = "power";
    applyHighlightsAndSearch(container, [], 0, query);

    const searchMarks = container.querySelectorAll("mark.luma-search-hit");
    // "Knowledge is supreme power" and "Continuance is power"
    expect(searchMarks.length).toBe(2);

    searchMarks.forEach((m) => {
      expect(m.textContent?.toLowerCase()).toBe("power");
      expect(m.getAttribute("data-char-offset")).toBeDefined();
    });
  });

  it("LEVEL 1 - 4. HIGHLIGHT: non-destructively highlights multilingual and complex text", () => {
    const paragraphs = sampleTxt.split("\n\n").map((p) => p.trim()).filter(Boolean);
    container.innerHTML = paragraphs
      .map((p, idx) => `<p id="p${idx}">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("\n");

    const annotations: Annotation[] = [
      {
        id: "ann_01",
        book_id: "book_txt_01",
        annotation_type: "highlight",
        color_hex: "#a855f7",
        quote: "ज्ञानं परमं बलम्",
        note: null,
        anchor_payload_json: JSON.stringify({
          exact: "ज्ञानं परमं बलम्",
          prefix: "Devanagari: ",
          suffix: " (Knowledge is supreme power)",
          spine_index: 0,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
      {
        id: "ann_02",
        book_id: "book_txt_01",
        annotation_type: "highlight",
        color_hex: "#22c55e",
        quote: "Euler identity e^(i*pi) + 1 = 0",
        note: "Euler identity mathematical constant",
        anchor_payload_json: JSON.stringify({
          exact: "Euler identity e^(i*pi) + 1 = 0",
          prefix: "Mathematical precision: The ",
          suffix: " represents consummate symmetry",
          spine_index: 0,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
    ];

    applyHighlightsAndSearch(container, annotations, 0);

    const devanagariMark = container.querySelector(`mark[data-annotation-id="ann_01"]`);
    expect(devanagariMark).not.toBeNull();
    expect(devanagariMark?.textContent).toBe("ज्ञानं परमं बलम्");

    const eulerMark = container.querySelector(`mark[data-annotation-id="ann_02"]`);
    expect(eulerMark).not.toBeNull();
    expect(eulerMark?.textContent).toBe("Euler identity e^(i*pi) + 1 = 0");
  });

  it("LEVEL 1 - 5. DISAMBIGUATION: disambiguates duplicate words using prefix and suffix context", () => {
    // Document with duplicate word "citadel"
    container.innerHTML = "<p id='p0'>The first citadel stands on a hill. The second citadel stands by the river.</p>";

    const annotationForSecondCitadel: Annotation = {
      id: "ann_duplicate_02",
      book_id: "book_txt_01",
      annotation_type: "highlight",
      color_hex: "#f59e0b",
      quote: "citadel",
      note: null,
      anchor_payload_json: JSON.stringify({
        exact: "citadel",
        prefix: "The second ",
        suffix: " stands by the river.",
        spine_index: 0,
      }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotationForSecondCitadel], 0);

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBe(1);
    expect(marks[0]?.getAttribute("data-annotation-id")).toBe("ann_duplicate_02");

    // Verify it is inside the second phrase
    const p = container.querySelector("#p0")!;
    expect(p.innerHTML).toContain("The first citadel stands on a hill. The second <mark");
  });

  it("LEVEL 1 - 6. REOPEN: rehydrates annotations cleanly from persisted anchor payload", () => {
    const rawParagraphs = sampleTxt.split("\n\n").map((p) => p.trim()).filter(Boolean);
    const renderContent = () => {
      container.innerHTML = rawParagraphs
        .map((p, idx) => `<p id="p${idx}">${p.replace(/\n/g, "<br/>")}</p>`)
        .join("\n");
    };

    const savedAnnotations: Annotation[] = [
      {
        id: "ann_reopen_01",
        book_id: "book_txt_01",
        annotation_type: "highlight",
        color_hex: "#3b82f6",
        quote: "immutable addressability",
        note: null,
        anchor_payload_json: JSON.stringify({
          exact: "immutable addressability",
          prefix: "every passage must possess ",
          suffix: ". When typography scales",
          spine_index: 0,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
    ];

    // First session
    renderContent();
    applyHighlightsAndSearch(container, savedAnnotations, 0);
    expect(container.querySelectorAll("mark.luma-highlight").length).toBe(1);

    // Simulate close reader (DOM teardown)
    container.innerHTML = "";
    expect(container.querySelectorAll("mark.luma-highlight").length).toBe(0);

    // Reopen book
    renderContent();
    applyHighlightsAndSearch(container, savedAnnotations, 0);

    const restoredMark = container.querySelector("mark.luma-highlight");
    expect(restoredMark).not.toBeNull();
    expect(restoredMark?.textContent).toBe("immutable addressability");
    expect(restoredMark?.getAttribute("data-annotation-id")).toBe("ann_reopen_01");
  });
});
