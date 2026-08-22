# Target Architecture

## Status

TARGET ARCHITECTURE

This document describes the **intended technical target architecture** of My
Songbook.

It is based on accepted product, domain, and architecture decisions. It does
not describe the currently implemented client-only application.

This document distinguishes three kinds of statements:

- **Accepted target architecture decisions** — decided and binding for later
  implementation
- **Deliberately deferred architecture decisions** — intentionally left open
  until they become necessary for the next implementation step
- **Implementation details that are not decided yet** — concrete mechanisms,
  libraries, schemas, protocols, or operational choices that must not be
  inferred from this document

Do not treat deferred items as missing flaws. They remain open until a later
implementation step requires them.

This document does **not**:

- describe the current IndexedDB application as if it were the target
- prescribe a physical PostgreSQL schema
- prescribe API endpoints or payload formats
- prescribe Identity Provider configuration
- provide a migration plan
- introduce microservices, event-driven architecture, or speculative
  infrastructure

Current implementation is documented in `docs/current-architecture.md` and
`docs/current-data-model.md`. Target product capabilities are documented in
`docs/product-vision.md`. Target domain concepts and invariants are documented
in `docs/domain-model.md`.

---

## Architecture principles

1. **Server is the source of truth.** PostgreSQL through the Spring Boot API
   is the authoritative state. Local browser data is a disposable read-only
   representation of that state.
2. **Backend enforces authorization.** The frontend is presentation and
   interaction. It is never a security boundary.
3. **Band is the tenant boundary.** Band-owned data is isolated by domain
   relationships and backend authorization, not by separate databases or
   schemas per Band.
4. **Authentication and domain authorization are separate concerns.** A
   separate Identity Provider establishes the global User identity. The Spring
   Boot application owns Memberships, roles, and all domain authorization.
5. **Offline is for performance continuity, not editing.** Offline mode is
   read/use only. There are no offline mutations.
6. **Prefer one application over distributed services.** There is one Spring
   Boot domain application and one PostgreSQL database.
7. **Prefer explicit domain rules over configurable frameworks.** Domain
   invariants are enforced in the application, not hidden behind generic
   multi-tenant or workflow machinery.
8. **No speculative infrastructure.** Do not introduce components, layers, or
   operational platforms unless a concrete product requirement needs them.
9. **No silent data loss from concurrent writes.** Online concurrent updates
   use optimistic locking. Stale writes are rejected. There is no silent
   last-write-wins overwrite.
10. **Add complexity only when a concrete product requirement needs it.**

These principles apply the Simplicity Principle from `AGENTS.md` to the target
architecture.

---

## Overall architecture

The accepted target architecture is a **modular monolithic web application**:

```text
React PWA
    |
    | HTTPS / application API
    v
Spring Boot Domain API
    |
    +---- separate Identity Provider
    |
    v
PostgreSQL
```

There is:

- one React Progressive Web App as the user interface, deployed independently
  from Spring Boot
- one Spring Boot domain application
- one PostgreSQL database as the system of record
- one separate Identity Provider for authentication

This is **not**:

- a microservice architecture
- an event-driven architecture
- a Backend-as-a-Service
- a native mobile application architecture
- a server-rendered application architecture

The following are explicitly out of scope for the target architecture:

- independently deployed domain services
- message brokers
- CQRS
- event sourcing
- distributed domain services
- a separate database or schema per Band
- server-side rendering as an architectural requirement
- native mobile applications

Internal modularization of the Spring Boot application is allowed and expected
where it improves clarity. A speculative module framework is not part of this
architecture.

---

## Frontend

The existing React/Vite frontend remains the basis of the user interface.

The target frontend is a Progressive Web App suitable for:

- desktop
- tablet
- smartphone
- rehearsal
- live performance

The frontend communicates with the Spring Boot API for authoritative online
data and mutations.

The frontend is **not** a security boundary. Authorization is always enforced
by the backend. Hidden UI controls, client-side filtering, and local cache
separation must not be treated as access control.

Accepted frontend decisions:

- keep React/Vite as the UI basis
- evolve the UI into a PWA
- talk to the Spring Boot API over HTTPS
- use local browser storage only as a read-only offline cache

Not decided and not implied:

- a major frontend rewrite
- replacing React
- introducing Next.js or another full-stack frontend framework
- service-worker library choice
- exact PWA install/update UX
- exact local cache technology or schema

---

## Backend

Spring Boot is the target backend technology.

There is one Spring Boot application. Domain areas are not split into
independently deployed services.

That application owns:

- Band domain logic
- Memberships
- roles and authorization
- Invitations
- Songs
- Setlists
- PersonalSongNotes
- Ownership transfer
- domain invariants
- validation of mutations
- optimistic concurrency protection
- mapping from an authenticated external identity to the global My Songbook
  User identity

The backend is the only trusted place for tenant isolation and permission
checks. Every Band-scoped API operation must derive authorization from the
authenticated User's Membership in that Band.

Internal packages or modules may group these concerns for clarity. That is an
implementation structuring choice, not a license to introduce independently
deployable services or a generic modularization framework.

Not decided and not implied:

- API style (for example REST vs. another HTTP API style)
- endpoint design, URL layout, or payload formats
- Java package layout
- JPA mapping details
- exact validation or error-response conventions

---

## Database

PostgreSQL is the authoritative system of record.

PostgreSQL fits this domain because the accepted model is relational and
transactional:

- a global User identity is referenced by Memberships and PersonalSongNotes
- Band, Membership, Invitation, Song, Setlist, ordered Setlist entries, and
  PersonalSongNote have explicit relationships and cardinalities
- invariants require atomic updates, including Ownership transfer (exactly one
  OWNER at every moment), Invitation consumption, Song deletion with dependent
  PersonalSongNotes and Setlist entries, and Membership end with deletion of
  that User's PersonalSongNotes for that Band
- tenant isolation is expressed as ordinary foreign-key relationships, not as
  separate physical databases

Band data is stored in the single PostgreSQL database. There is no separate
database or schema per Band. Tenant isolation is enforced through domain
relationships and backend authorization.

The relational model must be able to represent the accepted domain concepts:

- global User identity reference
- Band
- Membership
- MembershipRole
- Invitation
- Song
- Setlist
- ordered Setlist entries
- PersonalSongNote

This document does **not** define the physical schema. Column names, keys,
indexes, JSON vs. relational storage for ChordPro content, and SQL migrations
remain later implementation work.

---

## Identity and authentication

Authentication is delegated to a **separate Identity Provider**.

The Identity Provider is responsible for establishing the global external
identity of a person.

The Spring Boot application is responsible for authorization.

The Spring Boot application maps the authenticated external identity to the
global My Songbook User identity used by the domain.

The Identity Provider must **not** own:

- Band Memberships
- Band roles
- OWNER / ADMIN / MEMBER / GUEST authorization
- Song permissions
- Setlist permissions
- Invitation domain rules

**Selected Identity Provider:** Keycloak

Keycloak ist der ausgewählte Identity Provider. Eine bestehende Installation
(z. B. unter `login.docfaust.de`) wird genutzt; der Provider läuft nicht im
Compose-Stack dieses Repositories.

Die folgenden Punkte gehören zu späterer Authentifizierungsarbeit und sind hier
nicht festgelegt:

- realms, clients, scopes, and token claims
- session lifetimes
- password policies
- social login
- passkeys
- MFA
- provider configuration
- the authentication protocol details used between the PWA, Spring Boot, and
  the Identity Provider

---

## Invitation authentication boundary

The accepted product behavior remains:

- an Invitation is a single-use link
- an Invitation belongs to a Band
- an Invitation is not associated with a recipient User before acceptance
- the same link flow works for existing and new Users
- the Invitation context survives login or registration
- accepting creates a GUEST Membership
- an Invitation expires after 14 days

The target architecture acknowledges that the Invitation context **must**
survive an authentication or registration round trip.

**How** that context is preserved is deliberately deferred. It will be decided
together with the concrete authentication integration.

Do not infer any of the following from this document:

- cookies
- OAuth `state`
- URL parameters
- temporary sessions
- token encoding
- signed invitation URLs

---

## Offline architecture

Offline capability exists primarily for rehearsal and live-performance
continuity.

Offline mode is **read/use only**.

The PWA maintains a local read-only cache containing the relevant readable
domain data for **all Bands accessible to the authenticated User**. This
includes at least:

- Songs
- Setlists
- PersonalSongNotes required for those Songs

The User does **not** manually select Bands for offline availability.

There is no:

- "download this Band for offline use" workflow
- per-Band offline toggle
- offline mutation queue
- replay of offline writes
- offline conflict resolution

When online, the application refreshes the local cache automatically in the
background. The User should not have to manually trigger synchronization for
normal use.

The exact refresh mechanism and timing are implementation details and remain
deferred.

Do not infer any of the following from this document:

- polling intervals
- WebSockets
- push notifications
- background sync APIs
- a particular service-worker library
- an exact IndexedDB or Cache Storage schema

The current IndexedDB implementation is **not** authoritative persistence in
the target architecture. Local browser storage becomes a read-only
offline/cache concern.

Offline authenticated-session mechanics — how a previously authenticated User
remains able to read the local cache without a network — are deliberately
deferred.

---

## Source of truth

PostgreSQL through the Spring Boot API is the authoritative state.

Local browser/PWA data is a disposable read-only representation of server
state.

The local cache must never become an independent source of truth.

There is no offline merge between local and server data, because offline
mutations are not supported. After connectivity is restored, the local cache
is refreshed from the server. The server state remains authoritative even if
the local cache is missing, stale, or discarded.

---

## Existing IndexedDB data

There is no productive legacy dataset that needs to be migrated.

The current IndexedDB stores are development-era persistence. They may be
replaced as the target architecture is implemented.

Do **not** design:

- legacy migration
- data conversion from the current IndexedDB model
- automatic migration of existing IndexedDB content
- backward compatibility with the current local persistence model

The current stores and field names in `docs/current-data-model.md` describe
CURRENT reality only. They are not a constraint on the target cache or on the
PostgreSQL schema.

---

## Online concurrency

Concurrent online writes use **optimistic locking**.

The goal is to prevent silent overwriting of another User's changes.

For mutable shared domain objects, the server detects updates based on stale
versions.

If the submitted version is stale:

- the write is rejected
- the newer server state remains authoritative
- no silent last-write-wins overwrite occurs

For the initial target architecture there is no:

- automatic merge
- domain-level conflict workflow
- CRDT
- collaborative real-time editor

Not decided and not implied:

- the exact HTTP status for a rejected stale write
- JPA annotations or database column names for versions
- the frontend conflict UX after a rejected write

---

## Multi-tenancy

Band is the tenant boundary for Band-owned data.

A global User may participate in zero, one, or multiple Bands.

Every Band-scoped API operation must derive authorization from the
authenticated User's Membership in that Band.

The backend must enforce tenant isolation. A User must not gain access to
another Band's data merely by knowing or guessing identifiers.

Do not rely on the following as security boundaries:

- frontend filtering
- hidden UI controls
- local cache separation

PersonalSongNotes remain User-owned. They are accessible only according to the
accepted domain rules: a note exists only while the User has an active
Membership in the Band that owns the referenced Song, and only that User may
read or maintain it.

There is one PostgreSQL database. Tenant isolation is not implemented by
separate databases, separate schemas per Band, or a generic multi-tenant
framework.

---

## Deployment

**Docker Compose** is the target deployment mechanism.

The application stack has separate containers for:

- React frontend / PWA
- Spring Boot backend
- PostgreSQL

The React frontend is deployed independently from Spring Boot. Spring Boot
does **not** serve the React application. The frontend container serves the
built static React/PWA assets. A lightweight static web server such as nginx
is a reasonable implementation option; the exact static server is not fixed
by this architecture.

At a high level:

```text
Client
    |
    v
Frontend container
    |
    v
Spring Boot API container
    |
    v
PostgreSQL container
```

Authentication uses the separate Identity Provider boundary.

Whether that Identity Provider runs as another container in the same Docker
Compose stack, or whether an existing external Identity Provider installation
is reused, is decided: My Songbook nutzt die externe Keycloak-Installation
(z. B. `login.docfaust.de`), nicht einen Keycloak-Container im Compose-Stack.

The following remain deferred:

- exact reverse-proxy setup
- TLS termination
- public URL structure
- exact frontend static web server
- production host
- whether PostgreSQL may later use a managed service
- whether the Identity Provider is inside or outside this Compose stack (externes Keycloak)
- CDN usage

Kubernetes is **not** part of the target architecture. Do not introduce it
without a later concrete operational requirement.

Monitoring/observability stack and backup/restore implementation are also
deferred.

---

## Security boundaries

| Component | Trusted for | Not trusted for |
|---|---|---|
| Identity Provider | Authentication; establishing the global external identity | Band Memberships, roles, Song/Setlist permissions, Invitation domain rules |
| Spring Boot | Domain authorization; Membership checks; tenant isolation; mutation validation; domain invariants; mapping external identity to the My Songbook User | Being the login-credential store for the global authentication mechanism |
| PostgreSQL | Authoritative persistent state | Making authorization decisions by itself |
| React/PWA | Presentation; user interaction; local read-only offline data | Authorization; tenant isolation; enforcing domain invariants |

The frontend is never trusted to enforce authorization.

---

## Current-to-target implications

### CURRENT

```text
React/Vite
    |
    v
IndexedDB
(authoritative local data)
```

The current application is a client-only React/Vite SPA. Songs and setlists
are stored locally in IndexedDB. There is no backend, no authentication, no
Band tenancy, and no synchronization. See `docs/current-architecture.md`.

### TARGET

```text
React/Vite PWA
    |
    v
Spring Boot API
    |
    v
PostgreSQL
(authoritative data)
```

plus:

- a separate Identity Provider for authentication
- local browser storage only as a read-only offline cache

This is a change of source of truth, not a requirement to replace the whole
UI. Much of the existing React UI, ChordPro conversion, rendering, and
interaction logic may remain reusable.

A detailed migration plan is not part of this document. Existing IndexedDB
data does not need a legacy migration.

---

## Deliberately deferred decisions

The following remain intentionally deferred. They are not gaps in this
architecture; they will be decided when the next implementation step needs
them.

- final Identity Provider selection
- authentication protocol and configuration details
- invitation context preservation across authentication
- offline authenticated-session mechanics
- physical PostgreSQL schema
- API style/details and endpoint design
- exact local cache technology and schema
- service-worker implementation
- background refresh timing and mechanism
- exact optimistic-locking implementation
- conflict UI for rejected stale writes
- whether the Identity Provider runs inside or outside the Docker Compose stack
- exact reverse-proxy setup, TLS termination, and public URL structure
- exact frontend static web server
- production host
- whether PostgreSQL may later use a managed service
- CDN usage
- monitoring/observability stack
- backup/restore implementation
- account deletion lifecycle

Account deletion is also deferred in the domain model. This architecture does
not invent a deletion workflow ahead of that product decision.

---

## Related documents

| Document | State | Role |
|---|---|---|
| `docs/product-vision.md` | TARGET | Product capabilities and principles |
| `docs/domain-model.md` | TARGET | Domain concepts, ownership, roles, and invariants |
| `docs/target-architecture.md` | TARGET | Technical target architecture (this document) |
| `docs/current-architecture.md` | CURRENT | Implemented application structure |
| `docs/current-data-model.md` | CURRENT | Implemented IndexedDB persistence |

CURRENT documents continue to describe present reality. They must not be read
as the target architecture.
