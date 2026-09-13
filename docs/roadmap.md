# Product Roadmap

## Completed foundation

- [x] Authentication with Keycloak
- [x] Band tenant model and memberships
- [x] PostgreSQL / Flyway / JPA persistence
- [x] Songs backend API
- [x] Setlists backend API
- [x] React frontend cutover to backend APIs
- [x] Full-stack Docker Compose
- [x] Dedicated `/frontend` and `/backend` repository structure

## Step 9 — Invitations & Membership Management

- [x] 14-day invitation links
- [x] One-time invitation tokens
- [x] New members join as GUEST
- [x] Member list
- [x] Role management
- [x] Remove members
- [x] OWNER protection
- [x] Minimal membership administration UI

Out of scope for now:
- Ownership transfer
- Email invitations

## Step 10 — Personal Song Notes

- [ ] One personal note per Song/User
- [ ] Notes only visible to their owner
- [ ] Notes require active Band membership
- [ ] Song deletion removes associated notes
- [ ] Minimal frontend editor

## Step 11 — PWA / Performance Mode

Goal: reliable read-only use during rehearsals and live performances.

- [ ] PWA installation
- [ ] Service Worker
- [ ] Cache required application shell
- [ ] Cache Songs required for performance
- [ ] Cache Setlists required for performance
- [ ] Read-only offline operation
- [ ] Clear offline status

Explicitly no:
- Offline editing
- Conflict resolution
- Offline membership administration

## Step 12 — Remove Legacy IndexedDB Authority

- [ ] Audit remaining IndexedDB usage
- [ ] Remove obsolete local persistence
- [ ] Keep only storage required by the PWA/offline architecture
- [ ] Remove obsolete migration/fallback code

No legacy music-data migration is required.

## Step 13 — UI / UX

Larger frontend design pass after the main workflows are complete.

Areas:

- [ ] Navigation
- [ ] Band selection
- [ ] Song library
- [ ] Song editor
- [ ] Setlist editor
- [ ] Membership administration
- [ ] Mobile/tablet layouts
- [ ] Stage/performance usability
- [ ] Loading/error/empty states

The goal is not merely visual polish but efficient use during
rehearsals and live performances.

## Later / Backlog

- [ ] Ownership transfer
- [ ] Global account deletion
- [ ] Profile fields
- [ ] Improved invitation workflows
- [ ] Shared band equipment / additional band administration features