# ADR-0009: Annotation Architecture
- **Status**: Approved
- **Date**: 2026-08-29
- **Context**: Annotations must never break or silently attach to wrong text across font/layout reflows or document revisions.
- **Decision**: Multi-signal composite anchor architecture bundling exact quote, NFKD normalized text, prefix/suffix surrounding context (40 chars), and format locators with a fuzzy Levenshtein + token scoring algorithm. Ambiguous matches are surfaced for review rather than misattached.
- **Alternatives Considered**: Pure CFI locators (brittle to markup edits), pure character offsets (broken by any reflow).
- **Consequences**: 100% resilient highlights across reflow, robust disambiguation of duplicate phrases.
