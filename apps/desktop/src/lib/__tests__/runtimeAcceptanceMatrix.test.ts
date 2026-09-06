import { describe, it, expect, beforeEach } from "vitest";
import { LumaApi } from "../tauri";
import { Note, Flashcard } from "@luma/shared-types";

class MockLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MockLocalStorage(),
    writable: true,
    configurable: true,
  });
}

describe("CORE-03R Frontend Runtime Matrix & Migration Acceptance", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("migrates legacy localStorage notes and flashcards faithfully", async () => {
    // 1. Setup legacy data in localStorage
    const legacyNotes = [
      {
        id: "legacy_note_01",
        title: "Legacy Epistemology Note",
        content: "Empirical observations require transcendental categories.",
        source_title: "Critique of Pure Reason",
        source_type: "Book",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const legacyCards = [
      {
        id: "legacy_card_01",
        front: "What is an active session?",
        back: "A tracked period of reading recorded in SQLite reading_sessions.",
        deck_id: "default",
        state: "new",
        interval_days: 1,
        ease_factor: 2.5,
        repetitions: 0,
        due_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    localStorage.setItem("luma_notes_workspace", JSON.stringify(legacyNotes));
    localStorage.setItem("luma_flashcards", JSON.stringify(legacyCards));
    expect(localStorage.getItem("luma_knowledge_migrated_v1")).toBeNull();

    // 2. Execute migration
    await LumaApi.migrateLegacyKnowledge();

    // 3. Verify migration flag is stamped
    expect(localStorage.getItem("luma_knowledge_migrated_v1")).toBe("true");

    // 4. Verify data is accessible via LumaApi
    const notes = await LumaApi.listNotes();
    expect(notes.some((n: Note) => n.id === "legacy_note_01" && n.title === "Legacy Epistemology Note")).toBe(true);

    const cards = await LumaApi.listFlashcards();
    expect(cards.some((c: Flashcard) => c.id === "legacy_card_01" && c.front === "What is an active session?")).toBe(true);
  });

  it("repeated migration execution is idempotent and does not duplicate records", async () => {
    const legacyNotes = [
      {
        id: "legacy_note_idempotent",
        title: "Idempotent Note",
        content: "Zero duplication guarantee.",
      },
    ];
    localStorage.setItem("luma_notes_workspace", JSON.stringify(legacyNotes));

    // First migration
    await LumaApi.migrateLegacyKnowledge();
    const countAfterFirst = (await LumaApi.listNotes()).filter(
      (n: Note) => n.id === "legacy_note_idempotent"
    ).length;
    expect(countAfterFirst).toBe(1);

    // Second migration attempt with flag set
    await LumaApi.migrateLegacyKnowledge();
    const countAfterSecond = (await LumaApi.listNotes()).filter(
      (n: Note) => n.id === "legacy_note_idempotent"
    ).length;
    expect(countAfterSecond).toBe(1);

    // Even if flag is reset, upsert avoids duplicate rows
    localStorage.removeItem("luma_knowledge_migrated_v1");
    await LumaApi.migrateLegacyKnowledge();
    const countAfterThird = (await LumaApi.listNotes()).filter(
      (n: Note) => n.id === "legacy_note_idempotent"
    ).length;
    expect(countAfterThird).toBe(1);
  });

  it("tracks reading session lifecycle and updates analytics", async () => {
    const session = await LumaApi.startReadingSession("book_test_session", 0.05);
    expect(session.book_id).toBe("book_test_session");
    expect(session.start_progress_pct).toBe(0.05);

    await LumaApi.completeReadingSession(session.id, 0.45, 1200);

    const analytics = await LumaApi.getReadingAnalytics();
    expect(analytics).toBeDefined();
    expect(Array.isArray(analytics.daily_reading_minutes_last_28_days)).toBe(true);
    expect(analytics.daily_reading_minutes_last_28_days.length).toBe(28);
  });
});
