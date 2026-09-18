import { describe, it, expect } from "vitest";
import { DEFAULT_PAGE_SIZE, clampPage, paginate, totalPagesFor } from "../pagination";

const items = Array.from({ length: 45 }, (_, index) => index + 1);

describe("pagination arithmetic", () => {
  it("reports the true page count", () => {
    expect(totalPagesFor(0)).toBe(1);
    expect(totalPagesFor(1)).toBe(1);
    expect(totalPagesFor(DEFAULT_PAGE_SIZE)).toBe(1);
    expect(totalPagesFor(DEFAULT_PAGE_SIZE + 1)).toBe(2);
    expect(totalPagesFor(45)).toBe(3);
  });

  it("slices exactly one page and reports 1-based inclusive bounds", () => {
    const first = paginate(items, 1);
    expect(first.items).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(first.items[0]).toBe(1);
    expect(first.startIndex).toBe(1);
    expect(first.endIndex).toBe(20);
    expect(first.totalPages).toBe(3);
    expect(first.totalItems).toBe(45);

    const last = paginate(items, 3);
    expect(last.items).toHaveLength(5);
    expect(last.items[0]).toBe(41);
    expect(last.startIndex).toBe(41);
    expect(last.endIndex).toBe(45);
  });

  it("clamps an out-of-range page instead of rendering nothing", () => {
    const beyond = paginate(items, 99);
    expect(beyond.page).toBe(3);
    expect(beyond.items).toHaveLength(5);

    const below = paginate(items, 0);
    expect(below.page).toBe(1);

    const nonsense = paginate(items, Number.NaN);
    expect(nonsense.page).toBe(1);
  });

  it("clamps when the result set shrinks under the current page", () => {
    // The library view uses this when a filter change empties the later pages.
    expect(clampPage(3, 45)).toBe(3);
    expect(clampPage(3, 20)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });

  it("handles an empty list without producing fake bounds", () => {
    const empty = paginate([], 2);
    expect(empty.items).toEqual([]);
    expect(empty.page).toBe(1);
    expect(empty.totalPages).toBe(1);
    expect(empty.startIndex).toBe(0);
    expect(empty.endIndex).toBe(0);
  });
});
