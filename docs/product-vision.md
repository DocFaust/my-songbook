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

### Offline First

The application must remain useful without an active network connection.

Users must be able to:

- access songs
- access setlists
- access their personal notes
- use the application during rehearsals and performances

Synchronization may be unavailable while offline, but local use must continue.

When connectivity returns, synchronization should resume safely.

Offline use is a core capability, not merely a fallback.

### Multi-Tenant / Multi-Band Support

A band represents an independent tenant within My Songbook.

Each band has its own:

- members
- songs
- setlists
- band-specific settings
- shared band data

Bands must be isolated from each other.

Two bands may have completely different members and must not share data
unless a future feature explicitly allows it.

A user may belong to:

- no band
- exactly one band
- multiple bands

User identity is global to the application, while membership and permissions
are scoped to individual bands.

The currently active band must always be clearly visible in the UI.

### User Management

Authentication must be secure but low-friction.

The login experience should avoid unnecessary complexity or repeated prompts.

User management must support collaboration between band members without making the application feel like an enterprise administration tool.

### Robust Synchronization

Band members may edit data from different devices and at different times.

Synchronization must therefore:

- tolerate temporary offline use
- avoid silent data loss
- handle concurrent changes predictably
- recover from interrupted synchronization
- clearly communicate unresolved conflicts when automatic resolution is unsafe

Synchronization behavior should be designed explicitly rather than emerging accidentally from API calls.

### Personal Song Notes

Users must be able to store personal information related to songs.

Personal notes belong to the user and must not automatically become visible to other band members.

Examples may include:

- playing hints
- chord reminders
- capo position
- arrangement notes
- performance cues

Band-wide metadata and personal metadata must remain conceptually separate.

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