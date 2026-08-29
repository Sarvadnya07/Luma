# Luma — Reader State & Resumption Model

## 1. Durable vs Ephemeral State

```text
┌────────────────────────────────────────────────────────────┐
│                    DURABLE STATE (SQLite)                  │
├────────────────────────────────────────────────────────────┤
│ • ReadingProgress (locator, chapter, page, percentage)     │
│ • Annotations (CompositeAnchors, highlights, notes)        │
│ • Bookmarks (locator, title, chapter, page)                │
│ • User Settings (theme, font family, font size, spacing)   │
└────────────────────────────────────────────────────────────┘
                              ↕
┌────────────────────────────────────────────────────────────┐
│                    EPHEMERAL STATE (Zustand)               │
├────────────────────────────────────────────────────────────┤
│ • Open document handle / active file ID                    │
│ • Current rendered chapter HTML / active canvas            │
│ • Sidebar tab state (TOC / Annotations / Bookmarks/Search) │
│ • Text selection bounding rects & active popovers          │
│ • Search query and live match list                         │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Resumption Lifecycle
1. On opening a book, Luma queries `reading_progress` for the `book_id`.
2. Resolves initial locator (`epubcfi` or `page=X`).
3. Loads target chapter/page.
4. Restores highlights and bookmarks from local database.
5. Updates `last_read_at` and records progress on subsequent navigation events.
