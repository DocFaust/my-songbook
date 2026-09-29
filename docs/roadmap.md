# Product Roadmap

This document follows the same step numbers as
`docs/implementation-roadmap.md`.

## Completed foundation

- [x] Authentication with Keycloak
- [x] Band tenant model and memberships
- [x] PostgreSQL / Flyway / JPA persistence
- [x] Songs backend API
- [x] Setlists backend API
- [x] React frontend cutover to backend APIs
- [x] Full-stack Docker Compose
- [x] Dedicated `/frontend` and `/backend` repository structure

## Step 9 — Invitations and membership administration

- [x] 14-day invitation links
- [x] One-time invitation tokens
- [x] New members join as GUEST
- [x] Member list
- [x] Role management for ADMIN, MEMBER, and GUEST
- [x] Remove members other than the OWNER
- [x] OWNER protection in the normal role and removal actions
- [x] Minimal membership administration UI

Out of scope:

- Email invitations

## Step 10 — Ownership transfer and voluntary leave

- [x] Atomic ownership transfer to an existing GUEST, MEMBER, or ADMIN
- [x] Former OWNER becomes ADMIN
- [x] Exactly one OWNER remains
- [x] ADMIN, MEMBER, and GUEST can leave a band
- [x] OWNER cannot leave before transferring ownership
- [x] Minimal UI on the existing band administration page

Personal song notes do not exist yet. When they do, ending a membership
must delete that user's notes for this band.

Out of scope:

- Account deletion
- Email invitations

## Step 11 — Personal Song Notes

- [ ] One personal note per Song/User
- [ ] Notes only visible to their owner
- [ ] Notes require active Band membership
- [ ] Song deletion removes associated notes
- [ ] Membership end removes that user's notes for the band
- [ ] Minimal frontend editor

## Step 12 — PWA / Performance Mode

Goal: reliable read-only use during rehearsals and live performances.

- [ ] PWA installation
- [ ] Service Worker
- [ ] Cache required application shell
- [ ] Cache Songs required for performance
- [ ] Cache Setlists required for performance
- [ ] Cache Personal Song Notes required for performance
- [ ] Read-only offline operation
- [ ] Clear offline status

Explicitly no:

- Offline editing
- Conflict resolution
- Offline membership administration

## Step 13 — Remove legacy IndexedDB authority

- [x] Audit remaining IndexedDB usage
- [x] Remove obsolete local persistence
- [x] Remove obsolete migration/fallback code

No legacy music-data migration is required. PostgreSQL/backend APIs are
authoritative for Songs and Setlists. Frontend IndexedDB is not an
authoritative data store. Offline behavior is not implemented yet; when
added in Step 12 it will be read-only cache behavior only. The removed
IndexedDB helper is not that cache.

## Later / Backlog

- [ ] Larger UI/UX pass for rehearsal and performance use
- [ ] Global account deletion
- [ ] Profile fields
- [ ] Improved invitation workflows
- [ ] Shared band equipment / additional band administration features

The UI/UX pass is not a numbered implementation step. It stays later work
and does not change the step order above.
