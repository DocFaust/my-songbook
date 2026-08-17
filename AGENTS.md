# AGENTS.md

## Purpose

This file defines how AI coding agents should work with the My Songbook repository.

The goal is to make changes incrementally, preserve existing functionality,
respect architectural decisions, and keep the codebase maintainable while the
application evolves over time.

---

## Project Overview

My Songbook is an application for managing songs in ChordPro format and
organizing them into setlists.

The current application is a React/Vite single-page application.

Current major capabilities include:

- Importing song text and converting it to ChordPro
- Editing songs
- Rendering and previewing ChordPro content
- Managing setlists
- Persisting songs and setlists locally

The application is expected to evolve beyond its current client-only
architecture. Future architecture must therefore not be inferred solely from
the current implementation.

---

## Read Project Context First

Before making significant changes, inspect the existing implementation and
read the documentation relevant to the task.

Available documentation includes:

- `README.md` — project overview, setup and basic usage
- `docs/current-architecture.md` — current architecture
- `docs/current-data-model.md` — current persisted IndexedDB data model
- `docs/product-vision.md` — intended product direction
- `docs/domain-model.md` — target domain concepts and business rules
- `docs/converter.md` — ChordPro conversion behavior
- `docs/ui.md` — UI structure and behavior

Additional architecture, conventions, migration and decision documents may be
added over time.

Do not load or modify unrelated documentation unless it is relevant to the
task.

---

## Sources of Truth

Use the following priority when determining current behavior:

1. Explicit instructions from the user
2. Accepted architectural decisions
3. Current source code
4. Project documentation
5. Assumptions

Never silently rely on assumptions when the repository can answer the question.

If documentation and implementation disagree:

- identify the discrepancy
- determine whether the documentation describes a future state
- do not silently change behavior to make them match
- ask for clarification when the intended state cannot be determined

---

## Architecture States

Project documentation may describe different states of the application.

Use these meanings consistently:

### CURRENT

Implemented and currently in use.

### TARGET

Part of the intended future architecture but not necessarily implemented.

### PLANNED

An approved future change intended for implementation as part of an identified
migration step.

### IDEA

A possible future direction that has not yet been decided.

### DEPRECATED

Existing functionality or architecture that should eventually disappear but
may still be required by the current application.

Do not implement TARGET, IDEA or DEPRECATED replacement work merely because it
is documented.

Implement planned architectural changes only when explicitly requested or when
the current task clearly belongs to the corresponding migration step.

---

## Incremental Development

My Songbook should evolve incrementally.

Avoid big-bang migrations.

Prefer changes that keep the application usable after every meaningful step.

For architectural changes, prefer the following approach:

1. Understand the existing implementation.
2. Identify the smallest useful change.
3. Introduce abstractions where they provide a concrete migration benefit.
4. Migrate functionality incrementally.
5. Verify existing behavior.
6. Remove obsolete implementations only when they are no longer required.

Do not implement future architecture prematurely.

At the same time, avoid new design decisions that unnecessarily make planned
evolution harder.

---

## Current Architecture Constraints

At the current stage:

- The frontend is based on React and Vite.
- Material UI is used for UI components.
- Routing uses `react-router-dom`.
- ChordPro parsing/rendering uses `chordsheetjs`.
- Persistence currently uses IndexedDB through `idb`.
- IndexedDB access is encapsulated in the persistence layer.
- ChordPro conversion logic is separate from UI logic.
- Tests use Vitest and Testing Library.

These describe the current implementation, not permanent architectural
limitations.

Do not introduce a backend or replace persistence as a side effect of an
unrelated task.

---

## Existing Code First

Before implementing functionality:

- search for existing components, functions and utilities
- inspect related tests
- inspect related documentation
- understand the existing data flow

Prefer extending existing patterns when they remain appropriate.

Do not create duplicate implementations because finding the existing one would
take additional effort.

However, do not preserve a poor existing pattern merely for consistency when
the task explicitly involves improving that architecture.

---

## Scope Control

Keep changes focused on the requested task.

Do not:

- refactor unrelated code
- redesign unrelated UI
- rename unrelated concepts
- change persistence behavior without need
- introduce speculative abstractions
- implement documented future features without instruction
- perform broad cleanup as a side effect

If a larger refactoring would materially improve the requested change, explain
it before expanding the scope.

---

## Dependencies

Prefer the existing technology stack.

Before adding a new dependency:

1. Check whether the required functionality already exists in the project.
2. Check whether the existing stack provides an appropriate solution.
3. Consider whether a small local implementation is sufficient.
4. Add a dependency only when it provides a clear benefit.

Do not replace established libraries or frameworks without an explicit
architectural reason.

---

## Data and Persistence

Treat persisted user data as important.

Changes to IndexedDB schemas, identifiers or persisted structures require
special care.

Before changing persistent data:

- inspect `docs/current-data-model.md`
- inspect the current database implementation
- consider existing user data
- determine whether a migration is required

Never assume existing browser data can simply be discarded.

Setlists reference songs by ID. Changes to song identity or persistence must
consider those references.

---

## ChordPro

ChordPro content is a core domain concept of the application.

Before modifying import, conversion, parsing or rendering behavior, inspect:

- `docs/converter.md`
- the converter implementation
- existing converter tests
- rendering components where relevant

Do not mix ChordPro conversion rules into React UI components.

Conversion behavior should be deterministic and independently testable.

---

## UI Changes

Before creating new UI components:

- inspect existing Material UI patterns
- look for reusable project components
- preserve established interaction patterns where appropriate

Separate domain/data logic from presentation logic where practical.

UI components should not directly implement persistence details when those can
be handled by the appropriate application or persistence layer.

Avoid large visual redesigns unless explicitly requested.

---

## Testing and Verification

Changes should be verified at the appropriate level.

Relevant project commands include:

```bash
npm run test:ci
npm run lint
npm run build
```

## User Documentation

User documentation is located under `docs/user/`.

When implementing or changing user-visible behavior, determine whether
the user documentation is affected.

Update the relevant user documentation when:

- a user-facing feature is added
- an existing workflow changes
- UI behavior changes significantly
- configuration required from the user changes
- limitations relevant to users change

Do not expose internal implementation details in user documentation.

Write user documentation from the user's perspective and use
musician-oriented terminology rather than technical terminology.