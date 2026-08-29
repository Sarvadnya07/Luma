# Luma — Testing Strategy

## 1. Multi-Tiered Verification Strategy

```text
               ┌────────────────────────┐
               │ End-to-End UI & Shell  │ (Playwright / Tauri Driver)
               ├────────────────────────┤
               │   Component & UI Unit  │ (Vitest + React Testing Library)
               ├────────────────────────┤
               │ Cross-Crate & Storage  │ (Rust In-Memory SQLite Integration)
               ├────────────────────────┤
               │ Core Engine & Anchor   │ (Fuzzy Reflow & Resilience Tests)
               └────────────────────────┘
```

---

## 2. Test Execution Commands

### 2.1 Rust Workspace Tests
```bash
# Run unit & integration tests across all workspace crates
cargo test --workspace

# Run anchor reflow survival benchmarks
cargo test -p luma-anchor -- --nocapture

# Run storage SQLite CRUD & scale benchmarks (100, 1k, 10k entities)
cargo test -p luma-storage -- --nocapture
```

### 2.2 Frontend & UI Tests
```bash
# Type check all packages and desktop app
pnpm typecheck

# Run frontend unit tests
pnpm test

# Linting & code style
pnpm lint
```

---

## 3. Anchor Engine Testing Matrix

Every anchor resolution candidate must pass the following test conditions:
1. **Exact Match**: Verify 100% confidence for unmodified text.
2. **Context Disambiguation**: Verify identical phrases in the same chapter resolve to different offsets when provided with distinct prefix/suffix contexts.
3. **Reflow & Layout Alteration**: Verify highlights survive arbitrary newlines, line breaks, tabs, and multi-space collapsing.
4. **Typographical Normalization**: Verify curly quotes, em-dashes, and non-breaking spaces match their ASCII equivalents.
5. **Deleted / Missing Text**: Verify low-confidence or missing content fails gracefully without incorrect attachment.
