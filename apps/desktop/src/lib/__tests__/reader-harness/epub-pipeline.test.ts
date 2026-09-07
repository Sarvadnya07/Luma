/**
 * Level 2 Acceptance Test Suite: Reflowable Documents (EPUB) Pipeline
 *
 * Golden Path:
 * OPEN -> SELECT -> SEARCH -> HIGHLIGHT -> TYPOGRAPHY -> PERSIST -> REOPEN
 *
 * Verifies cross-node inline tag spanning, whitespace collapsing, typography isolation,
 * and exact rehydration without DOM damage.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { Annotation } from "@luma/shared-types";
import {
  buildCharMapping,
  findBestMatch,
  applyHighlightsAndSearch,
} from "../../../features/reader/highlightEngine";

describe("Level 2 Acceptance Suite: Reflowable Documents (EPUB) Pipeline", () => {
  let dom: JSDOM;
  let document: Document;
  let container: HTMLDivElement;

  // Realistic publisher EPUB chapter HTML containing nested markup, whitespace, and code blocks
  const sampleEpubChapterHtml = `
    <section class="chapter" id="ch1">
      <h1 class="chapter-title">Chapter 1: The Resilient Reader</h1>
      <p class="paragraph" id="p1">
        In reflowable document engineering, <em>inline semantic elements</em> such as
        <strong>strong emphasis</strong>, <a href="#ref1">cross-references</a>, and
        <code>code literals</code> must coexist seamlessly with annotation overlays.
      </p>
      <blockquote id="b1">
        "Knowledge that cannot be accurately cited or highlighted is knowledge half-lost."
      </blockquote>
      <p class="paragraph" id="p2">
        When an author writes with    irregular \t indentation
        and multi-line \n paragraph breaks, the canonical model must preserve
        addressability without suffering anchor drift.
      </p>
      <div class="code-block-container">
        <pre><code class="language-rust">fn calculate_hash(doc: &Document) -> IntegrityDigest {
    doc.compute_blake3_hash()
}</code></pre>
      </div>
    </section>
  `;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"epub-viewport\"></div></body></html>");
    document = dom.window.document;
    container = document.getElementById("epub-viewport") as HTMLDivElement;
    container.innerHTML = sampleEpubChapterHtml;
  });

  it("LEVEL 2 - 1. OPEN: renders reflowable markup hierarchy without corruption", () => {
    expect(container.querySelector("h1.chapter-title")?.textContent).toBe(
      "Chapter 1: The Resilient Reader"
    );
    expect(container.querySelectorAll("p.paragraph").length).toBe(2);
    expect(container.querySelector("blockquote")?.textContent).toContain("half-lost");
    expect(container.querySelector("pre code")?.textContent).toContain("calculate_hash");
  });

  it("LEVEL 2 - 2. SELECT: accurately maps text across nested tags (em, strong, a, code)", () => {
    const mapping = buildCharMapping(container);

    // Phrase that spans across <em> and <strong>:
    // "inline semantic elements such as strong emphasis"
    const targetPhrase = "inline semantic elements such as strong emphasis";
    const match = findBestMatch(mapping.normalizedText, targetPhrase);

    expect(match).not.toBeNull();
    if (match) {
      const rawStart = mapping.normToRawStart[match.start];
      const rawEnd = mapping.normToRawEnd[match.end - 1];
      expect(rawStart).toBeDefined();
      expect(rawEnd).toBeDefined();
      expect(rawEnd!).toBeGreaterThan(rawStart!);
    }
  });

  it("LEVEL 2 - 3. SEARCH: in-document search matches phrase spanning nested markup", () => {
    // Search for "strong emphasis" which is inside <strong>
    applyHighlightsAndSearch(container, [], 0, "strong emphasis");

    const searchMarks = container.querySelectorAll("mark.luma-search-hit");
    expect(searchMarks.length).toBe(1);
    expect(searchMarks[0]?.textContent).toBe("strong emphasis");
    expect(searchMarks[0]?.parentElement?.tagName.toLowerCase()).toBe("strong");
  });

  it("LEVEL 2 - 4. HIGHLIGHT: non-destructively wraps cross-tag ranges", () => {
    const crossTagAnnotation: Annotation = {
      id: "ann_cross_01",
      book_id: "book_epub_01",
      annotation_type: "highlight",
      color_hex: "#38bdf8",
      quote: "inline semantic elements such as strong emphasis",
      note: "Cross-tag range verification",
      anchor_payload_json: JSON.stringify({
        exact: "inline semantic elements such as strong emphasis",
        prefix: "In reflowable document engineering, ",
        suffix: ", cross-references",
        spine_index: 0,
      }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [crossTagAnnotation], 0);

    const marks = container.querySelectorAll("mark.luma-highlight");
    // Because it crosses from <em> to raw text to <strong>, it creates marks for each intersecting node segment
    expect(marks.length).toBeGreaterThanOrEqual(1);

    // Verify all marks share the annotation ID
    marks.forEach((m) => {
      expect(m.getAttribute("data-annotation-id")).toBe("ann_cross_01");
    });

    // Verify combined text across the marks matches the original quote
    const combinedText = Array.from(marks)
      .map((m) => m.textContent)
      .join("")
      .replace(/\s+/g, " ");
    expect(combinedText).toContain("inline semantic elements");
    expect(combinedText).toContain("strong emphasis");

    // Verify surrounding elements are intact
    expect(container.querySelector("pre code")?.textContent).toContain("calculate_hash");
    expect(container.querySelector("blockquote")?.textContent).toContain("half-lost");
  });

  it("LEVEL 2 - 5. WHITESPACE RESILIENCY: matches across publisher tabs and newlines", () => {
    // In p2, text is "irregular \t indentation\n and multi-line \n paragraph breaks"
    const whitespaceAnnotation: Annotation = {
      id: "ann_ws_01",
      book_id: "book_epub_01",
      annotation_type: "highlight",
      color_hex: "#facc15",
      quote: "irregular indentation and multi-line paragraph breaks",
      note: "Whitespace resilience",
      anchor_payload_json: JSON.stringify({
        exact: "irregular indentation and multi-line paragraph breaks",
        prefix: "When an author writes with ",
        suffix: ", the canonical model",
        spine_index: 0,
      }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [whitespaceAnnotation], 0);

    const mark = container.querySelector("mark[data-annotation-id='ann_ws_01']");
    expect(mark).not.toBeNull();
    expect(mark?.textContent?.replace(/\s+/g, " ")).toContain(
      "irregular indentation and multi-line paragraph breaks"
    );
  });

  it("LEVEL 2 - 6. TYPOGRAPHY: verifies styles and typography isolation", () => {
    // Apply styling container similar to EpubReaderView
    const wrapper = document.createElement("div");
    wrapper.className = "prose-reader";
    wrapper.style.fontSize = "20px";
    wrapper.style.lineHeight = "1.8";
    wrapper.style.fontFamily = 'Lora, Georgia, serif';

    // Move content into wrapper
    wrapper.innerHTML = container.innerHTML;
    container.innerHTML = "";
    container.appendChild(wrapper);

    // Apply annotation
    const ann: Annotation = {
      id: "ann_typo_01",
      book_id: "book_epub_01",
      annotation_type: "highlight",
      color_hex: "#ec4899",
      quote: "knowledge half-lost",
      note: null,
      anchor_payload_json: JSON.stringify({
        exact: "knowledge half-lost",
        prefix: "is ",
        suffix: ".",
        spine_index: 0,
      }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [ann], 0);

    const mark = container.querySelector("mark[data-annotation-id='ann_typo_01']");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe("knowledge half-lost");

    // Mutate typography: change font size to 24px and sans font
    wrapper.style.fontSize = "24px";
    wrapper.style.fontFamily = "Inter, sans-serif";

    // Re-verify mark is undisturbed
    const markAfterTypo = container.querySelector("mark[data-annotation-id='ann_typo_01']");
    expect(markAfterTypo).not.toBeNull();
    expect(markAfterTypo?.textContent).toBe("knowledge half-lost");
  });

  it("LEVEL 2 - 7. REOPEN: teardown and rehydration preserves all annotations", () => {
    const annotations: Annotation[] = [
      {
        id: "ann_reopen_epub_01",
        book_id: "book_epub_01",
        annotation_type: "highlight",
        color_hex: "#10b981",
        quote: "Resilient Reader",
        note: "Title highlight",
        anchor_payload_json: JSON.stringify({
          exact: "Resilient Reader",
          prefix: "Chapter 1: The ",
          suffix: "",
          spine_index: 0,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
      {
        id: "ann_reopen_epub_02",
        book_id: "book_epub_01",
        annotation_type: "highlight",
        color_hex: "#6366f1",
        quote: "calculate_hash",
        note: "Code highlight",
        anchor_payload_json: JSON.stringify({
          exact: "calculate_hash",
          prefix: "fn ",
          suffix: "(doc: &Document)",
          spine_index: 0,
        }),
        sync: { version: 1, created_at: "", updated_at: "", device_id: "dev1", is_deleted: false },
      },
    ];

    // Initial render & apply
    applyHighlightsAndSearch(container, annotations, 0);
    expect(container.querySelectorAll("mark.luma-highlight").length).toBe(2);

    // Teardown
    container.innerHTML = "";
    expect(container.querySelectorAll("mark.luma-highlight").length).toBe(0);

    // Reopen
    container.innerHTML = sampleEpubChapterHtml;
    applyHighlightsAndSearch(container, annotations, 0);

    const titleMark = container.querySelector("mark[data-annotation-id='ann_reopen_epub_01']");
    const codeMark = container.querySelector("mark[data-annotation-id='ann_reopen_epub_02']");

    expect(titleMark?.textContent).toBe("Resilient Reader");
    expect(codeMark?.textContent).toBe("calculate_hash");
  });
});
