# SongManager UI Roadmap

## Status

IN PROGRESS

This roadmap describes the migration from the current SongManager user
interface to the target experience defined in:

- `docs/ui-design.md`

The UI design document defines the target state and long-term design
principles.

This roadmap defines the implementation path.

The redesign is intentionally split into reviewable steps. Each step should
leave the application usable and should be visually reviewed before work on
the next step begins.

---

# 1. Migration Principles

The UI migration follows these rules:

- Do not rebuild the complete UI in one large change.
- Each UI step should result in a coherent and usable application state.
- Existing domain behavior must remain unchanged unless explicitly stated.
- Existing authentication, authorization, Band tenancy, persistence,
  Performance Mode, offline snapshot, Personal Note, and synchronization
  semantics must remain unchanged.
- Prefer moving and reorganizing existing functionality over reimplementing it.
- Do not introduce speculative backend or domain changes for visual purposes.
- Do not introduce fake functionality merely to complete a visual design.
- Desktop and tablet are first-class targets.
- Accessibility must be preserved or improved.
- Existing automated tests must be adapted where necessary.
- Full-stack E2E coverage must continue to protect the important user flows.
- After every UI step, perform a visual review before starting the next step.

The migration may temporarily contain transitional routing or UI structures.
Such transitional states must be explicitly documented and removed by the
step responsible for the final structure.

---

# 2. Migration Overview

| Step | Scope | Status |
|---|---|---|
| UI-1 | Design Foundation & App Shell | COMPLETED |
| UI-2 | Repertoire & Songs | IN PROGRESS |
| UI-3 | Song Workspace | PLANNED |
| UI-4 | Setlists & Rehearsal UX | PLANNED |

Target architecture:

`Current UI`
→ `UI-1 Foundation & App Shell`
→ `UI-2 Repertoire & Songs`
→ `UI-3 Song Workspace`
→ `UI-4 Setlists & Rehearsal UX`
→ `Vintage Songbook UI`

---

# 3. UI-1 — Design Foundation & App Shell

## Status

COMPLETED

Merged in pull request #153. The temporary header actions and the
`/` → `/editor` entry described in this section were the UI-1 migration
state. UI-2 replaces that entry with the Repertoire.

### Deliberate deviations

These choices stay inside the accepted Vintage Songbook direction.

- Headings use a system serif stack and UI text a system sans-serif stack.
  No webfont is downloaded, so the shell stays readable offline without a new
  dependency.
- The Online menu does not show a last-synchronization time. The snapshot
  stand is shown when Performance Mode is active, because that is the stand
  the application already tracks.
- `/` redirected to `/editor` after an OIDC callback on `/` had been consumed.
  Import and Setlists were not permanent navigation items. Until UI-2, the
  header exposed them through a transitional `+ Song` menu (`Neuer Song`,
  `Song importieren`) and a `Setlists` action. UI-2 replaces both.
- The installed app icon and `theme_color` use Dark Brown and the paper
  background instead of the previous blue, so the installed shell matches the
  header.
- Profile and Settings are not shown. They do not exist yet.

## Goal

Establish the visual identity and global application shell defined by
`docs/ui-design.md`.

After UI-1, SongManager should already clearly look and feel like the new
Vintage Songbook application even though the existing music workspaces have
not yet been fully redesigned.

UI-1 changes the application shell, not the music domain.

## Scope

### Central MUI Theme

Introduce a central MUI theme implementing the Vintage Songbook design
foundation.

Use the defined palette:

| Purpose | Color | Hex |
|---|---|---|
| Primary | Dark Brown | `#40372F` |
| Accent | Terracotta | `#A85D3A` |
| Background | Paper | `#F3EBDD` |
| Surface | Ivory | `#FFF9EE` |

Centralize:

- palette
- typography
- spacing conventions
- border radii
- elevation/shadows
- focus states
- relevant MUI component defaults

Feature components should consume semantic theme values instead of introducing
new hard-coded design colors.

### Global Header

Replace the current navigation-heavy header with the new global application
header.

Target structure:

`SongManager | Active Band | Status | User`

The header must no longer contain permanent navigation entries for:

- Home
- Editor
- Sets
- Import
- Band

The SongManager brand remains on the left.

Global context and account controls remain on the right.

### Band Menu

Replace the current combination of Band selector and separate
`Band anlegen` action with a coherent Band menu.

The menu should support:

- displaying the active Band
- switching Bands
- creating a Band
- navigating to Band management where permitted

Existing Band creation and Band switching behavior must be reused.

Do not reimplement Band domain logic.

Band creation must remain unavailable where existing Performance Mode rules
prohibit it.

### Online / Performance Status

Remove the naked Performance Mode switch from the header.

Replace it with a dedicated status control.

Normal state should communicate:

`Online`

The status menu should provide access to Performance Mode activation.

When Performance Mode is active, the status must clearly communicate:

- that Performance Mode is active
- the relevant snapshot timestamp
- access to leaving Performance Mode

Reuse the existing Performance Mode context and its existing `enable()` and
`disable()` behavior.

Do not change:

- activation semantics
- deactivation semantics
- snapshot behavior
- Personal Note synchronization
- conflict handling
- offline identity behavior

There must be no automatic switch into or out of Performance Mode.

### User Menu

Replace the current standalone authentication/account presentation with a
compact User menu.

When authenticated, display an Avatar or initials.

The menu should contain the currently available account information and:

- Logout

The component structure should allow future Profile and Settings functionality
without requiring another header redesign.

Do not create fake Profile or Settings pages in UI-1.

### Home Removal

The dedicated Home page is no longer part of the target information
architecture.

Remove it as the normal application destination.

Because the final Repertoire workspace is introduced in UI-2, UI-1 uses the
existing Song editor as a temporary migration destination.

Temporary routing after UI-1:

`/` → `/editor`

While an OIDC callback query (`code` or `state`, without `error`) is still on
`/`, the redirect waits. Otherwise the authorization response would be
removed before sign-in can finish. After sign-in, `/` continues to `/editor`.

This was explicitly a migration state.

It is not the target information architecture.

UI-2 replaces this transitional routing with the real Repertoire entry
point. See the UI-2 transitional decisions.

### Existing Routes

Existing routes such as:

- `/editor`
- `/setlist`
- `/import`
- `/band`

may remain directly accessible during UI-1.

They are no longer exposed as permanent global header navigation.

This allows UI-1 to change the application shell without prematurely
implementing the Repertoire workspace.

## Out of Scope

UI-1 does not redesign:

- Song list structure
- Song search
- Song editor/workspace
- ChordPro presentation
- Personal Notes presentation
- Setlist workspace
- Import workflow
- Band administration screens
- domain models
- backend APIs
- authentication architecture
- Performance Mode behavior

These belong to later steps.

## Completion Criteria

UI-1 is complete when:

- the Vintage Songbook MUI theme is applied globally
- the old blue/default MUI application identity is replaced
- the new global header is implemented
- old top-level navigation is removed
- Band switching/creation/management is accessible from the Band context
- Performance Mode is controlled through the new status UI
- the User menu provides account identity and logout
- Home is no longer the normal application destination
- `/` leads into the existing music workflow as the documented temporary state
- existing Band, authentication, and Performance Mode behavior still works
- automated frontend tests pass
- relevant full-stack E2E flows pass
- Sonar Quality Gate passes
- there are no unresolved Bugbot findings for the change
- the result has been visually reviewed before UI-2 begins

---

# 4. UI-2 — Repertoire & Songs

## Status

IN PROGRESS

UI-2 is implemented on `feature/ui-2-repertoire`. It is not completed:
completion still requires merge and visual acceptance. Do not start UI-3
before that review.

### Transitional routing and navigation

These choices keep the application usable while the Song and Setlist
workspaces themselves stay on their current screens. UI-3 and UI-4 replace
the remaining editor- and setlist-centered presentation.

- `/` redirects to `/repertoire` after an OIDC callback on `/` has been
  consumed. The UI-1 callback wait remains: a query with `code` or `state`
  and without `error` stays on `/` until sign-in finishes.
- `/repertoire` is the canonical Songs workspace and the primary destination
  after login. Accepting an invitation also lands here.
- The SongManager brand navigates to `/repertoire`.
- Local navigation is `Songs | Setlists`. Songs opens `/repertoire`.
  Setlists opens the existing `/setlist` page. Setlist editing, rehearsal,
  and Performance Mode setlist behavior are unchanged.
- `/editor` remains a deep link to the same Songs workspace, including the
  Repertoire navigation. It is no longer the canonical entry.
- `/import` remains the existing import workflow. `+ Song` →
  `Song importieren` opens it. The Repertoire navigation stays visible, and
  neither Songs nor Setlists is selected on that screen.
- `/band` and `/invite/:token` stay outside the Repertoire shell.
- The global header no longer contains `+ Song` or `Setlists`. `+ Song`
  lives in the Songs workspace. The former list button `New` is removed, so
  the normal Songs experience has one creation entry point.
- `Neuer Song` starts the existing unsaved draft. `Song importieren` opens
  `/import`. Both menu actions are unavailable while Performance Mode or the
  Band role blocks music writes. Direct addresses still open those pages,
  and the pages keep their existing write restrictions.
- Song search filters the already loaded list by title, name, artist, and
  author. It keeps the API order and does not add metadata or a new query.
- Switching the active Band remounts the Songs workspace. That clears the
  search text and the selected Song.

## Goal

Introduce Repertoire as the primary SongManager workspace and make Songs the
main entry point into the application.

UI-2 replaces the transitional routing introduced by UI-1.

## Scope

Introduce the Repertoire structure:

`Repertoire`

with local navigation:

`Songs | Setlists`

Songs are the default Repertoire view.

Redesign the Songs experience around:

- finding Songs
- searching Songs
- selecting Songs
- creating Songs
- importing Songs
- opening Songs

Introduce a clear primary Song action such as:

`+ Song`

The Song action should provide access to:

- creating a new Song
- importing ChordPro

Import is no longer treated as a separate top-level application concept.

Introduce appropriate Song empty states.

Reuse existing Song and Import behavior wherever possible.

## Routing

UI-2 removes the UI-1 transitional root routing.

The application root should now enter the Repertoire.

The exact route structure should be chosen as part of UI-2 while preserving
useful compatibility redirects where appropriate.

Legacy direct URLs should either:

- continue to resolve meaningfully, or
- redirect to their corresponding new Repertoire destination

Do not leave obsolete navigation structures behind.

## Out of Scope

UI-2 does not yet perform the complete Song Workspace redesign.

In particular, detailed redesign of:

- ChordPro reading
- Song editing
- Personal Notes presentation
- detailed Song metadata
- stage-oriented Song presentation

belongs to UI-3.

## Completion Criteria

UI-2 is complete when:

- Repertoire is the primary application workspace
- Songs and Setlists are represented as local Repertoire navigation
- Songs are the default entry point
- Song search and selection are easy to access
- Song creation is available from the Songs context
- ChordPro import is available from the Songs context
- Import no longer requires global navigation
- the UI-1 temporary `/ → /editor` migration state has been removed
- existing Song functionality remains intact
- automated frontend tests pass
- relevant full-stack E2E flows pass
- Sonar Quality Gate passes
- there are no unresolved Bugbot findings for the change
- the result has been visually reviewed before UI-3 begins

---

# 5. UI-3 — Song Workspace

## Status

PLANNED

## Goal

Transform the current editor-oriented Song experience into a musician-oriented
digital song sheet.

Opening a Song should primarily feel like opening music to play, not opening a
database record to edit.

## Scope

Redesign the Song Workspace around the hierarchy:

1. Song title
2. Artist
3. Song / ChordPro content
4. Personal Notes
5. secondary metadata and actions

Create a clear distinction between:

- reading/playing a Song
- editing a Song

The default Song experience should prioritize reading and playing.

Editing remains easily accessible but should not visually dominate the normal
Song view.

Improve:

- ChordPro presentation
- chord readability
- Song typography
- Personal Notes integration
- action placement
- metadata presentation
- desktop layout
- tablet landscape layout
- touch interaction

Do not invent new Song metadata merely for visual purposes.

If a desired UI element requires data that does not exist in the current
domain model, treat that as a separate product decision.

## Tablet Focus

Tablet use must be explicitly reviewed during UI-3.

The Song Workspace must work naturally in landscape orientation and should not
simply be a scaled-down desktop layout.

Song content must retain priority when available screen space decreases.

## Out of Scope

UI-3 does not change:

- Song domain semantics
- ChordPro persistence format
- Personal Note ownership rules
- optimistic locking
- Performance Mode synchronization semantics

## Completion Criteria

UI-3 is complete when:

- opening a Song presents a musician-oriented Song view
- Song title and artist have clear visual hierarchy
- ChordPro content is the visual focus
- reading and editing are clearly distinguished
- Personal Notes are naturally integrated
- desktop usage is coherent
- tablet landscape usage is coherent
- touch interaction is practical
- existing Song and Personal Note behavior remains intact
- Performance Mode behavior remains intact
- automated frontend tests pass
- relevant full-stack E2E flows pass
- Sonar Quality Gate passes
- there are no unresolved Bugbot findings for the change
- the result has been visually reviewed before UI-4 begins

---

# 6. UI-4 — Setlists & Rehearsal UX

## Status

PLANNED

## Goal

Bring Setlists into the Vintage Songbook design and optimize their use for
rehearsal and performance.

## Scope

Redesign:

- Setlist overview
- Setlist creation
- Setlist editing
- adding Songs
- Song ordering
- duplicate Song entries
- opening Songs from a Setlist
- navigation between Songs
- tablet interaction

Setlists remain part of Repertoire.

The UI should prioritize the practical musician workflow:

`Choose Setlist → Choose Song → Play → Next Song`

Administrative controls should remain available without dominating rehearsal
or performance use.

Performance Mode should visually integrate naturally with the Setlist and Song
experience.

## Domain Constraints

Preserve existing Setlist semantics.

In particular:

- Setlists belong to a Band.
- Songs in a Setlist belong to the same Band.
- Song order is significant.
- Duplicate Song entries remain allowed.
- Existing role permissions remain unchanged.
- Deleting a Song continues to follow existing Setlist behavior.

Do not change these rules as part of the UI redesign.

## Completion Criteria

UI-4 is complete when:

- Setlists use the Vintage Songbook design system
- Setlist management is clear and touch-friendly
- Song ordering is practical
- duplicate Song entries continue to work
- Songs can be opened naturally from a Setlist
- moving through a Setlist works well during rehearsal
- tablet use is practical
- Performance Mode remains fully functional
- existing Setlist domain behavior remains intact
- automated frontend tests pass
- relevant full-stack E2E flows pass
- Sonar Quality Gate passes
- there are no unresolved Bugbot findings for the change
- the complete UI migration has received a final visual review

---

# 7. After UI-4

After UI-4, the main Vintage Songbook migration is considered complete.

Further UI work should no longer be treated as part of this migration unless
it addresses an explicit gap discovered during final review.

Possible future work may include:

- Profile functionality
- User settings
- optional stage-optimized/dark presentation
- additional Song metadata
- additional filtering and organization
- further accessibility improvements
- additional mobile optimization

These are not requirements for completing UI-1 through UI-4.

---

# 8. Roadmap Maintenance

The roadmap is a living migration document.

When a step starts:

- change its status from `PLANNED` or `NEXT` to `IN PROGRESS`

When a step is completed and merged:

- change its status to `COMPLETED`
- update the next step to `NEXT`
- document important deviations from the planned migration
- remove temporary migration behavior when the responsible later step is
  completed

Do not mark a step complete solely because implementation exists on a feature
branch.

A step is complete only after:

- implementation is finished
- automated checks pass
- review findings are resolved
- the change is merged
- the resulting UI has been visually reviewed

---

# 9. Final Target

The migration is complete when SongManager follows the principles in
`docs/ui-design.md` throughout the primary music workflow.

The final application should no longer feel organized around technical pages
such as:

`Editor / Import / Band`

Instead, the user experience should be organized around the musician's mental
model:

`Band → Repertoire → Songs / Setlists → Play`