# SongManager UI Design

## Status

ACCEPTED

This document defines the visual language, information architecture, and
interaction principles for the SongManager user interface.

It complements the product, domain, and architecture documentation. It does
not redefine domain behavior, authorization, persistence, authentication, or
offline synchronization rules.

The chosen visual direction is:

**Vintage Songbook**

SongManager should feel like a modern digital songbook made for musicians,
not like a generic administration application.

---

# 1. Design Goals

SongManager is primarily a tool for working with songs.

The UI should therefore feel:

- musical
- warm
- calm
- high-quality
- focused on content
- suitable for rehearsal and stage use
- modern despite its vintage-inspired visual identity

The Song is the visual and functional center of the application.

Administrative functions such as Band management, account actions, technical
status, and configuration should remain available but visually secondary.

The UI should not look like generic business software.

---

# 2. Design Direction — Vintage Songbook

The visual direction combines the atmosphere of a traditional songbook with
modern application design.

"Vintage" describes the visual character, not the interaction model.

Use:

- warm paper-like colors
- dark brown instead of corporate blue
- terracotta accents
- generous spacing
- clear typography
- subtle depth and separation
- restrained musical references

Avoid:

- fake aged-paper effects
- heavy paper textures
- wood textures
- ornamental borders
- decorative script fonts
- excessive music-note or instrument icons
- skeuomorphic controls
- visual effects that reduce readability

The application must still feel like a modern web application.

---

# 3. Color Palette

The primary SongManager palette is:

| Purpose | Color | Hex |
|---|---|---|
| Primary | Dark Brown | `#40372F` |
| Accent | Terracotta | `#A85D3A` |
| Background | Paper | `#F3EBDD` |
| Surface | Ivory | `#FFF9EE` |

## 3.1 Primary

`#40372F`

Used for:

- application header
- strong typography
- important icons
- high-emphasis UI elements

It replaces the previous corporate blue as the primary application color.

## 3.2 Accent

`#A85D3A`

Used selectively for:

- active navigation
- primary actions
- selected items
- chord highlighting where appropriate
- focus indicators
- important musical interaction states

The accent color should not dominate large areas of the UI.

## 3.3 Background

`#F3EBDD`

Used as the main application background.

The background should create a warm paper-like impression without using a
literal paper texture.

## 3.4 Surface

`#FFF9EE`

Used for:

- cards
- song surfaces
- dialogs
- menus
- input areas
- elevated content regions

## 3.5 Text

Avoid pure black where possible.

Primary text should use a very dark warm brown or neutral tone that provides
sufficient contrast against the paper and ivory surfaces.

Secondary text should remain clearly readable and must not become excessively
light.

## 3.6 Semantic colors

Success, warning, error, offline, and other semantic states retain their own
meaningful colors.

Semantic meaning must never depend on color alone.

Accessibility and contrast take precedence over strict palette adherence.

---

# 4. Typography

Typography should reinforce the Songbook character without compromising
usability.

## 4.1 Display typography

Prominent headings and Song titles may use a readable serif typeface.

Typical uses:

- `Repertoire`
- Song titles
- important page headings

The serif typeface should feel editorial or musical rather than decorative.

## 4.2 UI typography

Navigation, buttons, forms, menus, metadata, dialogs, and general application
text should use a highly readable sans-serif typeface.

## 4.3 Song content

Song lyrics and chords prioritize readability above visual branding.

ChordPro rendering must remain easy to read:

- on desktop
- on tablets
- at rehearsal
- on stage

Typography must not reduce the usefulness of existing ChordPro content.

---

# 5. Information Architecture

The previous top-level navigation:

- Home
- Editor
- Sets
- Import
- Band

is replaced.

The primary application concept is:

**Repertoire**

The Repertoire contains:

- Songs
- Setlists

Import is an action within the Repertoire and not a top-level application
area.

Band management belongs to the Band context.

Account actions belong to the User context.

There is no dedicated Home dashboard.

---

# 6. Application Start

After successful authentication, the User should enter the Repertoire of the
appropriate Band directly.

Normally this is the last active Band if it is still accessible.

If the User has no Band, show an appropriate empty state that allows the User
to create or join a Band.

Invitation flows continue to follow their existing authentication and routing
rules.

Do not introduce a Home page merely as an intermediate navigation step.

---

# 7. Global Header

The global header should be visually calm.

It contains only global application context.

## 7.1 Structure

Desktop order:

`SongManager                         Active Band   Status   User`

Example:

`♫ SongManager                       Alpspitzbuam ▾   ● Online   WF ▾`

The exact iconography may evolve, but the information hierarchy should remain.

## 7.2 SongManager brand

The left side contains the SongManager brand.

It may consist of:

- a restrained musical symbol or logo
- the name `SongManager`

The brand is not a replacement for a Home page.

Do not add a Home destination solely because the brand is clickable.

## 7.3 Header exclusions

Do not place these as permanent top-level header actions:

- Home
- Editor
- Songs
- Sets
- Setlists
- Import
- Band
- Create Band
- Logout

These actions belong to their respective application contexts.

---

# 8. Band Context

The active Band is always visible in the header.

Example:

`Alpspitzbuam ▾`

Selecting it opens the Band menu.

Example structure:

    Band wechseln

    ✓ Alpspitzbuam
      Wirtshausband
      Schola St. Martin

    ─────────────────

    + Band erstellen
      Band verwalten

The menu should:

- clearly mark the active Band
- allow switching between accessible Bands
- provide access to Band creation
- provide access to Band administration where permitted

Band administration must not dominate the primary music workflow.

---

# 9. Online and Performance Mode

Connectivity and Performance Mode are represented by a dedicated status area
in the header.

## 9.1 Normal state

The normal state should be visually restrained.

Example:

`● Online`

Opening the status area may show additional information such as:

    Online
    Letzte Synchronisation: heute 19:42

    Performance Mode aktivieren

## 9.2 Performance Mode

Performance Mode must be clearly distinguishable from normal online use.

It should show:

- that Performance Mode is active
- the relevant snapshot timestamp
- an explicit way to leave Performance Mode

Example:

    Performance Mode
    Stand heute 19:42

The UI redesign must not change the existing Performance Mode semantics.

In particular:

- activation remains deliberate
- deactivation remains deliberate
- there is no automatic mode switching
- shared Band data remains read-only in Performance Mode
- Personal Note synchronization and conflict handling retain their existing
  behavior

The visual redesign must not introduce a second offline architecture.

---

# 10. User Menu

The rightmost header element represents the authenticated User.

Prefer an Avatar.

If no profile image exists, use initials.

Example:

`WF ▾`

The menu may eventually show:

    Werner Faust

    Profil
    Einstellungen

    ────────────

    Abmelden

Profile and Settings are forward-looking concepts.

Until these functions actually exist, they must either:

- not be shown, or
- be clearly presented as unavailable

Do not create placeholder pages without product functionality solely to make
the menu appear complete.

The UI architecture should nevertheless allow a real Avatar/Profile feature
to be added later without redesigning the header.

---

# 11. Repertoire

The main content area begins directly below the global header.

The Repertoire is the primary workspace of SongManager.

Example:

    Repertoire

    Songs    Setlists

Songs and Setlists are local navigation within the Repertoire rather than
global application destinations.

The currently selected section must be visually obvious.

---

# 12. Songs View

Songs are the primary focus of SongManager.

The Songs view should prioritize:

1. finding a Song
2. opening a Song
3. reading/playing a Song
4. editing a Song
5. creating/importing a Song

Administrative metadata is secondary.

## 12.1 Song actions

Provide a clear primary Song action.

Example:

`+ Song ▾`

Possible actions:

    Neuen Song erstellen
    ChordPro importieren

Import must not require its own permanent top-level navigation item.

If additional import mechanisms are introduced later, they belong naturally
to this action group.

## 12.2 Search

Song search should be prominent and immediately available.

The User should not need to open a separate search page.

## 12.3 Song list

A Song list should make the most relevant information quickly scannable.

Typical information may include:

- title
- artist
- musical metadata where useful
- favorite state
- additional actions

Avoid displaying metadata merely because it exists in the database.

The UI should answer:

**Which Song do I want to play?**

before:

**What database fields does this Song have?**

---

# 13. Song Workspace

Opening a Song should feel like opening a song sheet rather than opening a
database record.

The strongest hierarchy is:

    Song title
    Artist

The Song content follows.

Possible local areas include:

- chords/song sheet
- text
- Personal Notes
- Setlist relationships

The exact organization may evolve during the Song Workspace redesign.

## 13.1 Song content

ChordPro content is the central musical content.

It should receive substantially more visual emphasis than technical metadata.

Chords may use the Terracotta accent where this improves readability.

## 13.2 Metadata

Metadata should be available without visually competing with the Song.

Examples:

- key
- tempo
- time signature
- tags
- modification information

Metadata may use a secondary panel, compact card, or similar treatment.

## 13.3 Editing

Reading and editing are distinct activities.

The default Song view should optimize reading and playing.

Editing controls should be clearly accessible without making the entire Song
view look permanently like a form.

---

# 14. Setlists

Setlists are part of the Repertoire.

They are important, but Songs remain the primary content concept.

Setlist UI should optimize:

- creating a Setlist
- finding Songs
- adding Songs
- ordering Songs
- allowing duplicate Song entries
- opening Songs while rehearsing or performing

The existing domain semantics remain unchanged.

A later UI iteration may give rehearsal/performance use a more specialized
presentation.

---

# 15. Visual Surfaces

Prefer clearly structured surfaces over hard layout dividers.

Use:

- subtle cards
- spacing
- typography
- restrained elevation
- warm surface colors

Avoid relying primarily on:

- vertical separator lines
- large empty white regions
- dense admin-style tables
- strong borders around every region

Cards should not become decorative boxes around every element.

Use them only where they improve visual grouping.

---

# 16. Icons

Icons should support recognition, not decorate the interface.

Prefer a consistent icon family.

Musical icons may be used for important musical concepts such as Songs, but
avoid placing music symbols everywhere merely to reinforce the theme.

The interface should remain elegant rather than playful.

Important actions must not rely on an unexplained icon alone.

---

# 17. Spacing and Touch Interaction

Desktop and tablet are first-class target environments.

Interactive elements should provide comfortable touch targets.

This is particularly important for:

- Band selection
- Song selection
- Setlists
- Performance Mode
- Song navigation
- Personal Notes
- menus
- dialogs

Important functionality must never require hover.

Hover states may enhance desktop use but cannot be the only way to discover or
understand an action.

---

# 18. Tablet Use

Tablet use is a primary SongManager scenario, especially for rehearsal and
performance.

Layouts should therefore work naturally in landscape tablet orientation.

The UI should avoid simply shrinking a desktop layout.

When space becomes limited:

- secondary metadata may collapse
- actions may move into menus
- panels may become sequential views
- Song content retains priority

Song readability and navigation must remain primary.

---

# 19. Performance Use

Performance use has different priorities from administration.

During rehearsal or performance:

- Song content should dominate
- navigation must be predictable
- controls should be touch-friendly
- accidental destructive actions should be difficult
- unnecessary administration should disappear into the background
- connectivity changes must not unexpectedly change the UI mode

The normal application and Performance Mode should clearly belong to the same
design system.

A future dark or stage-optimized variant may invert the Vintage Songbook
palette while retaining its identity.

---

# 20. Empty States

Empty states should explain the next useful action.

Avoid purely technical messages such as:

`Keine Daten vorhanden.`

Prefer context-aware messages such as:

    Noch keine Songs im Repertoire.

    Erstelle deinen ersten Song oder importiere einen bestehenden ChordPro-Song.

Empty states should remain concise and should not become tutorial pages.

---

# 21. Responsive Design

The information architecture remains consistent across screen sizes.

Responsive layouts may change presentation but not domain meaning.

Desktop may use:

- side-by-side Song list and Song workspace
- larger metadata panels

Tablet may use:

- collapsible panels
- master/detail navigation
- reduced secondary information

Small screens may use:

- menus for secondary actions
- sequential navigation
- compact headers

Do not duplicate separate application architectures for different screen
sizes.

---

# 22. Accessibility

Accessibility is part of the design system.

Requirements include:

- sufficient color contrast
- keyboard accessibility where applicable
- visible focus states
- meaningful labels
- touch-friendly targets
- status not communicated through color alone
- disabled actions with understandable reasons
- dialogs with accessible labels
- no essential hover-only information

The Vintage Songbook palette must not compromise these requirements.

---

# 23. Design Tokens and MUI

The React application continues to use MUI.

The redesign should use a central MUI Theme.

Define shared design tokens centrally for:

- colors
- typography
- spacing
- border radii
- shadows/elevation
- component defaults
- interaction states

Avoid scattered hard-coded color values across components.

Prefer semantic theme values such as:

- `primary`
- `secondary`
- `background.default`
- `background.paper`
- `text.primary`
- `text.secondary`
- `success`
- `warning`
- `error`

over direct hexadecimal values inside feature components.

Feature components should consume the design system rather than define their
own visual language.

---

# 24. Scope Boundary

The UI redesign is primarily a presentation and interaction change.

It must not casually change:

- domain rules
- authorization
- Band tenancy
- API contracts
- PostgreSQL authority
- Keycloak authentication
- optimistic locking
- snapshot semantics
- Performance Mode semantics
- Personal Note conflict handling
- offline synchronization rules

If a desired UI improvement requires a domain or API change, treat that as an
explicit product/architecture decision rather than hiding it inside the UI
refactoring.

---

# 25. Implementation Strategy

Do not rebuild the complete UI in one large change.

Prefer reviewable vertical UI slices.

## UI-1 — Design Foundation and App Shell

Introduce:

- central Vintage Songbook MUI theme
- typography
- palette
- shared visual tokens
- redesigned global header
- Band selector
- Online/Performance status
- User/Avatar menu
- removal of the old top-level navigation
- removal of Home as a required destination
- direct entry into Repertoire

No domain behavior changes.

## UI-2 — Repertoire and Songs

Redesign:

- Repertoire shell
- Songs/Setlists local navigation
- Song search
- Song list
- Song selection
- `+ Song`
- ChordPro import action
- empty states

## UI-3 — Song Workspace

Redesign:

- Song presentation
- title/artist hierarchy
- ChordPro display
- metadata presentation
- editing
- Personal Notes
- tablet behavior

## UI-4 — Setlists

Redesign:

- Setlist overview
- Setlist editing
- Song ordering
- Song selection
- rehearsal-oriented navigation
- tablet interaction

Each slice should leave the application usable and should be reviewed visually
before proceeding to the next slice.

---

# 26. Design Principle

When choosing between an administration-oriented solution and a
musician-oriented solution, prefer the musician-oriented solution unless it
would make the application less understandable or less accessible.

SongManager should answer:

**What do I want to play?**

before it answers:

**What do I want to administer?**