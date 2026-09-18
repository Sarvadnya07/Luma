import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CollectionModal } from "../CollectionModal";

const openModal = async (props: Partial<ComponentProps<typeof CollectionModal>> = {}) => {
  const onCreate = props.onCreate ?? vi.fn().mockResolvedValue(undefined);
  const onClose = props.onClose ?? vi.fn();
  const utils = render(
    <CollectionModal isOpen onClose={onClose} onCreate={onCreate} {...props} />
  );
  // The modal focuses its first field on a short timer; waiting for that settles
  // the timer inside act() so tests neither race nor warn.
  await waitFor(() => expect(screen.getByLabelText(/collection name/i)).toHaveFocus());
  return { ...utils, onCreate, onClose };
};

describe("CollectionModal — dialog contract", () => {
  it("renders an accessible dialog, portalled, with focus moved inside", async () => {
    await openModal();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName(/create new collection/i);
    // Regression guard: aria-describedby used to point at an id that did not exist.
    expect(dialog).toHaveAccessibleDescription(/group books from your library/i);
  });

  it("is absent when closed", () => {
    render(<CollectionModal isOpen={false} onClose={() => {}} onCreate={async () => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the submit action disabled until a name is entered", async () => {
    const user = userEvent.setup();
    await openModal();

    const submit = screen.getByRole("button", { name: /create collection/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/collection name/i), "   ");
    expect(submit).toBeDisabled(); // whitespace only is not a name

    await user.type(screen.getByLabelText(/collection name/i), "Modernist Classics");
    expect(submit).toBeEnabled();
  });

  it("submits the trimmed name and optional description, then closes", async () => {
    const user = userEvent.setup();
    const { onCreate, onClose } = await openModal();

    await user.type(screen.getByLabelText(/collection name/i), "  Modernist Classics  ");
    await user.type(screen.getByLabelText(/description/i), "  1920s novels  ");
    await user.click(screen.getByRole("button", { name: /create collection/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Modernist Classics", "1920s novels"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("omits an empty description instead of submitting whitespace", async () => {
    const user = userEvent.setup();
    const { onCreate } = await openModal();

    await user.type(screen.getByLabelText(/collection name/i), "Solo");
    await user.click(screen.getByRole("button", { name: /create collection/i }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Solo", undefined));
  });

  it("restores focus to the opener when it closes", async () => {
    const onClose = vi.fn();
    const Page = ({ open }: { open: boolean }) => (
      <>
        <button onClick={() => undefined}>Open Settings</button>
        <CollectionModal isOpen={open} onClose={onClose} onCreate={vi.fn().mockResolvedValue(undefined)} />
      </>
    );
    // The modal records document.activeElement at open time, so the opener
    // must have focus before the modal mounts.
    const { rerender } = render(<Page open={false} />);
    screen.getByRole("button", { name: /open settings/i }).focus();
    rerender(<Page open={true} />);
    await waitFor(() => expect(screen.getByLabelText(/collection name/i)).toHaveFocus());

    rerender(<Page open={false} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /open settings/i })).toHaveFocus()
    );
  });

  it("closes on Escape and on the cancel action", async () => {
    const user = userEvent.setup();
    const { onClose } = await openModal();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows an error, keeps the user's input, and stays open when creation fails", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockRejectedValue(new Error("database is locked"));
    const onClose = vi.fn();
    await openModal({ onCreate, onClose });

    await user.type(screen.getByLabelText(/collection name/i), "Will Fail");
    await user.click(screen.getByRole("button", { name: /create collection/i }));

    expect(await screen.findByText(/failed to create collection/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/collection name/i)).toHaveValue("Will Fail");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables its controls and blocks a second submit while a create is in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onCreate = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        })
    );
    await openModal({ onCreate });

    await user.type(screen.getByLabelText(/collection name/i), "Slow");
    await user.click(screen.getByRole("button", { name: /create collection/i }));

    const pending = await screen.findByRole("button", { name: /creating/i });
    expect(pending).toBeDisabled();
    expect(screen.getByLabelText(/collection name/i)).toBeDisabled();

    // A second click while pending must not queue another create.
    await user.click(pending);
    expect(onCreate).toHaveBeenCalledTimes(1);

    release();
  });
});
