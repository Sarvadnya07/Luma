import { describe, it, expect } from "vitest";
import { LumaApi } from "../tauri";

describe("LumaApi client & mock storage", () => {
  it("lists active books from the library", async () => {
    const books = await LumaApi.listBooks({ library_state: "active" });
    expect(books).toBeDefined();
    expect(Array.isArray(books)).toBe(true);
    expect(books.length).toBeGreaterThan(0);
  });

  it("retrieves full book details with files, authors, tags, and progress", async () => {
    const books = await LumaApi.listBooks({ library_state: "active" });
    const bookId = books[0]!.id;
    const details = await LumaApi.getBookDetails(bookId);

    expect(details).toBeDefined();
    expect(details?.book.id).toBe(bookId);
    expect(details?.files.length).toBeGreaterThan(0);
    expect(details?.authors).toBeDefined();
  });

  it("performs in-document search across chapters", async () => {
    const books = await LumaApi.listBooks({ library_state: "active" });
    const bookId = books[0]!.id;
    const matches = await LumaApi.searchDocument(bookId, "annotation");

    expect(matches).toBeDefined();
    expect(Array.isArray(matches)).toBe(true);
    if (matches.length > 0) {
      expect(matches[0]!.locator).toBeDefined();
      expect(matches[0]!.snippet).toContain("Annotation integrity");
    }
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

  it("returns failed status for non-existent anchor quote", async () => {
    const docText = "Simple plain text document content.";
    const exact = "Quantum entanglement theorem";

    const res = await LumaApi.resolveAnchor(exact, null, null, docText);
    expect(res.status).toBe("failed");
  });

  it("handles settings CRUD operations", async () => {
    await LumaApi.setSetting("reader_test", { fontSize: 18, theme: "dark" });
    const val = await LumaApi.getSetting<{ fontSize: number; theme: string }>("reader_test");
    expect(val).toEqual({ fontSize: 18, theme: "dark" });
  });

  it("runs subsystem diagnostics report", async () => {
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
    const reconcile = await LumaApi.reconcileFiles();
    expect(reconcile.operation).toBe("reconcile_files");

    const cacheRes = await LumaApi.cleanupCaches();
    expect(cacheRes.operation).toBe("cleanup_caches");

    const vacuumRes = await LumaApi.vacuumDatabase();
    expect(vacuumRes.operation).toBe("vacuum_database");
  });

  it("executes bulk operations", async () => {
    const res = await LumaApi.bulkAddTags(["book_01", "book_02"], ["Philosophy", "Classics"]);
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
  });
});


