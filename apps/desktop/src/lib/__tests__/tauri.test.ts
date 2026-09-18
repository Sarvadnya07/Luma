import { beforeEach, describe, expect, it } from "vitest";
import { createLumaApi, LumaApi } from "../tauri";
import { createInMemoryLibraryBackend } from "../../testing/inMemoryBackend";

/**
 * Client contract tests.
 *
 * These run the real `LumaApiClient` against an explicitly installed in-memory
 * backend, so they cover argument marshalling, response shaping and error
 * propagation — not the desktop core (which has its own Rust tests) and not any
 * invented content.
 */
describe("LumaApi client contract", () => {
  beforeEach(() => {
    createLumaApi({ transport: createInMemoryLibraryBackend().transport });
  });

  it("lists active books from the library", async () => {
    const books = await LumaApi.listBooks({ library_state: "active" });
    expect(Array.isArray(books)).toBe(true);
    expect(books.length).toBe(2);
    expect(books.every((b) => b.library_state === "active")).toBe(true);
  });

  it("filters by reading status", async () => {
    const reading = await LumaApi.listBooks({ library_state: "active", reading_status: "reading" });
    expect(reading.map((b) => b.id)).toEqual(["book_fixture_alpha"]);
  });

  it("retrieves full book details with files, authors, tags and progress", async () => {
    const details = await LumaApi.getBookDetails("book_fixture_alpha");

    expect(details?.book.id).toBe("book_fixture_alpha");
    expect(details?.files.length).toBe(1);
    expect(details?.files[0]?.original_filename).toBe("fixture_alpha.epub");
    expect(details?.authors.map((a) => a.name)).toEqual(["Fixture Author Alpha"]);
    expect(details?.reading_progress?.progress_percentage).toBe(0.4);
  });

  it("returns null details for an unknown book rather than inventing one", async () => {
    expect(await LumaApi.getBookDetails("book_does_not_exist")).toBeNull();
  });

  it("performs in-document search over the stored document", async () => {
    const matches = await LumaApi.searchDocument("book_fixture_alpha", "annotation");

    expect(matches.length).toBe(1);
    expect(matches[0]!.chapter_title).toBe("First Synthetic Section");
    expect(matches[0]!.snippet.toLowerCase()).toContain("annotation");
    expect(matches[0]!.locator).toContain("spine:");
  });

  it("returns no matches when the query is absent from the document", async () => {
    expect(await LumaApi.searchDocument("book_fixture_alpha", "zzz-not-present")).toEqual([]);
  });

  it("resolves exact anchors with high confidence", async () => {
    const docText =
      "In software engineering, local-first systems prioritize user ownership and data autonomy.";
    const exact = "user ownership and data autonomy";

    const res = await LumaApi.resolveAnchor(exact, "prioritize ", ".", docText);
    expect(res.status).toBe("highconfidence");
    if (res.status === "highconfidence") {
      expect(res.data.confidence_score).toBe(1.0);
      expect(res.data.matched_text).toBe(exact);
    }
  });

  it("returns failed status for a non-existent anchor quote", async () => {
    const res = await LumaApi.resolveAnchor(
      "Quantum entanglement theorem",
      null,
      null,
      "Simple plain text document content."
    );
    expect(res.status).toBe("failed");
  });

  it("round-trips settings", async () => {
    await LumaApi.setSetting("reader_test", { fontSize: 18, theme: "dark" });
    const val = await LumaApi.getSetting<{ fontSize: number; theme: string }>("reader_test");
    expect(val).toEqual({ fontSize: 18, theme: "dark" });
  });

  it("runs a subsystem diagnostics report", async () => {
    const report = await LumaApi.runDiagnostics();
    expect(report.overall_status).toBe("healthy");
    expect(report.subsystems.length).toBeGreaterThan(0);
    expect(report.timestamp).toBeDefined();
  });

  it("creates and inspects backups", async () => {
    const backup = await LumaApi.createBackup("test_backup");
    expect(backup.id).toBeDefined();
    expect(backup.backup_name).toContain("test_backup");

    const preview = await LumaApi.inspectBackup(backup.file_path);
    expect(preview.manifest.version).toBe(1);
  });

  it("executes maintenance operations", async () => {
    expect((await LumaApi.reconcileFiles()).operation).toBe("reconcile_files");
    expect((await LumaApi.cleanupCaches()).operation).toBe("cleanup_caches");
    expect((await LumaApi.vacuumDatabase()).operation).toBe("vacuum_database");
  });

  it("executes bulk operations over existing books", async () => {
    const books = await LumaApi.listBooks();
    const res = await LumaApi.bulkAddTags(
      books.map((b) => b.id),
      ["Philosophy", "Classics"]
    );
    expect(res.total).toBe(4);
    expect(res.successful).toBe(4);
  });

  it("handles native file pickers and byte import", async () => {
    const pickedFiles = await LumaApi.pickImportFiles();
    expect(Array.isArray(pickedFiles)).toBe(true);

    const pickedDir = await LumaApi.pickImportDirectory();
    expect(pickedDir === null || typeof pickedDir === "string").toBe(true);

    const dummyBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const job = await LumaApi.importFileBytes("test_manual.epub", dummyBytes);
    expect(job.status).toBe("completed");
    expect(job.items.length).toBe(1);
    expect(job.items[0]!.original_filename).toBe("test_manual.epub");

    // The imported record is the only one for that file: no content was invented.
    const books = await LumaApi.listBooks();
    const imported = books.find((b) => b.title === "test_manual");
    expect(imported?.primary_file_id).toBe(job.items[0]!.file_id);
  });
});
