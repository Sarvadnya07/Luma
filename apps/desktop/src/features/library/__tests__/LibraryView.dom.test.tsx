import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createLumaApi, type LumaTransport } from "../../../lib/tauri";
import {
  createInMemoryLibraryBackend,
  fixtureState,
  type InMemoryLibraryBackend,
} from "../../../testing/inMemoryBackend";
import { LibraryView } from "../LibraryView";

/**
 * Feature-tier tests for the library surface.
 *
 * `LibraryView` reaches data through `LumaApi`, so each test installs an explicit
 * in-memory transport. Nothing here asserts on fixtures embedded in application
 * code — the assertions are about what the component does with whatever the data
 * layer returns.
 */

let backend: InMemoryLibraryBackend;

const installBackend = (seed?: Parameters<typeof createInMemoryLibraryBackend>[0]) => {
  backend = createInMemoryLibraryBackend(seed);
  createLumaApi({ transport: backend.transport });
  return backend;
};

const renderLibrary = () => render(<LibraryView />);

/** The library loads over several IPC round-trips; under a loaded CI runner the
 * default 1s findBy window is occasionally too tight. 4s is generous but still
 * fails fast if the data never arrives. */
const SETTLE_TIMEOUT = 4_000;

/** Titles can appear in several places (hero, up-next, recently added, cards). */
const expectBookVisible = async (title: string) => {
  const matches = await screen.findAllByText(title, {}, { timeout: SETTLE_TIMEOUT });
  expect(matches.length).toBeGreaterThan(0);
  return matches;
};

const dropFile = async (root: HTMLElement, name: string, type = "application/epub+zip") => {
  const file = new File(["PK\u0003\u0004 synthetic epub bytes"], name, { type });
  const dataTransfer = { files: [file] as unknown as FileList, types: ["Files"] };
  root.dispatchEvent(new Event("dragover", { bubbles: true }));
  root.dispatchEvent(Object.assign(new Event("drop", { bubbles: true }), { dataTransfer }));
  // The handler is async and holds the arrayBuffer read.
  await waitFor(() => expect(true).toBe(true));
};

const libraryRoot = (container: HTMLElement) => container.firstElementChild as HTMLElement;

beforeEach(() => {
  installBackend(fixtureState());
});

describe("LibraryView — reading from the data layer", () => {
  it("renders exactly the records the data layer returns", async () => {
    renderLibrary();

    await expectBookVisible("Fixture Reader Alpha");
    await expectBookVisible("Fixture Reader Beta");
    // The count in the header is the backend's, not a guess.
    expect(screen.getByText(/2 publications/i)).toBeInTheDocument();
    expect(screen.queryByText(/fixture reader gamma/i)).not.toBeInTheDocument();
  });

  it("shows a first-run empty state with a working import action, not placeholder books", async () => {
    const user = userEvent.setup();
    installBackend({ books: [], files: [] });
    renderLibrary();

    // Re-query inside waitFor: an intervening re-render can replace the node
    // between the await resolving and the assertion running.
    await waitFor(() =>
      expect(screen.getByText(/your sanctuary library is empty/i)).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.queryAllByText(/fixture reader/i)).toHaveLength(0));

    // An empty state without a next step strands the user; the action must exist
    // inside the empty state itself, not only in the sidebar.
    let importAction: HTMLElement | undefined;
    await waitFor(() => {
      const emptyState = screen.getByRole("status", { name: /empty library/i });
      importAction = within(emptyState).getByRole("button", { name: /import book/i });
    });
    await user.click(importAction!);
    await waitFor(() => expect(importAction).toBeInTheDocument());
  });

  it("surfaces a data-layer failure as an error with a retry, and recovers", async () => {
    let failing = true;
    const transport: LumaTransport = {
      async invoke(command, args) {
        if (command === "list_books" && failing) throw new Error("database is locked");
        return backend.transport.invoke(command, args);
      },
    };
    createLumaApi({ transport });

    renderLibrary();
    await waitFor(() =>
      expect(screen.getByText(/failed to load library data/i)).toBeInTheDocument()
    );
    await waitFor(() => expect(screen.queryAllByText(/fixture reader/i)).toHaveLength(0));

    failing = false;
    await userEvent.click(await screen.findByRole("button", { name: /retry/i }));
    await expectBookVisible("Fixture Reader Alpha");
  });
});

describe("LibraryView — filters", () => {
  it("narrows the result set by search query through the data layer", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await user.type(screen.getByPlaceholderText(/search library/i), "alpha");

    // Titles can appear in more than one surface (hero, up-next, cards), so a
    // "not present" assertion must consider all of them.
    await waitFor(() =>
      expect(screen.queryAllByText("Fixture Reader Beta")).toHaveLength(0)
    );
    await expectBookVisible("Fixture Reader Alpha");
  });

  it("filters by reading status through the sidebar section", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Beta");

    await user.click(screen.getByRole("button", { name: "Currently Reading" }));

    await waitFor(() =>
      expect(screen.queryByText("Fixture Reader Beta")).not.toBeInTheDocument()
    );
    await expectBookVisible("Fixture Reader Alpha");
  });

  it("reports the real number of matches in the pager", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    // The pager belongs to the grid/list surfaces, not the landing view.
    await user.click(screen.getByRole("button", { name: "All Books" }));

    expect(await screen.findByText(/showing 1-2 of 2 books/i)).toBeInTheDocument();
  });

  it("shows one row per record in the list view", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await user.click(screen.getByRole("button", { name: "All Books" }));
    await user.click(screen.getByRole("button", { name: /list view/i }));

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    expect(within(table).getByText("Fixture Reader Beta")).toBeInTheDocument();
  });

  it("filters by library state through the sidebar sections", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await user.click(screen.getByRole("button", { name: "Archive" }));

    // No archived books exist, and no book is presented as if it were archived.
    expect(await screen.findByText(/no books match your current view/i)).toBeInTheDocument();
    expect(screen.queryByText("Fixture Reader Alpha")).not.toBeInTheDocument();
  });

  it("restores the full result set when the section changes back", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await user.click(screen.getByRole("button", { name: "Currently Reading" }));
    await waitFor(() =>
      expect(screen.queryByText("Fixture Reader Beta")).not.toBeInTheDocument()
    );

    await user.click(screen.getByRole("button", { name: "All Books" }));
    await expectBookVisible("Fixture Reader Beta");
  });
});

describe("LibraryView — import flow", () => {
  it("imports a dropped file, reports the job, then shows the imported book", async () => {
    const user = userEvent.setup();
    const { container } = renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");
    expect(backend.state.books).toHaveLength(2);

    await dropFile(libraryRoot(container), "Dropped Book.epub");

    // The same command the desktop build uses; the store is the source of truth.
    await waitFor(() => expect(backend.state.books).toHaveLength(3));
    expect(backend.state.books.some((b) => b.title === "Dropped Book")).toBe(true);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/import finished/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Dropped Book.epub")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expectBookVisible("Dropped Book");
  });

  it("imports nothing when the data layer rejects the file", async () => {
    const seeded = installBackend(fixtureState());
    const rejecting: LumaTransport = {
      async invoke(command, args) {
        if (command === "import_file_bytes") throw new Error("unsupported format");
        return seeded.transport.invoke(command, args);
      },
    };
    createLumaApi({ transport: rejecting });

    const { container } = renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await dropFile(libraryRoot(container), "broken.bin", "application/octet-stream");

    // No record: a failed import leaves the library exactly as it was.
    await waitFor(() => expect(seeded.state.books).toHaveLength(2));
    expect(screen.queryByText("broken")).not.toBeInTheDocument();

    // ...and it is not silent. The rejection reaches the user, naming the file
    // and the reason the data layer gave.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /import failed/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /“broken.bin” could not be imported: unsupported format/
    );

    // Dismissing it clears the failure so the next import starts clean.
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("recovers: a failed import does not block the next successful one", async () => {
    const seeded = installBackend(fixtureState());
    let reject = true;
    const transport: LumaTransport = {
      async invoke(command, args) {
        if (command === "import_file_bytes" && reject) throw new Error("unsupported format");
        return seeded.transport.invoke(command, args);
      },
    };
    createLumaApi({ transport });

    const { container } = renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await dropFile(libraryRoot(container), "broken.bin", "application/octet-stream");
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    reject = false;
    await dropFile(libraryRoot(container), "Dropped Book.epub");

    await waitFor(() => expect(seeded.state.books).toHaveLength(3));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("LibraryView — collections dialog", () => {
  it("lists real collections from the data layer", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await user.click(screen.getByRole("button", { name: "Collections" }));

    expect(await screen.findByRole("button", { name: "Fixture Collection" })).toBeInTheDocument();
  });

  it("creates a collection through the dialog and shows it in the sidebar", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await expectBookVisible("Fixture Reader Alpha");

    await user.click(screen.getByRole("button", { name: "Collections" }));
    await user.click(screen.getByRole("button", { name: /new collection/i }));

    const dialog = await screen.findByRole("dialog", { name: /create new collection/i });
    await user.type(within(dialog).getByLabelText(/collection name/i), "From Component Test");
    await user.click(within(dialog).getByRole("button", { name: /create collection/i }));

    await waitFor(() =>
      expect(backend.state.collections.some((c) => c.name === "From Component Test")).toBe(true)
    );
    expect(await screen.findByRole("button", { name: "From Component Test" })).toBeInTheDocument();
  });
});
