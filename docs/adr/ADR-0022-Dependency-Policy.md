# ADR-0022: Dependency Selection & Permissive Licensing Policy

## Status
Accepted

## Context
Third-party dependency bloat compromises security, introduces license conflicts, and breaks WASM portability.

## Decision
All dependencies must carry permissive licenses (MIT, Apache-2.0, BSD). Crates in the portable core (`luma-core`, `luma-anchor`) are strictly forbidden from taking dependencies with OS or native syscall requirements.

## Consequences
- Clean license posture for open-source and commercial distribution.
- Predictable, lightweight bundles.
