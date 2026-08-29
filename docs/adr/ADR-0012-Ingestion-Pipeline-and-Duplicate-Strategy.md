# ADR-0012: Ingestion Pipeline and Multi-Level Duplicate Strategy

## Status
Accepted

## Context
Importing files into a digital library involves untrusted files from diverse sources. The system must never crash on corrupted documents, never silently overwrite user files, and provide clear duplicate detection signals.

## Decision
We implement:
1. **Layered Format Detection**: Magic signatures $\rightarrow$ Container inspection $\rightarrow$ Extension fallback.
2. **4-Level Duplicate Detection**:
   - Level 1: Exact physical SHA-256 hash match (`EXACT_DUPLICATE`).
   - Level 2: Publication ISBN/ID match (`LIKELY_DUPLICATE`).
   - Level 3: Normalized metadata match (`POSSIBLE_DUPLICATE`).
   - Level 4: Unrelated publication (`UNRELATED`).

## Consequences
- Prevents redundant duplicate files while allowing multi-format attachment when appropriate.
- Protects user library integrity.
