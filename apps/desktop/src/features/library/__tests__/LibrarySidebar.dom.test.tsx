import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LibrarySidebar, type SidebarSection } from "../LibrarySidebar";
import type { Collection } from "@luma/shared-types";

/**
 * The sidebar is the primary navigation surface. These tests pin the contract
 * that matters most for first-run usability and keyboard operation.
 */

const baseProps = {
  currentSection: "library" as SidebarSection,
  onSelectSection: vi.fn(),
};

const collection: Collection = {
  id: "col_1",
  name: "Fixture Collection",
  description: null,
  book_ids: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
} as unknown as Collection;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LibrarySidebar — collections section", () => {
  it("offers New Collection even when the library has zero collections", async () => {
    const onCreateCollection = vi.fn();
    render(
      <LibrarySidebar
        {...baseProps}
        currentSection="collections"
        collections={[]}
        onCreateCollection={onCreateCollection}
      />
    );

    // Regression: this action used to be gated behind `collections.length > 0`,
    // so a fresh install had no discoverable way to create its first collection.
    const action = screen.getByRole("button", { name: /new collection/i });
    await userEvent.click(action);
    expect(onCreateCollection).toHaveBeenCalledTimes(1);
  });

  it("shows an honest empty state next to the creation action", () => {
    render(
      <LibrarySidebar
        {...baseProps}
        currentSection="collections"
        collections={[]}
        onCreateCollection={vi.fn()}
      />
    );

    expect(screen.getByText(/no collections/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new collection/i })).toBeInTheDocument();
  });

  it("lists real collections and fires the creation action alongside them", async () => {
    const onCreateCollection = vi.fn();
    render(
      <LibrarySidebar
        {...baseProps}
        currentSection="collections"
        collections={[collection]}
        onCreateCollection={onCreateCollection}
      />
    );

    expect(screen.getByRole("button", { name: "Fixture Collection" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /new collection/i }));
    expect(onCreateCollection).toHaveBeenCalledTimes(1);
  });
});

describe("LibrarySidebar — navigation semantics", () => {
  it("exposes sections as buttons with a current-page marker", () => {
    render(
      <LibrarySidebar {...baseProps} currentSection="collections" collections={[collection]} />
    );

    const active = screen.getByRole("button", { name: "Collections" });
    expect(active).toHaveAttribute("aria-current", "page");

    const inactive = screen.getByRole("button", { name: "All Books" });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("renders an empty tags section without inventing tags", () => {
    render(<LibrarySidebar {...baseProps} currentSection="tags" tags={[]} />);

    expect(screen.queryByRole("button", { name: /no tags/i })).not.toBeInTheDocument();
    // No fake tag rows: nothing selectable exists when the data layer has none.
    expect(screen.queryAllByRole("button", { name: /^fixture/i })).toHaveLength(0);
  });
});
