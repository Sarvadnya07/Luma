# Luma — Frontend Architecture Specification

## 1. Directory Structure

```text
apps/desktop/src/
├── app/
│   └── App.tsx                 # Root router transitioning between Library & Reader
├── features/
│   ├── library/                # Library view, grid/list, sidebar, toolbar, details drawer, metadata edit
│   ├── reader/                 # Reader container, EPUB viewer, PDF viewer, sidebar, typography, selection toolbar
│   └── annotations/            # Annotation lists and cards
├── lib/
│   └── tauri.ts                # Centralized typed LumaApi client with web mock fallback
├── state/
│   └── readerState.ts          # Zustand store managing reading session, settings, and active drawers
├── styles/
│   └── index.css               # Global Tailwind CSS and typography tokens
└── main.tsx                    # Vite React 19 entry point
```

---

## 2. Package Separation & Monorepo Boundaries
- `@luma/shared-types`: Canonical TypeScript interfaces mirroring Rust domain entities (`Book`, `BookFile`, `Annotation`, `Bookmark`, `ReadingProgress`, `CompositeAnchor`, `TocItem`, `DocumentMetadata`, `ReaderSettings`).
- `@luma/design-system`: Shared color palettes, annotation highlight tokens (`#fde047`, `#86efac`, `#93c5fd`, `#f472b6`, `#d8b4fe`), and typography constants.
- `@luma/ui`: Reusable atomic UI components (`Button`, `Badge`, `Card`, `Modal`).
- `@luma/library-ui`: Library presentation components (`BookCard`, `BookListItem`).
- `@luma/reader-ui`: Reader shell container, typography theme styling maps (`dark`, `light`, `sepia`, `eink`).
- `@luma/annotation-ui`: Interactive annotation card (`AnnotationItem`).
