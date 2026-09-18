import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportJob } from "@luma/shared-types";
import { ImportProgressModal } from "../ImportProgressModal";

const makeJob = (over: Partial<ImportJob> = {}): ImportJob => ({
  id: "job_1",
  total_files: 2,
  completed_count: 1,
  failed_count: 0,
  skipped_count: 0,
  status: "processing",
  items: [
    {
      source_path: "/books/one.epub",
      original_filename: "one.epub",
      status: "completed",
      book_id: "book_1",
      file_id: "file_1",
      duplicate_level: null,
      error_message: null,
    },
    {
      source_path: "/books/two.epub",
      original_filename: "two.epub",
      status: "pending",
      book_id: null,
      file_id: null,
      duplicate_level: null,
      error_message: null,
    },
  ],
  started_at: "2026-09-17T10:00:00.000Z",
  ended_at: null,
  ...over,
});

describe("ImportProgressModal", () => {
  it("renders nothing when closed", () => {
    render(<ImportProgressModal job={makeJob()} isOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing when there is no job yet", () => {
    render(<ImportProgressModal job={null} isOpen onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reports real progress from the job counters", () => {
    render(<ImportProgressModal job={makeJob()} isOpen onClose={() => {}} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(/importing books/i);
    expect(screen.getByText("1 of 2 processed")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("counts skipped and failed items toward completion", () => {
    render(
      <ImportProgressModal
        job={makeJob({ completed_count: 1, failed_count: 1, skipped_count: 0 })}
        isOpen
        onClose={() => {}}
      />
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("lists each item with its own status", () => {
    render(<ImportProgressModal job={makeJob()} isOpen onClose={() => {}} />);
    expect(screen.getByText("one.epub")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("two.epub")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("cannot be dismissed while the import is still running", async () => {
    const onClose = vi.fn();
    render(<ImportProgressModal job={makeJob()} isOpen onClose={onClose} />);

    // The close affordance only exists once the job reaches a terminal state.
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /done/i })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("announces a finished import and calls onClose once on Done", async () => {
    const onClose = vi.fn();
    render(
      <ImportProgressModal
        job={makeJob({ status: "completed", completed_count: 2, ended_at: "2026-09-17T10:01:00.000Z" })}
        isOpen
        onClose={onClose}
      />
    );

    expect(screen.getByText(/import finished/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /done/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("treats a failed job as finished and reports the failure, not a success", () => {
    render(
      <ImportProgressModal
        job={makeJob({
          status: "failed",
          completed_count: 0,
          failed_count: 1,
          items: [
            {
              source_path: "/books/broken.epub",
              original_filename: "broken.epub",
              status: "failed",
              book_id: null,
              file_id: null,
              duplicate_level: null,
              error_message: "not a valid EPUB",
            },
          ],
        })}
        isOpen
        onClose={() => {}}
      />
    );

    expect(screen.getByText(/import finished/i)).toBeInTheDocument();
    expect(screen.getByText("broken.epub")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    // A failed import must be dismissible like any other terminal state.
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });
});
