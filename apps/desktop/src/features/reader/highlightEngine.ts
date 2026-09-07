/**
 * Luma Canonical Highlight & Text-Mapping Engine (ADR-RDR-01)
 *
 * Provides non-destructive, grapheme- and whitespace-resilient text mapping
 * between user selections (collapsed whitespace) and raw DOM node trees.
 *
 * Guarantees:
 * 1. Whitespace Collapsing Resiliency: Normalizes \r, \n, \t, and multi-spaces while mapping back to exact DOM offsets.
 * 2. Context Disambiguation: Uses prefix & suffix from anchor payload to anchor duplicate quotes correctly.
 * 3. Non-Destructive Reverse-Order Injection: Applies marks from bottom-to-top to avoid text node invalidation.
 * 4. Cross-Node & Nested Tag Spanning: Wraps multi-node selections without breaking HTML structure.
 */

import { Annotation } from "@luma/shared-types";

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
}

/**
 * Normalizes whitespace: transforms sequences of whitespace [\s\u00A0]+ into a single ' '
 * and produces mapping indices to raw character offsets.
 */
export function buildCharMapping(container: HTMLElement): CharMapping {
  const doc = container.ownerDocument || document;
  const showText = 4; // NodeFilter.SHOW_TEXT
  const filterAccept = 1; // NodeFilter.FILTER_ACCEPT
  const filterReject = 2; // NodeFilter.FILTER_REJECT

  const walker = doc.createTreeWalker(container, showText, {
    acceptNode(node) {
      if ((node as Element).parentElement?.closest("script, style, noscript")) {
        return filterReject;
      }
      return filterAccept;
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
    if (len > 0) {
      const rawStart = rawText.length;
      rawText += val;
      const rawEnd = rawStart + len;
      nodeEntries.push({ node: textNode, rawStart, rawEnd });

      for (let i = 0; i < len; i++) {
        rawToNode.push({ node: textNode, localOffset: i });
      }
    }
  }

  // Construct normalized text with bidirectional mapping
  let normalizedText = "";
  const normToRawStart: number[] = [];
  const normToRawEnd: number[] = [];

  let i = 0;
  while (i < rawText.length) {
    const ch = rawText[i]!;
    if (/\s/.test(ch)) {
      const spaceStart = i;
      while (i < rawText.length && /\s/.test(rawText[i]!)) {
        i++;
      }
      const spaceEnd = i;
      normalizedText += " ";
      normToRawStart.push(spaceStart);
      normToRawEnd.push(spaceEnd);
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
export function normalizeString(str: string): string {
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

  const quoteLower = normalizedQuote.toLowerCase();
  const haystackLower = normalizedHaystack.toLowerCase();
  const prefixLower = prefix ? normalizeString(prefix).toLowerCase() : "";
  const suffixLower = suffix ? normalizeString(suffix).toLowerCase() : "";

  const candidates: number[] = [];
  let pos = 0;
  while ((pos = haystackLower.indexOf(quoteLower, pos)) !== -1) {
    candidates.push(pos);
    pos += quoteLower.length;
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    const start = candidates[0]!;
    return { start, end: start + quoteLower.length };
  }

  // Score each candidate by prefix and suffix overlap
  let bestCandidate = candidates[0]!;
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
      const following = haystackLower.substring(candEnd, Math.min(haystackLower.length, candEnd + suffixLower.length));
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
  const marks = container.querySelectorAll("mark.luma-highlight, mark.luma-search-hit");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(doc.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });
}

/**
 * High-level engine function: Clears existing marks, builds char map, computes ranges,
 * and renders DOM marks safely from bottom-to-top.
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

  // 3. Search query highlights (amber)
  if (searchQuery && searchQuery.trim().length > 1) {
    const normQ = normalizeString(searchQuery).toLowerCase();
    const hayLower = mapping.normalizedText.toLowerCase();
    let searchPos = 0;
    let hitCount = 0;

    while ((searchPos = hayLower.indexOf(normQ, searchPos)) !== -1) {
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
        });
        hitCount++;
      }
    }
  }

  // 4. Persistent user annotations
  const relevantAnns = annotations.filter((ann) => {
    if (!ann.quote || !ann.quote.trim()) return false;
    try {
      const p = JSON.parse(ann.anchor_payload_json);
      if (p.spine_index !== undefined) {
        return p.spine_index === currentSpine;
      }
    } catch {
      // payload fallback
    }
    return true;
  });

  for (const ann of relevantAnns) {
    const normQuote = normalizeString(ann.quote);
    if (!normQuote) continue;

    let prefix: string | null = null;
    let suffix: string | null = null;
    try {
      const p = JSON.parse(ann.anchor_payload_json);
      prefix = p.prefix || null;
      suffix = p.suffix || null;
    } catch {
      // fallback
    }

    const match = findBestMatch(mapping.normalizedText, normQuote, prefix, suffix);
    if (match) {
      const rawStart = mapping.normToRawStart[match.start];
      const rawEnd = mapping.normToRawEnd[match.end - 1];

      if (rawStart !== undefined && rawEnd !== undefined && rawEnd > rawStart) {
        highlightRanges.push({
          rawStart,
          rawEnd,
          className: "luma-highlight",
          color: ann.color_hex || "#fef08a",
          annotationId: ann.id,
          charOffset: rawStart,
        });
      }
    }
  }

  if (highlightRanges.length === 0) return;

  // 5. Decompose ranges into sub-segments per text node
  interface DomSegment {
    node: Text;
    localStart: number;
    localEnd: number;
    globalRawStart: number;
    className: string;
    color: string;
    annotationId?: string;
    charOffset?: number;
  }

  const domSegments: DomSegment[] = [];

  for (const hl of highlightRanges) {
    for (const entry of mapping.nodeEntries) {
      if (entry.rawEnd > hl.rawStart && entry.rawStart < hl.rawEnd) {
        const localStart = Math.max(0, hl.rawStart - entry.rawStart);
        const localEnd = Math.min(entry.node.nodeValue?.length || 0, hl.rawEnd - entry.rawStart);
        if (localEnd > localStart) {
          domSegments.push({
            node: entry.node,
            localStart,
            localEnd,
            globalRawStart: entry.rawStart + localStart,
            className: hl.className,
            color: hl.color,
            annotationId: hl.annotationId,
            charOffset: hl.charOffset,
          });
        }
      }
    }
  }

  // 6. Sort segments in strictly DESCENDING order of globalRawStart
  // This guarantees all insertions happen from bottom-to-top, preserving text node offsets!
  domSegments.sort((a, b) => b.globalRawStart - a.globalRawStart);

  // 7. Inject marks
  for (const seg of domSegments) {
    try {
      const doc = seg.node.ownerDocument || document;
      const range = doc.createRange();
      range.setStart(seg.node, seg.localStart);
      range.setEnd(seg.node, seg.localEnd);

      const mark = doc.createElement("mark");
      mark.className = seg.className;
      mark.style.backgroundColor = `${seg.color}55`;
      mark.style.borderBottom = `2px solid ${seg.color}`;
      mark.style.color = "inherit";
      if (seg.annotationId) {
        mark.setAttribute("data-annotation-id", seg.annotationId);
      }
      if (seg.charOffset !== undefined) {
        mark.setAttribute("data-char-offset", String(seg.charOffset));
      }

      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    } catch {
      // safe fallback if text node was mutated by overlapping span
    }
  }
}
