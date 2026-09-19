import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Book } from "@luma/shared-types";
import { DuplicateReviewModal } from "../DuplicateReviewModal";

const existingBook = {
  id: "book_duplicate",
  title: "Fixture Reader Alpha",
  author_ids: [],
  cover_image_id: null,
  cover_image_path: null,
  primary_file_id: "file_1",
  reading_status: "reading",
  library_state: "active",
  trashed_at: null,
  published_date: "2024-01-01",
  sync: {
    version: 1,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    device_id: "device_fixture",
    is_deleted: false,
  },
} as unknown as Book;

const openModal = async (
  props: Partial<ComponentProps<typeof DuplicateReviewModal>> = {}
) => {
  const handlers = {
    onClose: props.onClose ?? vi.fn(),
    onUseExisting: props.onUseExisting ?? vi.fn(),
    onAddAsNewFormat: props.onAddAsNewFormat ?? vi.fn(),
  };
  render(
    <DuplicateReviewModal
      isOpen
      existingBook={existingBook}
      importingFile={{ filename: "fixture_alpha_new.epub", format: "EPUB", size: "2.1 MB" }}
      {...handlers}
      {...props}
    />
  );
  // The modal parks focus on its close button, but a disabled control cannot
  // take focus — which is itself the behaviour under test while loading.
  const interactive = !props.loading && !props.disabled;
  if (interactive) {
    await waitFor(() => expect(screen.getByRole("button", { name: /close modal/i })).toHaveFocus());
  } else {
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
  }
  return handlers;
};

describe("DuplicateReviewModal — duplicate decision contract", () => {
  it("describes the conflict with the real existing record and the incoming file", async () => {
    await openModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(/importing library/i);
    // Regression guard: aria-describedby used to reference a missing element id.
    expect(dialog).toHaveAccessibleDescription(/duplicate|already exists/i);
    expect(screen.getByText("Fixture Reader Alpha")).toBeInTheDocument();
    expect(screen.getByText("fixture_alpha_new.epub")).toBeInTheDocument();
    expect(screen.getByText("2.1 MB")).toBeInTheDocument();
  });

  it("calls the matching handler for each visible decision", async () => {
    const user = userEvent.setup();
    const { onUseExisting, onAddAsNewFormat } = await openModal();

    await user.click(screen.getByRole("button", { name: /use existing/i }));
    expect(onUseExisting).toHaveBeenCalledTimes(1);
    expect(onAddAsNewFormat).not.toHaveBeenCalled();
  });

  it("offers adding the file as a new format as the other decision", async () => {
    const user = userEvent.setup();
    const { onUseExisting, onAddAsNewFormat } = await openModal();

    await user.click(screen.getByRole("button", { name: /add as new format/i }));
    expect(onAddAsNewFormat).toHaveBeenCalledTimes(1);
    expect(onUseExisting).not.toHaveBeenCalled();
  });

  it("closes on Escape and on Cancel without choosing", async () => {
    const user = userEvent.setup();
    const { onClose, onUseExisting, onAddAsNewFormat } = await openModal();

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onUseExisting).not.toHaveBeenCalled();
    expect(onAddAsNewFormat).not.toHaveBeenCalled();
  });

  it("blocks both decisions while an operation is in flight", async () => {
    const user = userEvent.setup();
    const { onUseExisting, onAddAsNewFormat, onClose } = await openModal({ loading: true });

    const useExisting = screen.getByRole("button", { name: /use existing/i });
    expect(useExisting).toBeDisabled();
    expect(screen.getByRole("button", { name: /add as new format/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /close modal/i })).toBeDisabled();

    await user.click(useExisting);
    expect(onUseExisting).not.toHaveBeenCalled();
    expect(onAddAsNewFormat).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on a backdrop click unless the caller allows it", async () => {
    const user = userEvent.setup();
    const { onClose } = await openModal({ closeOnOverlayClick: false });

    // The dialog itself is the overlay element; clicking the card must not close.
    await user.click(screen.getByText("fixture_alpha_new.epub"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
