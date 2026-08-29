# ADR-0018: Contextual Annotation and Text Selection Workflow

## Status
Accepted

## Context
Readers need a quick, non-disruptive way to highlight text, attach notes, copy quotes, or bookmark sections without obstructing the reading flow.

## Decision
We implement a floating contextual toolbar (`TextSelectionToolbar`) that renders directly adjacent to the user's DOM text selection. Choosing a color pill immediately creates an anchored highlight, while clicking the note icon opens a lightweight popover for adding notes.

## Consequences
- Fast, single-click highlight creation.
- Seamless note creation attached to durable domain annotations.
