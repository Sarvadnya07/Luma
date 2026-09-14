/**
 * Logic tests for EPUB DOM Range Selection and Highlight Rendering
 * 
 * Verifies all 11 required test cases:
 * 1. same text node
 * 2. cross text node
 * 3. <em>text</em> + normal text
 * 4. <strong>text</strong>
 * 5. nested inline elements
 * 6. selection crossing wrapped lines
 * 7. selection ending at offset 0
 * 8. selection starting at text-node end
 * 9. Unicode text
 * 10. Emoji text (surrogate pairs)
 * 11. RTL text (Hebrew and Arabic)
 */

import { describe, expect, it, beforeEach } from "vitest";
import { JSDOM } from "jsdom";
import { Annotation } from "@luma/shared-types";
import {
  applyHighlightsAndSearch,
  serializeRangeToDocumentRange,
  resolveDocumentRangeToDomRange,
  highlightDomRange,
} from "../../../features/reader/highlightEngine";

describe("EPUB DOM Range Highlight Rendering Engine", () => {
  let dom: JSDOM;
  let document: Document;
  let container: HTMLElement;

  beforeEach(() => {
    dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"reader-root\"></div></body></html>");
    document = dom.window.document;
    container = document.getElementById("reader-root")!;
  });

  // 1. Same text node
  it("Test 1: same text node selection and highlighting", () => {
    container.innerHTML = "<p id=\"p1\">The quick brown fox jumps over the lazy dog.</p>";
    const p = container.querySelector("#p1")!;
    const textNode = p.firstChild as Text;

    // Select "brown fox"
    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 19);
    expect(range.toString()).toBe("brown fox");

    // Serialize to canonical DocumentRange
    const docRange = serializeRangeToDocumentRange(container, range, 0);
    expect(docRange.start.char_offset).toBe(10);
    expect(docRange.end.char_offset).toBe(19);
    expect(docRange.text_snippet).toBe("brown fox");

    // Resolve back to DOM Range
    const resolved = resolveDocumentRangeToDomRange(container, docRange);
    expect(resolved).not.toBeNull();
    expect(resolved!.toString()).toBe("brown fox");

    // Render highlight
    const annotation: Annotation = {
      id: "ann-1",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#FDE68A",
      quote: "brown fox",
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe("brown fox");
    expect(marks[0]?.getAttribute("data-annotation-id")).toBe("ann-1");
    expect(container.textContent).toBe("The quick brown fox jumps over the lazy dog.");
  });

  // 2. Cross text node
  it("Test 2: cross text node selection", () => {
    container.innerHTML = "<p id=\"p2\"></p>";
    const p = container.querySelector("#p2")!;
    const t1 = document.createTextNode("Part one of text. ");
    const t2 = document.createTextNode("Part two of text.");
    p.appendChild(t1);
    p.appendChild(t2);

    // Select across t1 and t2: "one of text. Part two"
    const range = document.createRange();
    range.setStart(t1, 5);
    range.setEnd(t2, 8);
    expect(range.toString()).toBe("one of text. Part two");

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const resolved = resolveDocumentRangeToDomRange(container, docRange);
    expect(resolved).not.toBeNull();
    expect(resolved!.toString()).toBe("one of text. Part two");

    const annotation: Annotation = {
      id: "ann-2",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#A7F3D0",
      quote: "one of text. Part two",
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBe(2);
    expect(marks[0]?.textContent).toBe("one of text. ");
    expect(marks[1]?.textContent).toBe("Part two");
    expect(Array.from(marks).map(m => m.textContent).join("")).toBe("one of text. Part two");
  });

  // 3. <em>text</em> + normal text
  it("Test 3: <em>text</em> + normal text preserves inline markup", () => {
    container.innerHTML = "<p id=\"p3\">The <em>great</em> Gatsby was published in 1925.</p>";
    const em = container.querySelector("em")!;
    const emText = em.firstChild as Text;
    const afterText = em.nextSibling as Text;

    // Select "great Gatsby" (spans inside <em> and after <em>)
    const range = document.createRange();
    range.setStart(emText, 0);
    range.setEnd(afterText, 7);
    expect(range.toString()).toBe("great Gatsby");

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-3",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#BAE6FD",
      quote: "great Gatsby",
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    // Verify <em> tag is intact and NOT removed or corrupted
    const emAfter = container.querySelector("em");
    expect(emAfter).not.toBeNull();
    expect(emAfter?.querySelector("mark.luma-highlight")?.textContent).toBe("great");

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBe(2);
    expect(marks[0]?.textContent).toBe("great");
    expect(marks[1]?.textContent).toBe(" Gatsby");
    expect(container.textContent).toBe("The great Gatsby was published in 1925.");
  });

  // 4. <strong>text</strong>
  it("Test 4: <strong>text</strong> partial selection preserves semantic element", () => {
    container.innerHTML = "<p id=\"p4\">This is <strong>strongly typed</strong> software.</p>";
    const strong = container.querySelector("strong")!;
    const strongText = strong.firstChild as Text;

    // Select "strongly"
    const range = document.createRange();
    range.setStart(strongText, 0);
    range.setEnd(strongText, 8);
    expect(range.toString()).toBe("strongly");

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-4",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#FBCFE8",
      quote: "strongly",
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const strongAfter = container.querySelector("strong");
    expect(strongAfter).not.toBeNull();
    const markInsideStrong = strongAfter?.querySelector("mark.luma-highlight");
    expect(markInsideStrong?.textContent).toBe("strongly");
    expect(strongAfter?.textContent).toBe("strongly typed");
  });

  // 5. Nested inline elements
  it("Test 5: nested inline elements (span > em > strong)", () => {
    container.innerHTML =
      "<p id=\"p5\">Alpha <span class=\"wrapper\">level 1 <em>level 2 <strong>level 3 bold</strong> end 2</em> end 1</span> Omega</p>";
    const strong = container.querySelector("strong")!;
    const strongText = strong.firstChild as Text;
    const p = container.querySelector("#p5")!;
    const firstText = p.firstChild as Text;

    // Select from "pha " in first text node down into "level 3" in deeply nested strong
    const range = document.createRange();
    range.setStart(firstText, 2); // "pha "
    range.setEnd(strongText, 7); // "level 3"
    expect(range.toString()).toBe("pha level 1 level 2 level 3");

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-5",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#E9D5FF",
      quote: range.toString(),
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    // Verify all nested elements still exist
    expect(container.querySelector("span.wrapper")).not.toBeNull();
    expect(container.querySelector("em")).not.toBeNull();
    expect(container.querySelector("strong")).not.toBeNull();

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBeGreaterThanOrEqual(4);
    const combined = Array.from(marks).map(m => m.textContent).join("");
    expect(combined).toBe("pha level 1 level 2 level 3");
  });

  // 6. Selection crossing wrapped lines
  it("Test 6: multi-line selection preserves text geometry without padding shifts", () => {
    container.innerHTML =
      "<div id=\"ch\"><p>First line of paragraph that wraps over multiple lines in the reader view.</p></div>";
    const p = container.querySelector("p")!;
    const textNode = p.firstChild as Text;

    // Select across multiple words
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 57);
    const selected = "line of paragraph that wraps over multiple lines in";
    expect(range.toString()).toBe(selected);

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-6",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#FDE68A",
      quote: selected,
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const mark = container.querySelector("mark.luma-highlight") as HTMLElement;
    expect(mark).not.toBeNull();
    expect(mark.textContent).toBe(selected);
    // Mark must have zero padding and margin to prevent layout reflow
    expect(mark.style.padding).toBe("0px");
    expect(mark.style.margin).toBe("0px");
    expect(mark.style.borderStyle === "none" || mark.style.border === "none" || mark.style.borderWidth === "0px").toBe(true);
  });

  // 7. Selection ending at offset 0
  it("Test 7: selection ending at offset 0 of next node does not create empty mark", () => {
    container.innerHTML = "<p id=\"pA\">First block.</p><p id=\"pB\">Second block.</p>";
    const pA = container.querySelector("#pA")!;
    const pB = container.querySelector("#pB")!;
    const textA = pA.firstChild as Text;
    const textB = pB.firstChild as Text;

    // Range ends at offset 0 of textB
    const range = document.createRange();
    range.setStart(textA, 6); // "block."
    range.setEnd(textB, 0);
    expect(range.toString()).toBe("block.");

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-7",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#FDE68A",
      quote: "block.",
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe("block.");
    expect(pB.querySelector("mark")).toBeNull(); // No empty mark in second block
  });

  // 8. Selection starting at text-node end
  it("Test 8: selection starting at text-node end offset does not create empty mark", () => {
    container.innerHTML = "<p id=\"p8\"></p>";
    const p = container.querySelector("#p8")!;
    const t1 = document.createTextNode("Prefix.");
    const t2 = document.createTextNode(" Target text.");
    p.appendChild(t1);
    p.appendChild(t2);

    // Range starts at end of t1 (offset = t1.length = 7)
    const range = document.createRange();
    range.setStart(t1, 7);
    range.setEnd(t2, 7);
    expect(range.toString()).toBe(" Target");

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-8",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#FDE68A",
      quote: " Target",
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const marks = container.querySelectorAll("mark.luma-highlight");
    expect(marks.length).toBe(1);
    expect(marks[0]?.textContent).toBe(" Target");
  });

  // 9. Unicode text
  it("Test 9: Unicode text (accents, French, German, CJK)", () => {
    const unicodeText = "Café au lait à Paris. Das Maß aller Dinge. 東京の夜は美しい。";
    container.innerHTML = `<p id="p9">${unicodeText}</p>`;
    const p = container.querySelector("#p9")!;
    const textNode = p.firstChild as Text;

    // Select "lait à Paris. Das Maß aller Dinge. 東京"
    const startIdx = unicodeText.indexOf("lait");
    const endIdx = unicodeText.indexOf("の夜");
    const targetQuote = unicodeText.substring(startIdx, endIdx);

    const range = document.createRange();
    range.setStart(textNode, startIdx);
    range.setEnd(textNode, endIdx);
    expect(range.toString()).toBe(targetQuote);

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-9",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#38bdf8",
      quote: targetQuote,
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const mark = container.querySelector("mark.luma-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe(targetQuote);
    expect(container.textContent).toBe(unicodeText);
  });

  // 10. Emoji (surrogate pairs)
  it("Test 10: Emoji text with surrogate pairs preserves grapheme boundaries", () => {
    const emojiText = "Reading books 📖✨ and exploring worlds 🚀🌌 with joy 🎉!";
    container.innerHTML = `<p id="p10">${emojiText}</p>`;
    const p = container.querySelector("#p10")!;
    const textNode = p.firstChild as Text;

    // Select "📖✨ and exploring worlds 🚀"
    const startIdx = emojiText.indexOf("📖");
    const endIdx = emojiText.indexOf("🌌");
    const targetQuote = emojiText.substring(startIdx, endIdx);

    const range = document.createRange();
    range.setStart(textNode, startIdx);
    range.setEnd(textNode, endIdx);
    expect(range.toString()).toBe(targetQuote);

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-10",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#FDE68A",
      quote: targetQuote,
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const mark = container.querySelector("mark.luma-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe(targetQuote);
    expect(container.textContent).toBe(emojiText);
  });

  // 11. RTL text
  it("Test 11: RTL text (Hebrew and Arabic)", () => {
    const rtlText = "שלום עולם וברכה. مرحبا بكم في عالم القراءة الرقمية.";
    container.innerHTML = `<p id="p11" dir="rtl">${rtlText}</p>`;
    const p = container.querySelector("#p11")!;
    const textNode = p.firstChild as Text;

    // Select "עולם וברכה. مرحبا بكم"
    const startIdx = rtlText.indexOf("עולם");
    const endIdx = rtlText.indexOf(" في عالم");
    const targetQuote = rtlText.substring(startIdx, endIdx);

    const range = document.createRange();
    range.setStart(textNode, startIdx);
    range.setEnd(textNode, endIdx);
    expect(range.toString()).toBe(targetQuote);

    const docRange = serializeRangeToDocumentRange(container, range, 0);
    const annotation: Annotation = {
      id: "ann-11",
      book_id: "book-1",
      annotation_type: "highlight",
      color_hex: "#10B981",
      quote: targetQuote,
      note: null,
      anchor_payload_json: JSON.stringify({ range: docRange }),
      sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
    };

    applyHighlightsAndSearch(container, [annotation], 0);

    const mark = container.querySelector("mark.luma-highlight");
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe(targetQuote);
    expect(container.textContent).toBe(rtlText);
  });

  // Direct highlightDomRange test
  it("highlightDomRange creates marks directly from Range without quote search", () => {
    container.innerHTML = "<p>A <em>brilliant</em> architectural achievement.</p>";
    const em = container.querySelector("em")!;
    const range = document.createRange();
    range.setStart(em.firstChild!, 0);
    range.setEnd(em.nextSibling!, 14); // "brilliant architectural"
    expect(range.toString()).toBe("brilliant architectural");

    const marks = highlightDomRange(container, range, { color: "#38bdf8", annotationId: "direct-1" });
    expect(marks.length).toBe(2);
    expect(marks.map(m => m.textContent).join("")).toBe("brilliant architectural");
  });
});
