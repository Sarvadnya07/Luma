/**
 * Library pagination (FE-MED-4).
 *
 * `LibraryView` previously held a `currentPage` that nothing sliced, rendered a
 * `Pagination` hardcoded to `1, 2, 3, …, 12`, and printed "Showing 1-N of N"
 * unconditionally. This module is the single, testable definition of the paging
 * arithmetic so the UI cannot drift from the data again.
 */

export const DEFAULT_PAGE_SIZE = 20;

export interface PageSlice<T> {
  /** Items for the requested (clamped) page. */
  items: T[];
  /** The page actually used, clamped into `[1, totalPages]`. */
  page: number;
  totalPages: number;
  totalItems: number;
  /** 1-based, inclusive; 0 when there are no items. */
  startIndex: number;
  /** 1-based, inclusive; 0 when there are no items. */
  endIndex: number;
}

export function totalPagesFor(totalItems: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/** Clamp a requested page into the valid range for a given item count. */
export function clampPage(
  page: number,
  totalItems: number,
  pageSize: number = DEFAULT_PAGE_SIZE
): number {
  const totalPages = totalPagesFor(totalItems, pageSize);
  if (!Number.isFinite(page)) return 1;
  const floored = Math.floor(page);
  if (floored < 1) return 1;
  return Math.min(floored, totalPages);
}

/** Slice a list for display, clamping the page instead of returning nothing. */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE
): PageSlice<T> {
  const totalItems = items.length;
  const totalPages = totalPagesFor(totalItems, pageSize);
  const resolved = clampPage(page, totalItems, pageSize);
  const startOffset = (resolved - 1) * pageSize;
  const sliced = items.slice(startOffset, startOffset + pageSize);

  return {
    items: sliced,
    page: resolved,
    totalPages,
    totalItems,
    startIndex: sliced.length === 0 ? 0 : startOffset + 1,
    endIndex: sliced.length === 0 ? 0 : startOffset + sliced.length,
  };
}

