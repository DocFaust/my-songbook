# Product Vision

## Status

TARGET PRODUCT DIRECTION

This document describes the intended product capabilities and product principles.
It does not prescribe specific technologies.

## Target Users

My Songbook is designed primarily for musicians and bands.

The application should prioritize:

- fast access to songs
- minimal interaction during rehearsals and live performances
- clear, musician-oriented terminology
- reliable behavior under poor or unavailable network conditions
- simple collaboration within bands

## Core Product Principles

### Offline Availability

Offline capability exists primarily to keep My Songbook usable during
rehearsals and live performances when network connectivity is unavailable.

Offline mode is a read/use mode, not an editing mode. It protects rehearsal
and live-performance continuity. It does not provide a full offline editing
workflow.

When the required data has previously been made available locally, an
authenticated user must be able to:

- view locally available songs
- view and use locally available setlists
- navigate between songs in a setlist
- view their locally available personal notes
- use the application during rehearsal and live performance

These operations must not require a network connection.

Writing and administrative operations require an online connection.
The application does not queue or store offline edits for later replay.

After a user has previously authenticated and the required local data is
available, loss of network connectivity must not prevent this offline
performance use.

### Multi-Tenant / Multi-Band Support

A band represents an independent tenant within My Songbook.

Each band has its own:

- members
- songs
- setlists
- shared band data

Bands must be isolated from each other.

Two bands may have completely different members and must not share data.
A user who belongs to multiple bands still sees each band's song
collection as independent.

A user may belong to:

- no band
- exactly one band
- multiple bands

A My Songbook User identity is global to the application and is not
band-specific. The same User identity is used across all bands and
memberships of that User. A User does not need a separate account or
identity for each band. Roles remain scoped to memberships, not to the
global User. There are no separate band-specific user identities.

The currently active band is a usage context and must always be clearly
visible in the UI.

### Collaboration Within a Band, Not Distribution Between Bands

My Songbook facilitates collaboration within a band, not distribution of
song content between bands.

Songs belong to exactly one band. The application must not provide a
normal product feature for:

- copying a song directly from one band to another
- sharing a song with another band
- searching or browsing songs belonging to unrelated bands
- maintaining a global song repository
- maintaining a personal cross-band song repository
- automatically synchronizing songs between bands
- batch transferring songs between bands

Copying a setlist between bands would require the same cross-band song
distribution and is therefore also not a supported convenience feature.

This product boundary is not DRM or technical copy prevention. Users may
still be technically capable of:

- copying ChordPro text manually
- exporting content they can access
- importing or recreating content in another band

My Songbook does not need to prevent such manual actions. It must not
deliberately degrade normal editing, export or import UX merely to make
manual copying difficult.

The application simply must not provide a dedicated convenient
cross-band distribution workflow.

### User Management

Authentication must be secure and low-friction.

On a personal device, a user should normally remain signed in and should
not have to authenticate again for every use of the application.

After a user has previously authenticated and the required local data is
available, loss of network connectivity must not prevent offline performance
use of already available local band songs, setlists, and personal notes.

The product requires a reliable global User identity. It does not prescribe
a specific authentication mechanism such as username/password, email/password,
passkeys, magic links, or a particular identity provider. The concrete
authentication technology and security architecture are later architecture
decisions.

User management must support collaboration between band members without making the application feel like an enterprise administration tool.

### Synchronization

Band members may edit shared band data while online, including from
different devices and at different times.

Because domain data is not modified while offline, the application does
not need to merge competing offline changes when connectivity returns.
There is no offline mutation queue.

When connectivity returns, the application may refresh or synchronize
local data from the authoritative online state.

Protection against concurrent online updates is a later technical
architecture concern.

### Personal Song Notes

Users must be able to store personal information related to songs.

Personal notes belong to the user and must not automatically become visible to other band members.

Examples may include:

- playing hints
- chord reminders
- capo position
- arrangement notes
- performance cues

Shared song content and personal notes must remain conceptually separate.

### Stage Usability

The application must be practical during live performance.

Stage use should favor:

- high readability
- large touch targets
- minimal required interaction
- predictable navigation
- fast switching between songs
- resistance to accidental actions
- useful behavior with unreliable connectivity

Features intended for editing and administration should not interfere with performance workflows.

## Product Design Principle

When choosing between a generic productivity-style solution and a musician-specific workflow, prefer the musician-specific workflow when it materially improves practical use.

The application is not intended to be a generic document manager with song support.

It is a tool for musicians.