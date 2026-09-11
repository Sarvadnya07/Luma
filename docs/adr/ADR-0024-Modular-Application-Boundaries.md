# ADR-0024: Modular Application Boundaries

## Context

Luma is a single Tauri desktop application with a Rust modular monolith. The
storage crate owns repositories and application services, while Tauri commands
form the IPC edge. ARCH-01 identified direct repository construction from
commands and wildcard exports from `luma-storage` as sources of accidental
coupling.

The application does not currently require independent deployment, separate
scaling, or service-level fault isolation. Extracting storage or taxonomy into
separate processes would add network, consistency, deployment, and operational
cost without a demonstrated requirement.

## Problem

Commands that construct repositories from `LumaAppContext.db` bypass the
application-service boundary. Wildcard exports make storage internals appear to
be public API. These patterns increase change blast radius and allow business
operations to become inconsistent across commands.

## Decision

Keep Luma as a modular monolith and enforce the following boundary:

- Tauri commands validate IPC input and delegate application operations.
- Application services own orchestration and translate storage failures into
  domain errors.
- Repositories remain storage implementation details.
- `luma-storage` exports an explicit allowlist rather than wildcard exports.
- An architecture test prevents command-level repository construction in the
  migrated collection boundary and prevents future wildcard re-exports.

The collection/taxonomy commands are the first migrated boundary through
`CollectionService`. Book cover fallback, knowledge, and reading-session
commands still contain direct repository access and are tracked for
incremental migration when their characterization coverage and service seams
are ready.

## Alternatives Considered

### Extract a separate service

Rejected. Luma has one desktop deployment, local SQLite ownership, and no
independent scaling or deployment requirement. Extraction would introduce
network and consistency complexity without current benefit.

### Introduce repository interfaces everywhere

Rejected. The current repository implementations are local, stable, and
already testable. Interfaces would add indirection without protecting a real
variant.

### Leave commands coupled to repositories

Rejected. This preserves short-term convenience but makes storage changes and
business invariants leak into the IPC layer.

## Consequences

### Benefits

- Clearer ownership of storage orchestration.
- Smaller accidental public API.
- Better change locality for collection and taxonomy behavior.
- Automated regression protection for the migrated boundary.
- No new deployment or runtime infrastructure.

### Costs

- New command families require explicit service methods.
- Some existing commands still need incremental migration.
- The first fitness function intentionally covers the migrated collection
  boundary rather than pretending the entire command tree has already moved.
- The explicit export list must be updated when intentionally adding public
  storage API.

### Risks

- Overly strict boundary tests could block legitimate composition-root code.
  The current rule is intentionally limited to the migrated collection command
  module.
- Incremental migration may temporarily leave multiple styles in the codebase.
  The architecture test prevents new direct repository construction while old
  paths are migrated.

## Status

Accepted and implemented incrementally.
