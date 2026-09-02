Absolutely. For **Luma**, I would treat “features” much more broadly than just the visible UI. The complete product surface should cover **core platform, formats, reader, library, knowledge/study, annotations, search, AI, sync, integrations, plugins, security, performance, accessibility, and operational/runtime behavior**.

Below is a **master feature inventory** you can use as the canonical checklist for the project.

# Luma — Complete Product & Engineering Feature Inventory

## 1. Core Application Foundation

### Application shell

* Desktop application shell
* Cross-platform support
* Tauri 2 native shell
* React frontend
* Rust backend
* WASM-capable core/anchor components
* Application lifecycle management
* Startup initialization
* Graceful shutdown
* Crash recovery
* State restoration
* Window management
* Multiple windows
* Window sizing persistence
* Window position persistence
* Fullscreen
* Minimize/maximize
* Native menus
* Context menus
* Keyboard shortcuts
* Command palette
* Global actions
* Deep links
* File association
* Drag-and-drop
* URI/file opening
* Single-instance behavior
* Application update mechanism

### Local-first architecture

* Fully local library
* Offline operation
* No compulsory account
* No compulsory cloud
* Local database
* Local filesystem storage
* Local indexing
* Local annotations
* Local reading progress
* Local settings
* Local AI support
* Local backup
* Local export
* Local diagnostics

---

# 2. Library Management

## Library

* All books
* Recently added
* Recently read
* Continue reading
* Currently reading
* Finished
* Unfinished
* Favorites
* Pinned books
* Archived books
* Trash
* Missing-file books
* Failed-import books

## Library views

* Grid view
* List view
* Compact list
* Detailed list
* Cover-only view
* Table view
* Responsive layout
* Configurable columns
* Configurable card density
* Adjustable thumbnail size

## Sorting

* Title
* Author
* Date added
* Date modified
* Last read
* Reading progress
* Rating
* File size
* Publication date
* Series
* Publisher
* Language
* Format
* Custom sort

## Filtering

* Format
* Author
* Series
* Collection
* Tag
* Rating
* Reading status
* Favorite
* Progress range
* Date added
* Date read
* Language
* Publisher
* File availability
* Annotation availability
* Bookmark availability

## Library organization

* Collections
* Nested collections
* Tags
* Smart collections
* Saved filters
* Custom shelves
* Reading lists
* Series grouping
* Author grouping
* Publisher grouping
* Genre grouping
* Language grouping

---

# 3. Book Metadata

## Metadata fields

* Title
* Subtitle
* Authors
* Contributors
* Translator
* Editor
* Illustrator
* Publisher
* Publication date
* ISBN
* ASIN where applicable
* Series
* Series number
* Edition
* Language
* Genres
* Categories
* Tags
* Description
* Copyright
* Identifier
* File format
* File size
* Page count
* Word count
* Duration where applicable

## Metadata management

* Automatic extraction
* Manual editing
* Metadata normalization
* Duplicate metadata merging
* Metadata refresh
* Metadata lock/freeze
* Metadata inheritance
* Metadata validation
* Bulk metadata editing
* Metadata import
* Metadata export

## Cover

* Embedded cover extraction
* External cover import
* Cover replacement
* Cover regeneration
* Cover caching
* Thumbnail generation
* Cover resize
* Cover quality settings
* Missing-cover fallback
* Cover cleanup

---

# 4. Book/File Architecture

This is important for Luma's data model.

A logical **Book** should be separable from its physical **BookFile**.

Capabilities:

* One book → multiple files
* Multiple editions
* Multiple formats
* Alternate copies
* File replacement
* File relinking
* Missing-file detection
* File relocation
* File rename detection
* File checksum
* File identity
* Duplicate detection
* Edition detection
* Format variants
* File history

---

# 5. Import & Ingestion

## Import sources

* File picker
* Folder import
* Recursive folder import
* Drag-and-drop
* Multiple-file import
* Network-mounted folders
* External drives
* Watch folders
* Clipboard/file URI import

## Formats

* EPUB
* EPUB 2
* EPUB 3
* PDF
* CBZ
* CBR
* TXT
* Markdown
* HTML
* XHTML
* potentially MOBI/AZW where licensing/parser availability permits
* comic/manga formats
* future extensible format plugins

## Import pipeline

* MIME detection
* Extension detection
* File signature detection
* Format validation
* Metadata extraction
* Cover extraction
* Content extraction
* File hashing
* Duplicate detection
* Book identity resolution
* Author association
* Series association
* Tag extraction
* Collection assignment
* Search indexing
* Thumbnail generation
* Database transaction
* Import progress
* Import cancellation
* Import retry
* Import error recovery
* Import reporting

## Bulk import

* Batch imports
* Bounded concurrency
* Chunking
* Backpressure
* Progress aggregation
* Per-file status
* Failure isolation
* Retry failed items
* Resume interrupted import

---

# 6. Duplicate & Identity System

Possible duplicate levels:

* Exact file hash
* Same logical book
* Same title/author
* Same ISBN/identifier
* Same edition
* Similar metadata
* Similar content

Actions:

* Ignore
* Keep both
* Replace
* Merge metadata
* Merge files
* Mark editions
* User confirmation

---

# 7. File Lifecycle

* Move file
* Copy file
* Relink file
* Rename
* Delete
* Move to trash
* Restore
* Permanent deletion
* Missing-file detection
* File watcher
* External modification detection
* File integrity verification
* Checksum recalculation
* Storage relocation

---

# 8. EPUB Reader

## EPUB parsing

* Container.xml
* OPF
* Manifest
* Spine
* TOC
* Navigation document
* XHTML
* CSS
* Embedded fonts
* Images
* SVG
* MathML
* Footnotes
* Endnotes
* Links
* Internal anchors
* External links

## Reader behavior

* Continuous scrolling
* Paginated mode
* Single-page mode
* Multi-page/spread mode
* Chapter navigation
* Previous/next chapter
* Table of contents navigation
* Page/position navigation
* Go to percentage
* Go to location
* Search within book
* Find next/previous
* Reading position restoration

## EPUB layout

* Reflow
* Font size
* Font family
* Line height
* Letter spacing
* Word spacing
* Margins
* Paragraph spacing
* Text width
* Alignment
* Hyphenation
* Columns
* Page width
* Theme
* Custom CSS
* Publisher styling toggle
* Justification toggle

## EPUB media

* Images
* SVG
* Audio
* Video
* Animated content where supported
* Image zoom
* Image fullscreen

---

# 9. PDF Reader

## PDF core

* PDF loading
* Outline
* Page count
* Page navigation
* Jump to page
* Continuous mode
* Single page
* Two-page view
* Page rotation
* Zoom
* Fit width
* Fit page
* Actual size

## Rendering

* Canvas rendering
* High DPI
* Lazy page rendering
* Page caching
* Thumbnail rendering
* Thumbnail caching
* Prefetching
* Render cancellation
* Background rendering

## PDF content

* Text extraction
* Search
* Text selection
* Links
* Annotations
* Form fields where supported
* Images
* Embedded fonts

## Special PDFs

* Scanned PDF
* Image-only PDF
* Mixed PDF
* Large PDFs
* Password-protected PDFs where supported
* malformed/corrupt PDFs
* encrypted PDFs where legally/technically supported

### Critical rule

**Visual PDF rendering must never depend on text extraction.**

Scanned pages must still visually render even when no text layer exists.

---

# 10. Comic / Manga Reader

* CBZ
* CBR
* Page navigation
* Vertical reading
* Horizontal reading
* Manga right-to-left mode
* Double-page spreads
* Page scaling
* Fit width
* Fit height
* Image smoothing
* Panel/page navigation
* Reading direction setting
* Image prefetch
* Thumbnail strip

---

# 11. Text / Markdown / HTML Reading

* TXT reader
* Markdown renderer
* HTML renderer
* XHTML renderer
* Code blocks
* Tables
* Images
* Links
* Headings
* Lists
* Footnotes
* Search
* Text selection
* annotations

---

# 12. Reader Controls

* Previous page
* Next page
* Previous chapter
* Next chapter
* Table of contents
* Search
* Bookmark
* Highlight
* Note
* Zoom
* Settings
* Typography
* Theme
* Fullscreen
* Focus mode
* Reading progress
* Page number
* Chapter progress
* Navigation history

---

# 13. Reader Themes & Appearance

### Built-in themes

* Classical light
* Paper
* Sepia
* Warm
* Cool
* High contrast
* Dark
* OLED/dark where appropriate

### Customization

* Background
* Text color
* Accent
* Font
* Font weight
* Font size
* Line height
* Margins
* Reading width
* Column width
* Page spacing
* UI density

---

# 14. Selection & Contextual Tools

Text selection should expose:

* Highlight
* Underline
* Strikethrough
* Note
* Copy
* Search
* Dictionary
* Translate
* Explain
* Ask AI
* Define
* Add tag
* Add to vocabulary
* Add to study notes
* Share/export

---

# 15. Annotation System

This is one of Luma's major differentiators.

## Annotation types

* Highlight
* Underline
* Strikethrough
* Note
* Bookmark
* Margin note
* Drawing where supported
* Area annotation for PDF
* Freehand annotation where supported

## Annotation anchor model

* Exact quote
* Prefix context
* Suffix context
* Character offsets
* EPUB CFI
* DOM path
* PDF coordinates
* Page number
* Bounding box
* Document fingerprint
* Content hash

## Anchor recovery

* Exact match
* Normalized match
* Context match
* Position match
* Fuzzy match
* N-gram match
* Levenshtein similarity
* Candidate ranking
* Confidence score

## Confidence

* High
* Ambiguous
* Failed

## Recovery

* Automatic restoration
* Multiple candidate detection
* User confirmation
* Manual re-anchor
* Anchor repair
* Annotation migration
* Annotation diagnostics

## Annotation management

* Annotation list
* Filter annotations
* Search annotations
* Group by book
* Group by chapter
* Group by tag
* Group by type
* Export annotations
* Import annotations
* Delete
* Edit
* Resolve failed anchors

---

# 16. Bookmarks

* Page bookmark
* Position bookmark
* Chapter bookmark
* Named bookmark
* Bookmark notes
* Bookmark categories
* Bookmark search
* Bookmark sorting
* Bookmark export

---

# 17. Reading Progress

* Current position
* Percentage
* Chapter
* Page
* Last opened
* Reading time
* Start date
* Completion date
* Estimated remaining time
* Reading speed
* Progress history
* Resume last position

## Progress persistence

* Immediate local state
* Debounced writes
* Safe shutdown persistence
* Crash recovery
* Multi-device reconciliation

---

# 18. History

* Recently opened
* Recently finished
* Recently searched
* Recently annotated
* Reading history
* Navigation history
* Last position history
* Undo/redo where applicable

---

# 19. Search

## Library search

* Title
* Author
* Series
* Publisher
* Tags
* Collections
* Metadata
* Format
* Full-text

## Book search

* Full text
* Chapter
* Highlight
* Note
* Bookmark
* Footnotes

## Advanced search

* Boolean operators
* Prefix search
* Phrase search
* Fuzzy search
* Field search
* Filters
* Date ranges
* Progress filters

## Search UX

* Instant results
* Debouncing
* Cancellation
* Latest-result-wins
* Search history
* Saved searches
* Result highlighting

---

# 20. FTS / Indexing

* SQLite FTS5
* Metadata indexes
* Book-content indexes
* Incremental indexing
* Background indexing
* Reindex
* Index repair
* Index status
* Index progress
* Index cancellation
* Index consistency check

---

# 21. Collections

* Manual collections
* Nested collections
* Smart collections
* Dynamic collections
* Collection rules
* Drag-and-drop membership
* Bulk add/remove
* Collection sorting
* Collection cover

Examples:

* To Read
* Studying
* Research
* Favorites
* Currently Reading
* Finished

---

# 22. Tags

* User tags
* System tags
* Automatic tags
* Bulk tagging
* Tag rename
* Merge tags
* Remove tags
* Tag filtering
* Tag hierarchy

---

# 23. Authors & Series

## Author pages

* Author name
* Biography
* Works
* Series
* Reading history

## Series

* Series grouping
* Series number
* Reading order
* Missing volumes
* Series completion
* Alternate editions

---

# 24. Reading Statistics

* Books read
* Books finished
* Pages read
* Words read
* Reading time
* Average session
* Reading streak
* Daily activity
* Weekly activity
* Monthly activity
* Yearly activity
* Favorite authors
* Favorite genres
* Reading speed
* Completion rate

---

# 25. Goals & Habits

* Daily reading goal
* Weekly goal
* Monthly goal
* Annual goal
* Books-per-year
* Pages-per-day
* Minutes-per-day
* Reading streak
* Goal notifications
* Progress visualization

---

# 26. Study System

This is part of the major **Deep Study / Knowledge System** direction.

## Study mode

* Focused reading
* Highlight workflow
* Notes workflow
* Question generation
* Concept extraction
* Review mode
* Study sessions
* Study summaries

## Notes

* Book notes
* Chapter notes
* Annotation-linked notes
* Standalone notes
* Rich text notes
* Markdown notes
* Tags
* Backlinks
* References

---

# 27. Knowledge Graph / Knowledge System

Potential entities:

* Book
* Chapter
* Author
* Concept
* Person
* Place
* Event
* Quote
* Annotation
* Note
* Source
* Tag
* Collection

Relationships:

* cites
* references
* contradicts
* supports
* related-to
* derived-from
* appears-in
* written-by

Features:

* backlinks
* graph view
* related concepts
* source provenance
* concept pages
* citation trails

---

# 28. Research Workspace

* Multi-book workspace
* Split reader
* Side-by-side books
* Compare passages
* Parallel search
* Shared annotation panel
* Notes panel
* Citation manager
* Research timeline
* Source list
* Evidence table
* Quote collection

---

# 29. Cross-Document Operations

* Search across library
* Search across collection
* Search across selected books
* Compare documents
* Compare editions
* Compare translations
* Cross-book annotations
* Cross-document notes
* Global bookmarks
* Global highlights

---

# 30. Citation & Provenance

* Source book
* Edition
* Chapter
* Page
* EPUB location
* PDF page
* Quote
* Source anchor
* Citation metadata
* Citation export
* Provenance chain

Export targets:

* Markdown
* BibTeX
* CSL/JSON
* plain text
* HTML

---

# 31. Dictionary & Language Tools

* Dictionary lookup
* Definition
* Pronunciation
* Phonetics
* Word origin
* Examples
* Synonyms
* Antonyms
* Translation
* Language detection
* Custom dictionaries
* Offline dictionaries
* User vocabulary

---

# 32. Vocabulary System

* Save word
* Definition
* Context sentence
* Source book
* Review words
* Spaced repetition
* Difficulty
* Mastery
* Flashcards
* Vocabulary export

---

# 33. Translation

* Selected text translation
* Paragraph translation
* Chapter translation
* Offline translation
* Local translation models
* Translation history
* Source/target language
* Preserve annotations

---

# 34. Text-to-Speech

* Read aloud
* Play/pause
* Skip
* Speed
* Voice
* Language
* Highlight current sentence
* Auto-scroll
* Background playback
* Chapter continuation

---

# 35. AI / Ollama Integration

## Local AI

* Ollama integration
* Model discovery
* Model selection
* Model health
* Connection status
* Context window management
* Model capability detection

## AI reading tools

* Explain selection
* Summarize chapter
* Summarize book
* Simplify text
* Rewrite
* Ask questions
* Extract concepts
* Generate study questions
* Generate flashcards
* Compare texts
* Explain difficult passages
* Translate
* Define terms
* Generate notes

## AI provenance

* Model used
* Prompt context
* Source passages
* Token usage
* Timestamp
* Generated output
* Citation links
* User confirmation

---

# 36. AI Safety / Privacy

* Local-only mode
* Explicit AI enablement
* No silent uploads
* Context controls
* Source selection
* Maximum context limits
* Sensitive-content warning where applicable
* Model permissions
* Prompt logging controls
* Delete AI history

---

# 37. Sync

## Multi-device sync

* Reading progress
* Bookmarks
* Annotations
* Notes
* Metadata
* Collections
* Tags
* Settings

## Sync architecture

* Local-first
* Offline queue
* Change log
* Conflict detection
* Conflict resolution
* Versioning
* Device identity
* Sync status
* Retry
* Pause/resume
* Selective sync

---

# 38. Backup

* Full backup
* Incremental backup
* Scheduled backup
* Manual backup
* Backup verification
* Backup history
* Backup retention
* Restore
* Selective restore
* Encrypted backup
* Portable backup
* Export archive

---

# 39. Data Portability

* Library export
* Book metadata export
* Annotation export
* Bookmark export
* Notes export
* Reading history export
* Settings export
* Full database export
* Portable library package
* Import from other reader formats

Potential formats:

* JSON
* CSV
* Markdown
* HTML
* TXT
* EPUB annotation formats where applicable
* PDF annotation formats where applicable
* OPDS-compatible metadata

---

# 40. OPDS / External Library Integration

Potential features:

* OPDS catalog browsing
* OPDS authentication where supported
* Remote catalog import
* Metadata fetching
* Download/import integration
* Calibre integration
* Local network library
* External storage

---

# 41. Cloud / Storage Integrations

Optional, never compulsory for core functionality:

* WebDAV
* S3-compatible storage
* Google Drive
* Dropbox
* OneDrive
* Syncthing
* generic filesystem sync

---

# 42. Notifications

* Import completed
* Import failed
* Backup completed
* Backup failed
* Sync conflict
* Sync completed
* Goal reached
* Reading streak
* Update available
* AI model unavailable
* Library maintenance required

---

# 43. Settings

## General

* Startup behavior
* Language
* Theme
* UI scale
* Default reader
* Default import location

## Reader

* Font
* Size
* Spacing
* Margins
* Page mode
* Theme
* Default zoom
* Reading direction

## Library

* Default view
* Sorting
* Grouping
* Cover size
* Metadata display

## Storage

* Library directory
* Cache directory
* Backup directory
* Temporary directory

## Search

* Search scope
* Index settings
* Highlight settings

## AI

* Provider
* Ollama endpoint
* Model
* Context length
* Privacy settings

## Sync

* Provider
* Frequency
* Device
* Conflict handling

## Accessibility

* Motion
* High contrast
* Screen-reader behavior
* Font scaling
* Keyboard navigation

---

# 44. Accessibility

* Full keyboard navigation
* Focus management
* Focus visibility
* Screen-reader support
* Semantic HTML
* ARIA where necessary
* High contrast
* Reduced motion
* Adjustable text size
* Adjustable UI scale
* Color-independent state
* Keyboard shortcuts
* Accessible dialogs
* Accessible menus
* Accessible tooltips
* Accessible reader controls

---

# 45. Localization / Internationalization

* UI translations
* Date/time localization
* Number formatting
* RTL UI
* RTL reading
* Arabic/Hebrew support
* CJK typography
* Devanagari
* Unicode normalization
* Locale-aware sorting
* Language metadata
* Localized metadata

---

# 46. Security

## File security

* Path traversal protection
* Archive bomb protection
* File size limits
* Entry count limits
* Symlink handling
* Safe extraction
* Temp directory isolation

## Content security

* HTML sanitization
* Script stripping
* iframe policy
* unsafe URL filtering
* CSS restrictions
* JavaScript isolation

## Database

* SQL parameterization
* Migration integrity
* Foreign key constraints
* WAL correctness
* corruption checks

## Cryptography

* SHA-256 integrity
* Encrypted backups
* secure secret handling
* key management

## Tauri security

* Capability restrictions
* command allowlists
* IPC validation
* filesystem permissions
* external URL restrictions

---

# 47. Data Integrity

* Foreign keys
* Transactions
* Referential integrity
* Migration checks
* Orphan detection
* Repair tools
* Consistency checks
* Duplicate cleanup
* Missing-file reconciliation
* Annotation integrity verification
* Search-index consistency
* Backup validation

---

# 48. Maintenance

* Database vacuum
* WAL checkpoint
* Cache cleanup
* Thumbnail cleanup
* orphan cleanup
* stale file cleanup
* index rebuild
* repair database
* repair metadata
* migration management
* storage analysis

---

# 49. Diagnostics

* Application diagnostics
* Database diagnostics
* Import diagnostics
* Reader diagnostics
* Search diagnostics
* Sync diagnostics
* AI diagnostics
* Performance diagnostics
* Cache statistics
* Memory diagnostics
* event diagnostics
* IPC diagnostics
* log viewer
* export diagnostics

---

# 50. Error Handling

Every major subsystem should support:

* Structured errors
* User-friendly messages
* Technical error details
* Retry
* Cancellation
* Recovery
* Recovery suggestions
* Logging
* Error IDs
* Error boundaries
* Graceful degradation

Special cases:

* corrupt EPUB
* corrupt PDF
* missing file
* permission denied
* disk full
* invalid metadata
* duplicate import
* database corruption
* broken annotation
* failed search index
* unavailable AI
* sync conflict

---

# 51. Background Jobs

* Import jobs
* Index jobs
* Thumbnail jobs
* Backup jobs
* Maintenance jobs
* Metadata jobs
* Sync jobs
* AI jobs
* Cleanup jobs

Capabilities:

* Queue
* Priority
* Progress
* Cancellation
* Retry
* Concurrency limits
* Failure isolation
* Persistence
* Recovery
* graceful shutdown

---

# 52. Performance Architecture

## Database

* WAL
* prepared statements
* indexes
* query plans
* batching
* pagination
* bounded queries
* FTS5

## Reader

* document sessions
* lazy loading
* resource reuse
* bounded caches
* page prefetch
* chapter reuse

## Frontend

* virtualization
* memoization where useful
* lazy rendering
* code splitting
* debouncing
* state locality

## IPC

* consolidated commands
* bounded payloads
* event coalescing
* cancellation
* less round-tripping

## Memory

* resource lifetime management
* cache bounds
* task cleanup
* listener cleanup
* document disposal

---

# 53. Performance Metrics

Track measurable metrics such as:

* startup latency
* first library content
* EPUB first content
* EPUB chapter navigation
* PDF first canvas
* PDF page turn
* PDF random access
* zoom
* search
* annotation persistence
* import throughput
* database query latency
* IPC count
* IPC payload size
* memory footprint
* cache hit rate
* task queue depth
* CPU utilization

---

# 54. Testing

## Unit tests

* parsers
* models
* repositories
* anchors
* search
* security
* utilities

## Integration tests

* database
* import
* reader
* annotations
* migrations
* services

## End-to-end

* launch
* import
* library
* open book
* search
* annotation
* progress
* backup

## Regression

* known bugs
* format compatibility
* anchor recovery
* rendering failures

## Performance

* benchmarks
* scale tests
* memory tests
* concurrency tests

---

# 55. Reader Compatibility Testing

### EPUB

* EPUB 2
* EPUB 3
* reflow
* RTL
* complex CSS
* embedded fonts
* footnotes
* SVG
* image-heavy books
* malformed EPUBs

### PDF

* text PDFs
* scanned PDFs
* image-heavy
* vector-heavy
* large PDFs
* malformed PDFs
* password/encryption
* mixed content

### Comics

* high-resolution images
* huge CBZ
* RTL manga
* double spreads

---

# 56. Import/Export Compatibility

Potential compatibility ecosystem:

* Calibre
* Koodo Reader
* Readwise
* Zotero
* Obsidian
* Markdown workflows
* generic JSON
* generic CSV
* EPUB annotations
* PDF annotations

---

# 57. Plugin Architecture

Long-term plugin system:

* Plugin manifest
* Permissions
* Sandboxing
* Plugin lifecycle
* Plugin storage
* Plugin settings
* Plugin commands
* Plugin UI extensions
* Reader extensions
* Importer extensions
* Exporter extensions
* Metadata providers
* AI providers
* Dictionaries
* Themes
* Language packs

Security:

* capability-based permissions
* explicit approval
* version compatibility
* plugin isolation
* signing/verification

---

# 58. Developer Experience

* Monorepo
* Clear crate/package boundaries
* Shared types
* API contracts
* Documentation
* ADRs
* Architecture diagrams
* Development scripts
* Formatting
* linting
* type checking
* test runners
* benchmark tooling
* diagnostics
* local fixtures

---

# 59. CI/CD

* Rust build
* WASM build
* frontend build
* Windows build
* Linux build
* macOS build
* tests
* lint
* security scanning
* dependency auditing
* artifact generation
* release packaging
* installer generation
* version validation
* changelog

---

# 60. Release & Update System

* semantic versioning
* release notes
* migration support
* database migration compatibility
* update check
* optional auto-update
* rollback strategy
* portable builds
* installer
* signed artifacts

---

# 61. Cross-Platform

### Windows

* WebView2
* installer
* file associations
* Windows paths
* shell integration

### macOS

* app bundle
* file associations
* sandbox considerations
* native menus

### Linux

* AppImage
* DEB
* desktop integration
* MIME registration

---

# 62. UX / Product Polish

* onboarding
* empty states
* first-run setup
* import wizard
* command palette
* contextual menus
* tooltips
* undo/redo
* confirmations
* progress UI
* skeleton states
* loading states
* error states
* success feedback
* keyboard-first workflows
* responsive layouts
* consistent spacing
* consistent typography
* iconography
* animation
* reduced-motion mode

---

# 63. Reader UX Polish

* distraction-free reading
* focus mode
* minimal chrome
* reader toolbar auto-hide
* smooth navigation
* page transitions
* reading position indicator
* chapter indicator
* progress indicator
* immersive fullscreen
* persistent reader preferences

---

# 64. Power User Features

* command palette
* configurable shortcuts
* custom keybindings
* advanced search
* saved searches
* batch operations
* bulk metadata editing
* bulk tagging
* bulk collection operations
* scripting/API
* developer mode
* diagnostics mode
* import/export tooling

---

# 65. Automation / Workflows

Potential workflow engine:

```text
WHEN:
book imported

THEN:
extract metadata
→ assign tags
→ add collection
→ generate cover
→ index
```

Other triggers:

* book opened
* book completed
* annotation created
* tag added
* file changed
* sync completed

Actions:

* organize
* tag
* export
* backup
* generate AI summary
* create study notes

---

# 66. Privacy

* Offline by default
* No telemetry by default
* Local analytics only
* Local AI
* Explicit cloud consent
* Data export
* Data deletion
* Clear cache
* Clear history
* Clear AI context
* Clear search history

---

# 67. Observability

Internal instrumentation:

* structured logs
* trace IDs
* performance markers
* subsystem timings
* event counts
* IPC metrics
* database metrics
* cache metrics
* job metrics
* memory metrics

But:

**user content must not be logged by default.**

---

# 68. Reliability / Recovery

* Crash-safe progress
* Transactional writes
* Import resume
* Job recovery
* startup recovery
* database recovery
* backup recovery
* corrupted-file isolation
* stale-state reconciliation
* interrupted migration protection

---

# 69. Data Migration

* Schema migrations
* Version detection
* Migration preview
* Backup before migration
* Migration rollback strategy
* Legacy import
* Data normalization
* Conflict handling

---

# 70. Advanced Reading Analytics

Potential future functionality:

* reading heatmap
* chapter dwell time
* reading velocity
* difficult passages
* annotation density
* topic distribution
* author statistics
* genre statistics
* reading calendar
* yearly review

This should remain privacy-first and local.

---

# 71. Future Experimental Features

Potential long-term features:

* handwriting annotations
* stylus support
* OCR
* diagram extraction
* table extraction
* mathematical formula extraction
* semantic search
* local embeddings
* semantic library recommendations
* automatic concept maps
* AI tutor
* Socratic reading mode
* debate mode
* comparative reading
* translation alignment
* parallel editions
* automatic bibliography
* citation graph
* knowledge graph visualization
* flashcard generation
* spaced repetition
* research assistant
* study plans

---

# 72. Internal Architecture Capabilities

Your existing architecture can map to:

| Component       | Responsibility                  |
| --------------- | ------------------------------- |
| `luma-core`     | domain models/core primitives   |
| `luma-anchor`   | annotation anchoring/recovery   |
| `luma-reader`   | format parsing/reading          |
| `luma-storage`  | filesystem/database persistence |
| `luma-search`   | indexing/search                 |
| `luma-sync`     | synchronization                 |
| `luma-ai`       | local AI                        |
| `luma-security` | validation/security             |

Supporting layers:

* repositories
* application services
* event bus
* jobs
* cache
* IPC bridge
* frontend state
* telemetry
* diagnostics
* migrations

---

# 73. Core “Must Always Work” Contract

Regardless of how many advanced features are added, this is the **non-negotiable Luma foundation**:

```text
IMPORT
  ↓
IDENTIFY
  ↓
STORE
  ↓
INDEX
  ↓
DISPLAY IN LIBRARY
  ↓
OPEN
  ↓
RENDER CORRECTLY
  ↓
READ
  ↓
SEARCH
  ↓
SELECT
  ↓
ANNOTATE
  ↓
SAVE
  ↓
RESTORE
  ↓
REOPEN
  ↓
CONTINUE
```

For every format:

```text
REAL FILE
→ REAL IMPORT
→ REAL LIBRARY RECORD
→ REAL READER
→ REAL PERSISTENCE
```

No mock data.
No fake success states.
No hardcoded books.
No simulated reader content.

---

# 74. Luma's Major Product Pillars

I would ultimately organize the project into **12 major pillars**:

### 1. **Library**

Books, metadata, collections, tags, organization.

### 2. **Reading**

EPUB, PDF, comics, text, HTML, reader controls.

### 3. **Annotations**

Highlights, notes, bookmarks, robust anchor recovery.

### 4. **Search**

Library FTS, document search, advanced search, semantic search.

### 5. **Knowledge**

Notes, concepts, backlinks, provenance, knowledge graph.

### 6. **Study**

Study mode, flashcards, summaries, review, research workspace.

### 7. **AI**

Ollama, local models, explanations, summaries, research assistance.

### 8. **Sync**

Devices, conflicts, offline-first synchronization.

### 9. **Integrations**

OPDS, Calibre, WebDAV, cloud storage, exports.

### 10. **Automation**

Workflows, smart collections, automatic organization.

### 11. **Platform**

Security, performance, accessibility, reliability, diagnostics.

### 12. **Extensibility**

Plugins, providers, themes, importers, exporters, integrations.

---

# 75. The Most Important P0/P1 Capability Matrix

Before expanding deeply into AI, plugins, or knowledge graphs, I would ensure these are genuinely working end-to-end:

| Capability                       | Priority |
| -------------------------------- | -------- |
| Real EPUB import                 | **P0**   |
| Real PDF import                  | **P0**   |
| EPUB visual rendering            | **P0**   |
| PDF visual rendering             | **P0**   |
| Scanned PDF rendering            | **P0**   |
| Library persistence              | **P0**   |
| Reading progress                 | **P0**   |
| EPUB TOC/navigation              | **P0**   |
| PDF navigation                   | **P0**   |
| Text selection                   | **P0**   |
| Search                           | **P0**   |
| Highlight                        | **P0**   |
| Notes                            | **P0**   |
| Bookmarks                        | **P0**   |
| Annotation persistence           | **P0**   |
| Annotation recovery after reflow | **P0**   |
| Crash-safe state                 | **P0**   |
| Import error handling            | **P0**   |
| Database integrity               | **P0**   |
| Security validation              | **P0**   |
| Library scalability              | **P1**   |
| PDF performance                  | **P1**   |
| EPUB performance                 | **P1**   |
| Accessibility                    | **P1**   |
| Backup/restore                   | **P1**   |
| Advanced search                  | **P1**   |
| Collections/tags                 | **P1**   |
| Statistics                       | **P1**   |
| Study system                     | **P1**   |
| Local AI/Ollama                  | **P1**   |
| Cross-device sync                | **P1**   |
| Research workspace               | **P2**   |
| Knowledge graph                  | **P2**   |
| Plugins                          | **P2**   |
| Automation engine                | **P2**   |

## The strategic endpoint

Luma should not become **“Koodo + 200 random features.”**

The stronger product identity is:

> **A local-first reading, annotation, study, and personal knowledge platform.**

The progression should be:

```text
BOOK READER
     ↓
ANNOTATION SYSTEM
     ↓
PERSONAL LIBRARY
     ↓
STUDY SYSTEM
     ↓
KNOWLEDGE SYSTEM
     ↓
LOCAL AI READING ASSISTANT
     ↓
PERSONAL RESEARCH ENVIRONMENT
```

That is the product architecture I would use as the **master capability map** for all future Luma phases.
