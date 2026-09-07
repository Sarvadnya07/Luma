# Document IPC & Lazy Access Strategy

## 1. IPC Performance Boundaries

Serializing full, multi-megabyte document syntax trees or gigabyte book texts across the Tauri IPC boundary incurs heavy serialization/deserialization costs, spikes memory allocations, and degrades UI responsiveness.

Luma enforces a strict **lazy, query-oriented IPC boundary**:

```text
Frontend UI / Consumers (React)
           │
           │  1. getDocumentStructure (Metadata & node tree outline)
           │  2. getDocumentNodeText (Specific node ID, e.g. "p12")
           │  3. getDocumentParagraph (Specific section & index)
           │  4. getDocumentRangeText (Range slice)
           │  5. readDocumentResource (Streamed/lazy binary)
           ▼
Tauri IPC Commands
           ▼
ReaderService (In-Memory Session Cache: Arc<CanonicalDocument>)
```

---

## 2. IPC Command Surface

| Command | Request Arguments | Return Type | Memory Characteristics |
|---|---|---|---|
| `get_document_structure` | `book_id` | `DocumentStructure` | Light outline (tree nodes, kinds, IDs, counts) |
| `get_document_node_text` | `book_id`, `node_id` | `String` | Exact node text slice |
| `get_document_range_text` | `book_id`, `range` | `String` | Exact range slice |
| `get_document_paragraph` | `book_id`, `section_or_page`, `paragraph_index` | `String` | Single paragraph |
| `get_document_headings` | `book_id` | `Vec<StructureNode>` | Semantic heading hierarchy |
| `get_document_resources` | `book_id` | `Vec<ResourceDescriptor>` | Resource list with mime types |
| `read_document_resource` | `book_id`, `href_or_id` | `Vec<u8>` | Raw byte stream for targeted asset |
| `get_document_citation` | `book_id`, `range` | `CitationContext` | Structured quote + APA/Chicago citation |
| `search_document_canonical` | `book_id`, `query` | `Vec<CanonicalSearchMatch>` | Snippets with ranges and confidences |

---

## 3. Session Caching & Memory Bounds

The `ReaderService` maintains bounded LRU/FIFO in-memory caching (`MAX_CACHED_SESSIONS = 5`). Document instances are shared behind `Arc<CanonicalDocument>`, allowing fast sub-millisecond query response for active books while guaranteeing bounded working set sizes on the desktop host.
