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
});
