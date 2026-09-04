# Implementation Roadmap

## Status

PLANNED

This document describes the **CURRENT → TARGET implementation path** for My
Songbook.

It is a practical migration roadmap, not the current architecture and not a
substitute for the accepted target architecture.

Related documents:

- `docs/current-architecture.md` — CURRENT application structure
- `docs/current-data-model.md` — CURRENT Persistenz (PostgreSQL maßgeblich für Songs und Setlists)
- `docs/product-vision.md` — TARGET product capabilities
- `docs/domain-model.md` — TARGET domain concepts and invariants
- `docs/target-architecture.md` — TARGET technical architecture

This roadmap does **not**:

- change accepted product, domain, or architecture decisions
- prescribe physical PostgreSQL schema, API endpoints, or IdP configuration
- require a legacy IndexedDB data migration

Apply the Simplicity Principle from `AGENTS.md`: small reviewable steps,
runnable intermediate states, infrastructure only when the next step needs it,
no speculative abstractions, no temporary architecture that will immediately
be thrown away.

---

## Target to reach

The accepted target architecture is:

- React/Vite PWA frontend
- separate Spring Boot domain API
- PostgreSQL as authoritative system of record
- Spring Data JPA with Hibernate as the backend persistence abstraction
- Flyway as exclusive schema owner
- separate Identity Provider boundary
- Keycloak als ausgewählter Identity Provider (lokal in Compose für Entwicklung;
  Produktion kann ein externes Keycloak nutzen)
- Docker Compose deployment
- separate frontend container
- separate Spring Boot container
- PostgreSQL container
- local Compose Keycloak for development; production may use external Keycloak
- backend-enforced Band tenant isolation
- offline read/use mode only
- automatic local read-only cache for all Bands accessible to the User
- no offline mutation queue
- optimistic locking for concurrent online writes
- no legacy productive IndexedDB data migration

```text
CURRENT:  React SPA (nginx container) → Spring Boot API (Spring Data JPA / Hibernate + Flyway) → PostgreSQL
                       (User, Band, Membership, Song, Setlist; package de.docfaust.mysongbook)
                       PostgreSQL is authoritative for Songs and Setlists.
                       IndexedDB is no longer the source of truth.
                       Offline/PWA cache is not implemented yet.
                       Local Compose: frontend + backend + PostgreSQL + Keycloak.

TARGET:   React PWA  → Spring Boot API (Spring Data JPA / Hibernate + Flyway)
                       → PostgreSQL
          + Identity Provider
          + local read-only cache
```

---

## Planning principles

Prefer:

- small vertical or infrastructure slices
- runnable intermediate states
- one pull request per step whenever reasonably possible
- explicit dependencies between steps
- preservation of existing working frontend behavior for as long as practical
- introducing infrastructure only when the next step needs it
- replacing CURRENT behavior incrementally instead of performing a rewrite

Avoid:

- "implement the whole backend" steps
- broad rewrites
- speculative abstractions
- temporary architecture that will immediately be thrown away
- adding authentication before there is a useful backend boundary to protect
- adding offline caching before server-authoritative data exists
- premature cleanup of working frontend code

The current IndexedDB persistence may be replaced when the relevant feature
moves to the backend. There is no productive legacy dataset to migrate. Do
not remove IndexedDB earlier than necessary. Do not design a migration tool
for existing local data.

---

## Sequencing rationale

The order is derived from dependencies and migration safety, not from a
naive list of technologies.

| Do not start with | Why |
|---|---|
| Identity Provider / login | There is not yet an API worth protecting. |
| PWA / offline cache | That would cache the wrong source of truth (IndexedDB). |
| Songs on the server | A Song without a Band does not exist in the domain model. |
| Setlists API | Persistence would be written with JDBC and immediately rewritten for JPA. |
| Removing IndexedDB | The UI should stay locally usable until cutover. |
| Full Compose including TLS/proxy | The next steps do not need it. |

Optimistic locking is introduced **with the first shared write APIs** (Songs,
Setlists), not as a late extra step.

The frontend container is introduced when the frontend actually calls the API
as a separate origin — not on day one.

Setlists must be implemented only after the JDBC-to-JPA persistence
migration. New persistence code must not be written with JdbcTemplate and
immediately rewritten for Spring Data JPA.

**Identity Provider:** Steps 1–2 können ohne IdP implementiert werden. In Step 3
wurde Keycloak als Identity Provider ausgewählt. Dieses Roadmap-Dokument
beschreibt keine Keycloak-Administrationskonfiguration.

---

## Accepted implementation decisions

These decisions are made and are no longer open:

- Java 25
- Gradle
- Gradle Kotlin DSL
- backend located under `backend/`
- Java package convention `de.docfaust.<application>`; this application
  uses `de.docfaust.mysongbook` for all production and test code
- Flyway is the accepted migration technology
- Flyway is introduced with the PostgreSQL/database step (Step 2), not in
  Step 1
- Flyway remains the exclusive owner of schema creation and migration
- Spring Data JPA with Hibernate is the accepted backend persistence
  architecture; CURRENT persistence uses Spring Data JPA with Hibernate
  for User, Band, Membership, Song, and Setlist
- Hibernate must not create or modify the production schema
  (`ddl-auto` must not be `update`, `create`, or `create-drop`)
- persistence and integration tests use Testcontainers PostgreSQL, not H2
- Setlists are implemented only after the JDBC-to-JPA migration

---

## Milestones

1. **Backend foundation** — Spring Boot exists; PostgreSQL and Compose run the API and database. Frontend unchanged.
2. **Identity and tenancy** — Authentication, global User, Band, OWNER membership.
3. **Server becomes source of truth** — JDBC-to-JPA persistence migration; Songs and Setlists on the API; frontend cutover; frontend container.
4. **Collaboration within a Band** — Invitations, membership lifecycle, personal song notes.
5. **Rehearsal readiness and cleanup** — PWA read-only cache; remove IndexedDB authority.

---

# Milestone 1 — Backend foundation

No domain model, no authentication. Frontend unchanged.

## Step 1 — Spring Boot skeleton with health endpoint

**Status:** COMPLETED

**Goal**  
The later domain API exists as a runnable application in the repository,
including Java CI. This is the backend boundary everything else attaches to.

**Changes**  
Backend under `backend/`, Java 25, Gradle with Kotlin DSL, health/liveness
endpoint, Java tests, CI job beside the existing Node job. Frontend,
IndexedDB, and Docker remain untouched.

**Does not include**  
PostgreSQL, Compose, Flyway, JPA, domain, authentication, frontend changes,
API design beyond health.

**Dependencies**  
None.

**Resulting runnable state**  
`npm run dev` works as today. The backend starts locally and health responds.
Node CI stays green; Java CI checks the backend.

**Verification**  
Backend tests plus a health request in CI. Existing `npm run test:ci`, `lint`,
and `build` remain green.

**Risk**  
Low. Isolated infrastructure; existing app untouched.

---

## Step 2 — PostgreSQL and Compose for backend and database

**Status:** COMPLETED

**Goal**  
PostgreSQL becomes the runtime persistence. Docker Compose starts the backend
container and the PostgreSQL container. Flyway is wired, still without domain
tables.

**Changes**  
Compose file with PostgreSQL and Spring Boot services, datasource, Flyway,
backend Dockerfile. Frontend continues via Vite.

**Does not include**  
Frontend container, nginx, reverse proxy, TLS, Identity Provider container,
domain tables, authentication.

**Dependencies**  
Step 1.

**Resulting runnable state**  
Compose brings up API and Postgres. Health/readiness uses the real database
connection. The React app still runs locally against IndexedDB.

**Verification**  
Compose start locally. Backend tests against Postgres (Testcontainers or
Compose). Readiness fails when Postgres is missing.

**Risk**  
Low to medium. First operational cut, but no product data yet.

**Earliest useful container point:** PostgreSQL and backend containers here.
The frontend container waits until the frontend actually calls the API.

---

# Milestone 2 — Identity and tenancy

From this milestone an Identity Provider is required. Keycloak ist der
ausgewählte Provider. Lokal kann Keycloak in Compose laufen; Produktion
kann ein externes Keycloak nutzen.

## Step 3 — Authentication and global User identity

**Status:** COMPLETED

**Goal**  
Login/registration through the separate Identity Provider. Spring Boot
validates authentication and maps the external identity to the global My
Songbook User (created on first login). Band authorization does not exist
yet.

**Changes**  
User persistence, identity mapping, Spring Security resource server, minimal
login wiring in the frontend. Editor/Import/Setlist remain on IndexedDB. IdP
selection becomes binding here (Keycloak preferred because an installation is
available).

**Does not include**  
Keycloak fine-tuning (realms, scopes, MFA, passkeys, social login) beyond the
minimum needed for login; Band/Membership; Songs API; mandatory login for the
editor; invitation context surviving login.

**Dependencies**  
Step 2.

**Resulting runnable state**  
A user can sign in and out. Without login, Import, Editor, and Setlists still
work locally. The API knows the User but does not yet protect Band data.

**Verification**  
Backend tests: unknown token → 401; valid token → User is created or found.
UI test: login flow; existing editor without login.

**Risk**  
Medium. First IdP integration; keep the slice narrow.

---

## Local Keycloak integration environment

**Status:** COMPLETED (development infrastructure after Step 3)

Zwischen abgeschlossenem Step 3 und Step 4 existiert eine lokale
Keycloak-Integrationsumgebung in Docker Compose (Realm-Import, öffentlicher
SPA-Client, lokaler Issuer). Das ist Entwicklungsinfrastruktur für denselben
OIDC/JWT-Flow, kein neuer Domain-Schritt und keine zweite Auth-Architektur.
Step 5 (Songs API) und die Java-Paket-Umbenennung (PR #93) sind abgeschlossen.
Die JDBC-zu-JPA-Persistenzmigration (Step 5.2) ist abgeschlossen.
Die Setlists API (Step 6) ist abgeschlossen.
Der Frontend-Cutover (Step 7) ist abgeschlossen. Der Frontend-Container
in Compose (Step 8) ist abgeschlossen. Einladungen und Mitgliederverwaltung
(Step 9) sind abgeschlossen. Als Nächstes folgen Ownership-Übertragung
(Step 10, Rest) bzw. die übrigen Milestone-4/5-Schritte.

---

## Step 4 — Create Band and OWNER membership

**Status:** COMPLETED

**Goal**  
Band is the tenant. Authenticated users create a Band and become OWNER. The
active Band is a visible usage context. Songs are not yet on the server.

**Changes**  
Band and Membership persistence, create/list Band API, OWNER invariant, UI to
create and switch Band. The editor stays local and must **not** pretend that
IndexedDB songs already belong to a Band.

**Does not include**  
Invitations, role changes, ownership transfer, Songs/Setlists on the server,
partitioning IndexedDB by Band (that would be throwaway work).

**Dependencies**  
Step 3.

**Resulting runnable state**  
Login, create Band, Band context in the UI. The music workflow remains local.

**Verification**  
Tests: create produces exactly one OWNER membership; foreign Band IDs are
inaccessible; a User without membership may create a Band but has no Band
songs.

**Risk**  
Medium. New UI beside the old workflow; keep Band and local songs deliberately
unconnected.

---

# Milestone 3 — Server becomes source of truth

Optimistic locking belongs in the write APIs, not in a late extra PR. Do
**not** switch Songs and Setlists in the frontend separately: Setlists
reference Song IDs.

Persistenz für neue Domain-Aggregate (Setlists) wird auf der
Spring-Data-JPA-Schicht aus Step 5.2 implementiert.

## Step 5 — Songs API (band-scoped, including optimistic locking)

**Status:** COMPLETED

**Goal**  
Songs belong to exactly one Band. Create, read, update, delete with role
checks. Stale writes are rejected. The existing UI does not write to this API
yet.

**Changes**  
Song schema (title, artist, ChordPro, Band foreign key, version), API,
Membership checks (GUEST reads; MEMBER/ADMIN/OWNER write; delete only
OWNER/ADMIN). Prepare or explicitly defer cascade rules for dependent notes
and setlist entries.

**Does not include**  
Frontend switch, converter changes, Setlist API, PWA cache, conflict UX beyond
an API error.

**Dependencies**  
Step 4.

**Resulting runnable state**  
Songs are usable via API in Band context. UI still uses IndexedDB.

**Verification**  
Role matrix; isolation between Bands; update with a stale version fails and
the server state remains.

**Risk**  
Medium. First real domain API; UI not yet affected.

---

## Java package namespace refactoring

**Status:** COMPLETED (PR #93)

The backend Java root package is `de.docfaust.mysongbook`. The permanent
convention is `de.docfaust.<application>`. All production and test Java
code lives below this package. Domain-oriented packages such as `api`,
`band`, `song`, `user`, and `security` remain below that root.

This was a namespace refactoring, not a domain step. It does not change
API behavior.

---

## Step 5.1 — Dependency / Dependabot cleanup

**Status:** PLANNED

**Goal**  
Restore a clean, understandable dependency-update baseline before the
persistence refactoring. Open Dependabot pull requests are inspected and
resolved so the JPA migration does not start on a noisy or failing update
queue.

**Changes**  
Inspect all currently open Dependabot PRs. Determine why their builds are
failing. Identify obsolete or superseded dependency update PRs and close
those. Update, recreate, or merge the remaining appropriate dependency
updates. The result is a clean dependency-update state, not a requirement
to merge every open Dependabot PR.

**Does not include**  
Blindly merging all Dependabot PRs. JPA migration. Setlists. Unrelated
application changes.

**Dependencies**  
Step 5 and the Java package namespace refactoring (PR #93).

**Resulting runnable state**  
Unchanged application behavior. The repository has a clear dependency
baseline suitable for the persistence migration.

**Verification**  
Open Dependabot PRs are either merged, updated, or closed with a reason.
CI on the default branch remains green.

**Risk**  
Low to medium. Dependency updates can fail for reasons unrelated to the
application domain; inspect before merging.

---

## Step 5.2 — JDBC to Spring Data JPA persistence migration

**Status:** COMPLETED

**Goal**  
Replace JdbcTemplate-based repository implementation with Spring Data JPA
and Hibernate for the persistence repositories and entities that exist at
that point (User, Band, Membership, Song). This is a focused persistence
refactoring. Setlists are not part of this step.

**Changes**  
Introduce Spring Data JPA. Map existing domain records as JPA entities
where appropriate. Preserve Flyway as exclusive schema owner. Use
`@Version` for optimistic locking on Songs so the current conflict
semantics remain. Keep Band-scoped repository access. Tests continue
against Testcontainers PostgreSQL.

**Does not include**  
Setlist implementation. Schema redesign. Hibernate-managed schema
generation (`ddl-auto` `update` / `create` / `create-drop`). H2. API
contract changes. Weakening tenant isolation or optimistic locking.
Frontend changes.

**Dependencies**  
Step 5.1.

**Resulting runnable state**  
Existing REST endpoints, authentication, authorization, Band tenant
isolation, optimistic locking, Flyway history, and functional behavior
remain. Persistence is Spring Data JPA. The UI is unchanged.

**Verification**  
Existing backend endpoint tests remain green against PostgreSQL. Stale
Song writes still fail with the current conflict behavior. Cross-Band
access remains impossible. Flyway migrations are unchanged in effect.
No Hibernate schema generation in the runtime configuration.

**Risk**  
Medium. Persistence rewrite with a requirement to preserve behavior.
Keep the slice strictly to existing aggregates.

Do not combine this migration with Setlist implementation.

---

## Step 6 — Setlists API (ordered entries, optimistic locking)

**Status:** COMPLETED

**Goal**  
Setlists belong to a Band, reference only Songs of the same Band, order
matters, the same Song may appear more than once. Deleting a Song removes
entries; the Setlist remains.

**Changes**  
Setlist and entry persistence on the Spring Data JPA layer from Step 5.2,
API, the same role rules as in the domain model.

**Does not include**  
Frontend switch, copying between Bands, offline cache, JDBC repository
implementation, repeating the JPA migration.

**Dependencies**  
Steps 5, 5.1, and 5.2. Setlists must not be implemented against
JdbcTemplate and then immediately migrated to JPA.

**Resulting runnable state**  
Songs and Setlists are fully usable on the server. UI still local.

**Verification**  
Entry pointing at another Band's Song is impossible; duplicates allowed;
Song delete cleans up entries.

**Risk**  
Low to medium. Close to Step 5; own review because order and duplicates are
easy to get wrong.

---

## Step 7 — Frontend cutover: API instead of IndexedDB

**Status:** COMPLETED

**Goal**  
Import, Editor, and Setlists use the Spring Boot API of the active Band.
PostgreSQL is authoritative. Current IndexedDB is no longer the source of
truth. **No** migration tool for old local data.

**Changes**  
`ImportPage`, `EditorPage`, `SongTextArea`, `SetlistPage`, and persistence
access: away from `src/db.js` as authority, toward an API client. Auth becomes
mandatory for the music workflow. Empty state without a Band (create / accept
invite). Minimal handling of rejected stale writes (no merge, no CRDT).
Converter and ChordPro rendering stay.

**Does not include**  
PWA/offline cache, invitations, PersonalSongNotes, deleting `db.js` if tests
or dead code still need it, UI redesign.

**Dependencies**  
Steps 5 and 6 (and 3–4 for login/Band).

**Resulting runnable state**  
A signed-in User with a Band imports, edits, and organizes setlists online
via the API. Old IndexedDB songs do not appear. No writes without network.

**Verification**  
Existing page tests moved onto API mocks; manual round-trip against Compose;
401 without login; Band A does not see Band B.

**Risk**  
High. Visible cut; Setlists and Songs must move together.

**IndexedDB loses authority here.** `src/db.js` may still exist, but it is no
longer the system of record.

---

## Step 8 — Frontend container in Compose

**Status:** COMPLETED

**Goal**  
The built React frontend runs in its own container. Spring Boot does not
serve the UI. The Compose stack matches the target shape (frontend, API,
Postgres). Local Keycloak already exists as development infrastructure;
production Keycloak remains an environment choice.

**Changes**  
Frontend Dockerfile, static server (nginx is acceptable, not mandatory),
Compose service, API base URL/CORS as far as needed for local Compose.

**Does not include**  
TLS, production reverse-proxy setup, CDN, Kubernetes, public URL structure.

**Dependencies**  
Step 2; practically after Step 7, because the container then needs a real API
URL.

**Resulting runnable state**  
`docker compose up` starts UI + API + Postgres. Login and Band workflow work
against this stack (local Compose Keycloak or an external Keycloak).

**Verification**  
UI from the frontend container; API calls against the backend container, not
Vite.

**Risk**  
Low to medium. CORS/URL details, but small scope.

---

# Milestone 4 — Collaboration within a Band

## Step 9 — Invitations

**Status:** COMPLETED

**Goal**  
OWNER/ADMIN create a single-use link and share it themselves. The same link
works for existing and new Users; context survives login/registration;
accepting creates GUEST; expiry is 14 days. OWNER/ADMIN also manage
ADMIN/MEMBER/GUEST memberships.

**Changes**  
Invitation persistence and API, UI to create/revoke and accept, member list,
role changes, member removal, and how invitation context survives the
authentication round trip: the invite token is stored in `sessionStorage`
before the existing OIDC login. After the callback, React Router navigates
to `/invite/:token`. The raw token is returned once; only a SHA-256 hash is stored.

This step also implements the membership administration from Step 10 except
ownership transfer and voluntary leave.

**Does not include**  
Email sending, user search, QR as an extra channel, reusable join links, role
choice on the invitation, ownership transfer, leave band, account deletion.

**Dependencies**  
Steps 3, 4, and 7 (a guest should see Band data after accepting).

**Resulting runnable state**  
A second User joins as GUEST, sees songs/setlists, and cannot change shared
Band data. OWNER/ADMIN can promote or remove that member.

**Verification**  
Accept, expiry, revoke; second accept of the same link impossible;
existing membership is not downgraded; other links for the same Band remain;
OWNER remains immutable; cross-band membership changes are rejected.

**Risk**  
Medium to high. Auth boundary plus domain rules; keep scope on the single
link flow plus membership administration.

---

## Step 10 — Membership management and ownership transfer

**Status:** PLANNED

**Goal**  
Leave voluntarily and transfer ownership atomically (exactly one OWNER).
Role changes and member removal for ADMIN/MEMBER/GUEST are already
implemented in Step 9. Delete that User's PersonalSongNotes for this Band
when membership ends — once notes exist, otherwise prepare the rule.

**Changes**  
Ownership transfer and voluntary leave. A GUEST can already be promoted so
other members can edit.

**Does not include**  
Account deletion, invitation redesign, song distribution between Bands,
creating a second OWNER.

**Dependencies**  
Step 9 (otherwise there is nobody to manage except the OWNER).

**Resulting runnable state**  
A Band can promote GUEST → MEMBER/ADMIN (already possible); OWNER transfers
ownership.

**Verification**  
Role matrix; ADMIN cannot remove OWNER; transfer never yields 0 or 2 OWNERs;
leave deletes notes only for this Band.

**Risk**  
Medium. Many invariants, but a tight boundary.

---

## Step 11 — Personal song notes

**Status:** PLANNED

**Goal**  
At most one note per User and Song, only while membership is active, private,
writable online.

**Changes**  
PersonalSongNote persistence/API, UI on the song, isolation from other
members.

**Does not include**  
Band-wide song annotations, offline writes, PWA cache (comes after this so
notes are included in the cache).

**Dependencies**  
Step 7 (Songs on the server). Independent of Steps 9/10; sensible after 7,
parallel to 9–10.

**Resulting runnable state**  
Each member maintains their own notes; others do not see them.

**Verification**  
Uniqueness `(User, Song)`; access only by owner; membership end or Song
delete removes notes.

**Risk**  
Low. Small, clear model.

---

# Milestone 5 — Rehearsal readiness and cleanup

## Step 12 — PWA and automatic read-only cache

**Status:** PLANNED

**Goal**  
Installable PWA. Automatic background refresh of readable data for all Bands
of the User (Songs, Setlists, required PersonalSongNotes). Offline is
read/use only. No per-Band offline selection, no mutation queue.

**Changes**  
PWA baseline (service worker / manifest — concrete library still open), local
read-only cache (technology still open), write UI online-only, setlist
navigation offline.

**Does not include**  
Offline editor, sync conflicts, push, WebSockets, polling intervals as an
architecture decision, reuse of `SongbookDB` as authoritative storage.

**Dependencies**  
Steps 7 and 11 (the cache needs authoritative server data including notes).
Step 8 is useful for realistic operation.

**Resulting runnable state**  
After a previous online run: rehearsal/performance without network (read,
switch songs in a setlist, read notes). Writes only when online again. The
cache discards/overwrites locally and never merges.

**Verification**  
Offline after cache: songs/setlists/notes readable; save fails or is
disabled; after online refresh the server state wins. No replay of local
writes.

**Risk**  
Medium. Service-worker complexity; keep the slice strictly read-only.

Offline authenticated-session mechanics (how the cache remains usable without
network after prior authentication) are solved in this step as far as
rehearsal/performance requires. Fine-tuning may be a follow-up, not a blocker
for the rest.

**The target architecture is functionally reached here**, provided Steps 8–11
are also done.

---

## Step 13 — Remove IndexedDB authority and dead persistence path

**Status:** PLANNED

**Goal**  
`SongbookDB` / `src/db.js` is gone as authoritative persistence. No second
local song model.

**Changes**  
Remove it or reduce it to the new read-only cache; adapt tests that mock
`db.js`. Updates to CURRENT documentation belong in a **separate docs PR**,
not in this implementation PR, unless a runtime sentence is unavoidable.

**Does not include**  
UI redesign, converter cleanup, deleting unused legacy components other than
the persistence path.

**Dependencies**  
Step 7 is required. Step 12 if the cache is deliberately not the old
database — then delete only after the cache exists, so two local models do
not collide.

**Resulting runnable state**  
No authoritative IndexedDB. The app is API plus an optional disposable cache.

**Verification**  
No production imports from `src/db.js`; tests green; an empty profile starts
without old stores as truth.

**Risk**  
Low, once cutover and cache already work.

---

Thirteen numbered product steps plus two persistence-prep steps (5.1, 5.2)
still fit the intended size (roughly 8–15 PRs). Do not merge Steps 5
and 6 (two domain aggregates). Do not merge Step 5.2 with Step 6 (do not
write Setlist persistence in JDBC). Do not merge Step 7 with Step 5 (the
PR would be unreviewable). Do not put Step 9 before Step 7 (a guest would
have no server songs). Do not put Step 12 before Steps 7 and 11.

---

## Critical path

**Next implementation PR:** Step 10 — Ownership transfer and leave band.

A local Keycloak Compose environment exists after Step 3 so the
authentication flow can be tested without the external Keycloak. Step 4
introduced Band as tenant and OWNER membership. Step 5 introduced the
band-scoped Songs API with optimistic locking. PR #93 moved the Java
package root to `de.docfaust.mysongbook`. Persistence is Spring Data JPA
with Hibernate (Step 5.2). Step 6 added the band-scoped Setlists API.
Step 7 moved the React music workflow onto that API; PostgreSQL is
authoritative for Songs and Setlists. IndexedDB is no longer the source
of truth. Step 8 added the frontend container to Compose (nginx serving
the Vite production build, `/api` reverse-proxied to the backend).
Step 9 added one-time invitation links and membership administration
for ADMIN/MEMBER/GUEST. OWNER remains immutable; ownership transfer is
not implemented. Offline/PWA caching is not implemented yet.

**Main dependency chain**

```text
1 Spring Boot
    → 2 Postgres + Compose (API + DB)
        → 3 Auth + User          ← select IdP here
            → local Keycloak integration environment (dev infra)
            → 4 Band + OWNER
                → 5 Songs API
                    → Java package namespace refactoring (PR #93)
                    → 5.1 Dependency / Dependabot cleanup
                        → 5.2 JDBC → Spring Data JPA
                            → 6 Setlists API
                                → 7 Frontend cutover     ← IndexedDB no longer authoritative
                                                            Auth mandatory for the music workflow
                                    → 8 Frontend container
                                    → 9 Invitations + membership admin
                                        → 10 Ownership transfer / leave
                                    → 11 PersonalSongNotes
                                        → 12 PWA + read-only cache   ← target architecture reached
                                            → 13 remove old IndexedDB API
```

**Parallel work (after the respective dependencies)**

- Step 11 after 7, parallel to 8–10.
- Step 8 after 2+7; not in parallel with cutover if API URL/CORS change the
  same frontend code.
- Steps 1–2 do not need an IdP.
- CURRENT documentation updates follow the implementation PRs; they are not a
  migration blocker.

| Event | When |
|---|---|
| IndexedDB no longer authoritative | End of Step 7 |
| Authentication mandatory for songs/setlists | Step 7 (completed). |
| Target architecture functionally reached | After Steps 8–12 (Compose shape, tenancy, domain, invitations, notes, offline read). Step 13 is cleanup, not a functional gap. |

---

## Deferred work

Not part of this migration:

- account deletion / account lifecycle
- extra profile fields
- generic Band settings
- extra Song metadata, BandSongNote
- Kubernetes, CDN, mandatory managed PostgreSQL
- monitoring/backup product selection
- production host, TLS, public URL design
- reverse proxy beyond the local Compose minimum
- production Keycloak host and operational setup (local Compose Keycloak is
  development infrastructure only)
- speculative scaling, microservices, eventing
- legacy migration of current IndexedDB data
- Next.js / frontend rewrite
- offline writes, CRDT, realtime editor

---

## Recommendation

1. **Next implementation PR:** Step 10 — Ownership transfer and leave band.

2. **Why it comes next:** Step 9 hat Einladungen und die Verwaltung von
   ADMIN/MEMBER/GUEST abgeschlossen. OWNER bleibt unveränderlich, bis
   Ownership übertragen werden kann.

3. **Scope boundary for that PR**
   - **In:** Atomic ownership transfer and voluntary leave.
   - **Out:** Account deletion, invitation redesign, PWA/offline cache.

4. **Already decided:** Java 25, Gradle with Kotlin DSL, backend under
   `backend/`, Java package `de.docfaust.mysongbook`, Flyway as exclusive
   schema owner, PostgreSQL 18, Docker Compose with frontend + backend +
   PostgreSQL + local Keycloak, Keycloak als Identity Provider (lokal in
   Compose oder extern), band-scoped Songs API with integer `version`
   optimistic locking, band-scoped Setlists API with ordered entries and
   integer `version` optimistic locking, Spring Data JPA with Hibernate as
   CURRENT backend persistence for User, Band, Membership, BandInvitation,
   Song, and Setlist, frontend music workflow against that API (Step 7),
   frontend container in Compose (Step 8), invitations and membership
   administration (Step 9).

   Service worker / PWA bleiben für spätere Schritte.

After Step 9, the next implementation PR is Step 10 — Ownership transfer
and leave band.
