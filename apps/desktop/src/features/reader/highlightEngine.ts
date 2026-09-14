/**
 * Luma Canonical Highlight & Text-Mapping Engine (ADR-RDR-01)
 *
 * Provides non-destructive, grapheme- and whitespace-resilient text mapping
 * between user selections (collapsed whitespace) and raw DOM node trees.
 *
 * Guarantees:
 * 1. Whitespace Collapsing Resiliency: Normalizes \r, \n, \t, and multi-spaces while mapping back to exact DOM offsets.
 * 2. Context Disambiguation: Uses prefix & suffix from anchor payload to anchor duplicate quotes correctly.
 * 3. Non-Destructive Injection: Text nodes are split once into atomic intervals, so overlapping
 *    highlights nest instead of silently corrupting each other's offsets.
 * 4. Cross-Node & Nested Tag Spanning: Wraps multi-node selections without breaking HTML structure.
 */

import { Annotation, DocumentRange } from "@luma/shared-types";

const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT
const FILTER_ACCEPT = 1; // NodeFilter.FILTER_ACCEPT
const FILTER_REJECT = 2; // NodeFilter.FILTER_REJECT

/**
 * Single-character whitespace test.
 * Hoisted on purpose: a regex literal inside a per-character loop allocates a
 * brand new RegExp on every iteration, which is catastrophic on long chapters.
 */
const WS_CHAR = /\s/;

export interface TextNodeEntry {
  node: Text;
  rawStart: number;
  rawEnd: number;
}

export interface CharMapping {
  rawToNode: Array<{ node: Text; localOffset: number }>;
  normToRawStart: number[];
  normToRawEnd: number[];
  normalizedText: string;
  rawText: string;
  nodeEntries: TextNodeEntry[];
}

export interface HighlightRange {
  rawStart: number;
  rawEnd: number;
  className: string;
  color: string;
  annotationId?: string;
  charOffset?: number;
  /**
   * Higher priority wins when two ranges cover the exact same characters.
   * User annotations use 1, transient search hits use 0.
   */
  priority?: number;
}

/** A single highlight range clipped to a single text node. */
interface DomSegment {
  node: Text;
  localStart: number;
  localEnd: number;
  className: string;
  color: string;
  annotationId?: string;
  charOffset?: number;
  priority: number;
}

/**
 * Normalizes whitespace: transforms sequences of whitespace [\s\u00A0]+ into a single ' '
 * and produces mapping indices to raw character offsets.
 */
export function buildCharMapping(container: HTMLElement): CharMapping {
  const doc = container.ownerDocument || document;

  const walker = doc.createTreeWalker(container, SHOW_TEXT, {
    acceptNode(node: Node): number {
      const parent = node.parentElement;
      if (parent && parent.closest("script, style, noscript, template")) {
        return FILTER_REJECT;
      }
      return FILTER_ACCEPT;
    },
  });

  const nodeEntries: TextNodeEntry[] = [];
  const rawToNode: Array<{ node: Text; localOffset: number }> = [];
  let rawText = "";

  let n: Node | null;
  while ((n = walker.nextNode())) {
    const textNode = n as Text;
    const val = textNode.nodeValue || "";
    const len = val.length;
    if (len === 0) continue;

    const rawStart = rawText.length;
    rawText += val;
    nodeEntries.push({ node: textNode, rawStart, rawEnd: rawStart + len });

    for (let i = 0; i < len; i++) {
      rawToNode.push({ node: textNode, localOffset: i });
    }
  }

  // Construct normalized text with bidirectional mapping
  let normalizedText = "";
  const normToRawStart: number[] = [];
  const normToRawEnd: number[] = [];

  let i = 0;
  while (i < rawText.length) {
    const ch = rawText[i]!;
    if (WS_CHAR.test(ch)) {
      const spaceStart = i;
      while (i < rawText.length && WS_CHAR.test(rawText[i]!)) {
        i++;
      }
      normalizedText += " ";
      normToRawStart.push(spaceStart);
      normToRawEnd.push(i);
    } else {
      normalizedText += ch;
      normToRawStart.push(i);
      normToRawEnd.push(i + 1);
      i++;
    }
  }

  return {
    rawToNode,
    normToRawStart,
    normToRawEnd,
    normalizedText,
    rawText,
    nodeEntries,
  };
}

/**
 * Normalizes an input search string or quote by collapsing contiguous whitespace to single spaces.
 */
export function normalizeString(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Disambiguates between multiple match occurrences using prefix and suffix context.
 */
export function findBestMatch(
  normalizedHaystack: string,
  normalizedQuote: string,
  prefix?: string | null,
  suffix?: string | null
): { start: number; end: number } | null {
  if (!normalizedQuote || !normalizedHaystack) return null;

  const rawHayLower = normalizedHaystack.toLowerCase();
  const rawQuoteLower = normalizedQuote.toLowerCase();

  // toLowerCase() changes string length for a handful of code points
  // (e.g. "İ" -> "i̇"). If that happens the match offsets no longer line up
  // with the haystack, so fall back to the original casing in that case.
  const haystackLower =
    rawHayLower.length === normalizedHaystack.length ? rawHayLower : normalizedHaystack;
  const quoteLower =
    rawQuoteLower.length === normalizedQuote.length ? rawQuoteLower : normalizedQuote;

  const prefixLower = prefix ? normalizeString(prefix).toLowerCase() : "";
  const suffixLower = suffix ? normalizeString(suffix).toLowerCase() : "";

  const candidates: number[] = [];
  let pos = 0;
  while ((pos = haystackLower.indexOf(quoteLower, pos)) !== -1) {
    candidates.push(pos);
    pos += quoteLower.length;
  }

  if (candidates.length === 0) return null;

  const start = candidates[0]!;
  if (candidates.length === 1) {
    return { start, end: start + quoteLower.length };
  }

  // Score each candidate by prefix and suffix overlap
  let bestCandidate = start;
  let highestScore = -1;

  for (const cand of candidates) {
    let score = 0;
    const candEnd = cand + quoteLower.length;

    if (prefixLower) {
      const preceding = haystackLower.substring(Math.max(0, cand - prefixLower.length), cand);
      if (preceding.endsWith(prefixLower)) {
        score += 10;
      } else if (preceding.includes(prefixLower.slice(-15))) {
        score += 5;
      }
    }

    if (suffixLower) {
      const following = haystackLower.substring(
        candEnd,
        Math.min(haystackLower.length, candEnd + suffixLower.length)
      );
      if (following.startsWith(suffixLower)) {
        score += 10;
      } else if (following.includes(suffixLower.slice(0, 15))) {
        score += 5;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestCandidate = cand;
    }
  }

  return { start: bestCandidate, end: bestCandidate + quoteLower.length };
}

/**
 * Clears all existing highlight and search marks from container, merging split text nodes.
 */
export function clearDomHighlights(container: HTMLElement): void {
  const doc = container.ownerDocument || document;
  const marks = Array.from(
    container.querySelectorAll<HTMLElement>("mark.luma-highlight, mark.luma-search-hit")
  );

  const dirtyParents = new Set<Node>();

  // querySelectorAll returns document order, so an outer mark is always
  // visited before a mark nested inside it. Unwrapping outer-first therefore
  // flattens arbitrarily nested marks in a single pass.
  for (const mark of marks) {
    const parent = mark.parentNode;
    // Nested marks whose ancestor was already unwrapped are detached; skip them.
    // (`isConnected` is not usable here: it is false for every node when the
    // container itself is an off-document fragment.)
    if (!parent || !container.contains(mark)) continue;

    parent.replaceChild(doc.createTextNode(mark.textContent || ""), mark);
    dirtyParents.add(parent);
  }

  // normalize() once per affected parent, after all replacements — calling it
  // inside the loop is O(n^2) and repeatedly re-scans the same subtree.
  dirtyParents.forEach((parent) => parent.normalize());
}

/** Builds a <mark> element for a single segment. */
function createMarkElement(
  doc: Document,
  seg: Pick<DomSegment, "className" | "color" | "annotationId" | "charOffset">
): HTMLElement {
  const mark = doc.createElement("mark");
  mark.className = seg.className;

  // `${color}55` is only valid for 6-digit hex; other notations would produce
  // a nonsense value and the background would be dropped entirely.
  const tint = /^#[0-9a-f]{6}$/i.test(seg.color) ? `${seg.color}55` : seg.color;
  mark.style.backgroundColor = tint;
  mark.style.border = "none";
  mark.style.padding = "0";
  mark.style.margin = "0";
  mark.style.borderRadius = "0";
  mark.style.color = "inherit";

  if (seg.annotationId) {
    mark.setAttribute("data-annotation-id", seg.annotationId);
  }
  if (seg.charOffset !== undefined) {
    mark.setAttribute("data-char-offset", String(seg.charOffset));
  }
  return mark;
}

const NODE_TYPE_ELEMENT = 1;
const NODE_TYPE_TEXT = 3;

/**
 * Resolves a DOM node and local offset into a global character offset in mapping.rawText.
 */
export function getContainerOffset(
  container: HTMLElement,
  node: Node,
  localOffset: number,
  mapping: CharMapping
): number {
  if (node.nodeType === NODE_TYPE_TEXT) {
    const entry = mapping.nodeEntries.find((e) => e.node === node);
    if (entry) {
      return entry.rawStart + Math.max(0, Math.min(localOffset, (node as Text).nodeValue?.length ?? 0));
    }
  }

  // If node is an Element, localOffset points into childNodes
  if (node.nodeType === NODE_TYPE_ELEMENT) {
    const el = node as Element;
    if (localOffset < el.childNodes.length) {
      const child = el.childNodes[localOffset];
      if (child) {
        // Find the first text node in or after child
        const walker = (container.ownerDocument || document).createTreeWalker(child, SHOW_TEXT);
        const firstText = (walker.nextNode() as Text) || null;
        if (firstText) {
          const entry = mapping.nodeEntries.find((e) => e.node === firstText);
          if (entry) return entry.rawStart;
        }
      }
    } else {
      // Offset is at or past the end of children: find last text node
      const walker = (container.ownerDocument || document).createTreeWalker(el, SHOW_TEXT);
      let lastText: Text | null = null;
      let curr: Node | null;
      while ((curr = walker.nextNode())) {
        lastText = curr as Text;
      }
      if (lastText) {
        const entry = mapping.nodeEntries.find((e) => e.node === lastText);
        if (entry) return entry.rawEnd;
      }
    }
  }

  // Fallback: search for node in nodeEntries or return 0
  for (const entry of mapping.nodeEntries) {
    if (node.contains(entry.node)) {
      return entry.rawStart;
    }
  }

  return 0;
}

/**
 * Serializes a live DOM Range into a canonical DocumentRange anchor.
 */
export function serializeRangeToDocumentRange(
  container: HTMLElement,
  range: Range,
  sectionIndex: number = 0,
  charMapping?: CharMapping
): DocumentRange {
  const mapping = charMapping || buildCharMapping(container);
  const startChar = getContainerOffset(container, range.startContainer, range.startOffset, mapping);
  const endChar = getContainerOffset(container, range.endContainer, range.endOffset, mapping);

  const startEl =
    range.startContainer.nodeType === NODE_TYPE_ELEMENT
      ? (range.startContainer as Element)
      : range.startContainer.parentElement;
  const endEl =
    range.endContainer.nodeType === NODE_TYPE_ELEMENT
      ? (range.endContainer as Element)
      : range.endContainer.parentElement;

  const startNodeId = startEl?.id || null;
  const endNodeId = endEl?.id || null;

  return {
    start: {
      section_index: sectionIndex,
      char_offset: startChar,
      node_id: startNodeId,
      locator: startNodeId ? `#${startNodeId}` : `offset:${startChar}`,
    },
    end: {
      section_index: sectionIndex,
      char_offset: endChar,
      node_id: endNodeId,
      locator: endNodeId ? `#${endNodeId}` : `offset:${endChar}`,
    },
    text_snippet: range.toString(),
  };
}

/**
 * Resolves a canonical DocumentRange back into a live DOM Range within container.
 * Uses exact character offsets into text nodes. Does not use quote search.
 */
export function resolveDocumentRangeToDomRange(
  container: HTMLElement,
  docRange: DocumentRange,
  charMapping?: CharMapping
): Range | null {
  const mapping = charMapping || buildCharMapping(container);
  if (mapping.nodeEntries.length === 0) return null;

  const startChar = docRange.start.char_offset;
  const endChar = docRange.end.char_offset;
  if (endChar <= startChar) return null;

  let startNode: Text | null = null;
  let startLocal = 0;
  let endNode: Text | null = null;
  let endLocal = 0;

  for (let i = 0; i < mapping.nodeEntries.length; i++) {
    const entry = mapping.nodeEntries[i]!;

    if (!startNode && startChar >= entry.rawStart && startChar < entry.rawEnd) {
      startNode = entry.node;
      startLocal = startChar - entry.rawStart;
    }

    if (endChar > entry.rawStart && endChar <= entry.rawEnd) {
      endNode = entry.node;
      endLocal = endChar - entry.rawStart;
    }
  }

  // Boundary fallbacks
  if (!startNode && startChar <= mapping.nodeEntries[0]!.rawStart) {
    startNode = mapping.nodeEntries[0]!.node;
    startLocal = 0;
  }
  if (!endNode && endChar >= mapping.rawText.length) {
    const last = mapping.nodeEntries[mapping.nodeEntries.length - 1]!;
    endNode = last.node;
    endLocal = last.node.nodeValue?.length ?? 0;
  }

  if (!startNode || !endNode) return null;

  const doc = container.ownerDocument || document;
  const range = doc.createRange();
  try {
    range.setStart(startNode, startLocal);
    range.setEnd(endNode, endLocal);
    return range;
  } catch {
    return null;
  }
}

/**
 * Directly highlights an arbitrary DOM Range within container.
 * Decomposes range across text nodes using atomic intervals without altering DOM hierarchy.
 */
export function highlightDomRange(
  container: HTMLElement,
  range: Range,
  options: {
    className?: string;
    color?: string;
    annotationId?: string;
    priority?: number;
  } = {}
): HTMLElement[] {
  const className = options.className || "luma-highlight";
  const color = options.color || "#fef08a";
  const annotationId = options.annotationId;
  const priority = options.priority ?? 1;

  const mapping = buildCharMapping(container);
  const startRaw = getContainerOffset(container, range.startContainer, range.startOffset, mapping);
  const endRaw = getContainerOffset(container, range.endContainer, range.endOffset, mapping);
  if (endRaw <= startRaw) return [];

  const syntheticAnn: Annotation = {
    id: annotationId || `live-${Date.now()}`,
    book_id: "",
    annotation_type: "highlight",
    color_hex: color,
    quote: range.toString(),
    note: null,
    anchor_payload_json: JSON.stringify({
      range: {
        start: { section_index: 0, char_offset: startRaw },
        end: { section_index: 0, char_offset: endRaw },
      },
    }),
    sync: { version: 1, created_at: "", updated_at: "", device_id: "", is_deleted: false },
  };

  applyHighlightsAndSearch(container, [syntheticAnn], 0);
  return Array.from(container.querySelectorAll<HTMLElement>(`mark[data-annotation-id="${syntheticAnn.id}"]`));
}

/**
 * High-level engine function: Clears existing marks, builds char map, computes ranges,
 * and renders DOM marks safely.
 */
export function applyHighlightsAndSearch(
  container: HTMLElement,
  annotations: Annotation[],
  currentSpine: number,
  searchQuery?: string
): void {
  // 1. Clean previous marks
  clearDomHighlights(container);

  // 2. Build character mapping
  const mapping = buildCharMapping(container);
  if (mapping.normalizedText.length === 0 || mapping.rawToNode.length === 0) {
    return;
  }

  const highlightRanges: HighlightRange[] = [];

  // 3. Search query highlights (amber, lowest priority)
  if (searchQuery && searchQuery.trim().length > 1) {
    const normQ = normalizeString(searchQuery).toLowerCase();
    const hayLower = mapping.normalizedText.toLowerCase();

    // Same length-preservation guard as findBestMatch.
    const hayForSearch =
      hayLower.length === mapping.normalizedText.length ? hayLower : mapping.normalizedText;

    let searchPos = 0;
    let hitCount = 0;

    while ((searchPos = hayForSearch.indexOf(normQ, searchPos)) !== -1) {
      const normStart = searchPos;
      const normEnd = searchPos + normQ.length;
      searchPos = normEnd;

      const rawStart = mapping.normToRawStart[normStart];
      const rawEnd = mapping.normToRawEnd[normEnd - 1];

      if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
        highlightRanges.push({
          rawStart,
          rawEnd,
          className: "luma-search-hit",
          color: "#f59e0b",
          annotationId: `search-${hitCount}`,
          charOffset: rawStart,
          priority: 0,
        });
        hitCount++;
      }
    }
  }

  // 4. Persistent user annotations (higher priority)
  const relevantAnns = annotations.filter((ann) => {
    if (!ann.quote || !ann.quote.trim()) return false;
    try {
      const p = JSON.parse(ann.anchor_payload_json);
      if (p && p.spine_index !== undefined) {
        return p.spine_index === currentSpine;
      }
    } catch {
      // payload fallback
    }
    return true;
  });

  for (const ann of relevantAnns) {
    let payloadRange: DocumentRange | null = null;
    let prefix: string | null = null;
    let suffix: string | null = null;

    try {
      const p = JSON.parse(ann.anchor_payload_json);
      prefix = p?.prefix || null;
      suffix = p?.suffix || null;
      if (p?.range && p.range.start && p.range.end) {
        payloadRange = p.range;
      }
    } catch {
      // fallback
    }

    let rawStart: number | undefined;
    let rawEnd: number | undefined;

    // PRIMARY AUTHORITY: DocumentRange / DOM Range
    if (payloadRange) {
      const domRange = resolveDocumentRangeToDomRange(container, payloadRange, mapping);
      if (domRange) {
        const startOffsetInContainer = getContainerOffset(
          container,
          domRange.startContainer,
          domRange.startOffset,
          mapping
        );
        const endOffsetInContainer = getContainerOffset(
          container,
          domRange.endContainer,
          domRange.endOffset,
          mapping
        );
        if (
          startOffsetInContainer !== undefined &&
          endOffsetInContainer !== undefined &&
          endOffsetInContainer > startOffsetInContainer
        ) {
          rawStart = startOffsetInContainer;
          rawEnd = endOffsetInContainer;
        }
      }
    }

    // FALLBACK for legacy annotations without range payload
    if (rawStart === undefined || rawEnd === undefined) {
      const normQuote = normalizeString(ann.quote);
      if (normQuote) {
        const match = findBestMatch(mapping.normalizedText, normQuote, prefix, suffix);
        if (match) {
          rawStart = mapping.normToRawStart[match.start];
          rawEnd = mapping.normToRawEnd[match.end - 1];
        }
      }
    }

    if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
      highlightRanges.push({
        rawStart,
        rawEnd,
        className: "luma-highlight",
        color: ann.color_hex || "#fef08a",
        annotationId: ann.id,
        charOffset: rawStart,
        priority: 1,
      });
    }
  }

  if (highlightRanges.length === 0) return;

  // 5. Decompose ranges into sub-segments, grouped per text node.
  const segmentsByNode = new Map<Text, DomSegment[]>();

  for (const hl of highlightRanges) {
    for (const entry of mapping.nodeEntries) {
      if (entry.rawEnd <= hl.rawStart || entry.rawStart >= hl.rawEnd) continue;

      const nodeLen = entry.node.nodeValue?.length ?? 0;
      const localStart = Math.max(0, hl.rawStart - entry.rawStart);
      const localEnd = Math.min(nodeLen, hl.rawEnd - entry.rawStart);
      if (localEnd <= localStart) continue;

      const seg: DomSegment = {
        node: entry.node,
        localStart,
        localEnd,
        className: hl.className,
        color: hl.color,
        annotationId: hl.annotationId,
        charOffset: hl.charOffset,
        priority: hl.priority ?? 0,
      };

      const list = segmentsByNode.get(entry.node);
      if (list) list.push(seg);
      else segmentsByNode.set(entry.node, [seg]);
    }
  }

  // 6. Inject marks per text node.
  //
  // The previous implementation sorted all segments globally and mutated text
  // nodes bottom-to-top. That only works while ranges are disjoint: as soon as
  // two ranges overlapped, the earlier extraction shortened the node and the
  // second range's offsets silently pointed past the end (throwing
  // IndexSizeError, swallowed by the catch, and losing the highlight).
  //
  // Instead each text node is split ONCE into atomic intervals at every
  // boundary, and each interval is wrapped by every range covering it. Ranges
  // that overlap now nest correctly and no offset is ever invalidated.
  const doc = container.ownerDocument || document;

  for (const [textNode, segments] of segmentsByNode) {
    const parent = textNode.parentNode;
    if (!parent) continue;

    const text = textNode.nodeValue ?? "";
    if (text.length === 0) continue;

    // Drop exact duplicates (same annotation matched twice, search hit landing
    // on an identical range, etc.) so we don't build pointless nested marks.
    const seen = new Set<string>();
    const unique: DomSegment[] = [];
    for (const s of segments) {
      const key = `${s.className}|${s.annotationId ?? ""}|${s.color}|${s.localStart}|${s.localEnd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(s);
    }

    // Atomic interval boundaries within this node.
    const boundaries = new Set<number>([0, text.length]);
    for (const s of unique) {
      boundaries.add(Math.max(0, Math.min(text.length, s.localStart)));
      boundaries.add(Math.max(0, Math.min(text.length, s.localEnd)));
    }
    const points = Array.from(boundaries).sort((a, b) => a - b);

    const frag = doc.createDocumentFragment();

    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i]!;
      const to = points[i + 1]!;
      if (to <= from) continue;

      const chunk = text.slice(from, to);

      const covering = unique
        .filter((s) => s.localStart <= from && s.localEnd >= to)
        .sort((a, b) => a.priority - b.priority); // lowest priority innermost

      let current: Node = doc.createTextNode(chunk);
      for (const seg of covering) {
        const mark = createMarkElement(doc, seg);
        mark.appendChild(current);
        current = mark;
      }
      frag.appendChild(current);
    }

    parent.replaceChild(frag, textNode);
  }
}