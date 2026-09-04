# Current Architecture

## Status

CURRENT

Dieses Dokument beschreibt den **tatsächlich implementierten Ist-Zustand** der Anwendung, soweit er im Repository verifizierbar ist.

Es enthält keine Zielarchitektur, keine Migrationspläne und keine Produktvision.

Nicht vorhanden und daher **keine** bestehende Architektur:

- Offline-/PWA-Cache oder lokale Synchronisation
- Ownership-Übertragung oder freiwilliges Verlassen einer Band
- globales State-Management (Redux, Zustand, MobX)

Unter `backend/` existiert ein Spring-Boot-Service (Java 25, Gradle Kotlin DSL,
Wurzelpaket `de.docfaust.mysongbook`) mit Actuator-Liveness/Readiness,
OAuth2-Resource-Server (JWT von Keycloak) und Persistenz in PostgreSQL über
Spring Data JPA / Hibernate für globale User, Bands, Memberships, Einladungen, Songs und
Setlists. Flyway bleibt Schema-Owner (`ddl-auto=validate`). Docker Compose startet Frontend (nginx mit gebautem Vite-Bundle), Backend,
PostgreSQL 18 und ein lokales Keycloak für Entwicklung/Integrationstests. Flyway wendet Infrastruktur-, User-, Band-,
Song-, Setlist- und Invitation-Migrationen an. Die React-SPA wird im Compose-Stack aus dem Frontend-Container ausgeliefert, kann per Keycloak anmelden, ruft
`GET /api/me` auf und kann Bands anlegen sowie die aktive Band wählen. Es gibt
eine band-scoped Songs API, eine band-scoped Setlists API und APIs für
Einladungen sowie Mitgliederverwaltung mit Membership-Prüfungen
und Optimistic Locking bei Songs/Setlists.
Editor, Import und Setlists nutzen diese APIs der aktiven Band. OWNER und ADMIN
können Einladungslinks erzeugen und Mitglieder verwalten. PostgreSQL über die
Spring-Boot-API ist maßgeblich. Authentifizierung ist für den Musikworkflow Pflicht.
Ohne aktive Band gibt es keinen Music-Tenant. Es gibt noch keinen Offline-/PWA-Cache.
Alte IndexedDB-Daten werden nicht migriert und erscheinen nicht im Workflow.
Ein externes Keycloak (z. B. `login.docfaust.de`) bleibt unberührt und
ist dieselbe OIDC/JWT-Anbindung mit anderen Runtime-URLs, keine zweite
Auth-Architektur.

---

## Anwendungsüberblick

`my-songbook` ist eine clientseitige Single-Page-Anwendung (SPA).

Sie läuft als React-SPA im Browser. Import, Editor und Setlists lesen und
schreiben Songs und Setlists der aktiven Band über die Spring-Boot-API.
Maßgeblich ist PostgreSQL. User, Band und Membership liegen ebenfalls dort.

Die sichtbare Anwendung heißt in der UI **SongManager** (`Header`, `Home`). Repository, `frontend/package.json` und README verwenden den Namen **my-songbook**.

---

## Technologiestack

| Bereich | Implementierung |
|---|---|
| UI | React 19 (JavaScript/JSX, kein TypeScript im Anwendungscode) |
| Build / Dev | Vite 8, Plugin `@vitejs/plugin-react` |
| Routing | `react-router-dom` 7 (`BrowserRouter`) |
| UI-Bibliothek | Material UI 9 (`@mui/material`) plus Emotion |
| ChordPro-Rendering | `chordsheetjs` (`ChordProParser`, `HtmlTableFormatter`) |
| Persistenz | PostgreSQL über Spring Data JPA / Hibernate + Flyway für User, Band, Membership, BandInvitation, Song, Setlist (maßgeblich für den React-Musikworkflow); `frontend/src/db.js` / IndexedDB existiert noch, wird vom aktiven Workflow nicht verwendet |
| IDs | UUID vom Backend für Songs und Setlists; UUID für User/Band im Backend |
| Tests | Vitest 4, Testing Library, jsdom; Backend: JUnit + Testcontainers PostgreSQL 18 |
| Backend | Spring Boot 4.1 unter `backend/` (Java 25, Gradle Wrapper, Kotlin DSL), Wurzelpaket `de.docfaust.mysongbook`, Spring Data JPA / Hibernate + Flyway, OAuth2 Resource Server |
| Authentifizierung | Keycloak als Identity Provider; lokal in Compose oder extern über dieselben OIDC/JWT-Einstellungen; `react-oidc-context` im Frontend |
| Runtime | Docker Compose: `frontend` (nginx) + `backend` + `postgres:18` + `keycloak`; optional Vite-Dev-Server |
| Lint | ESLint 10 |

Es gibt keinen `ThemeProvider` und keine eigene MUI-Theme-Konfiguration. Komponenten nutzen die MUI-Defaults und überwiegend `sx`-Props.

---

## Projekt- und Verzeichnisstruktur

Relevante Teile des Repositories:

```text
my-songbook/
├── frontend/
│   ├── index.html             Einstieg HTML (Mount-Punkt #root)
│   ├── public/vite.svg        Favicon
│   ├── src/
│   │   ├── main.jsx           React-Bootstrap (StrictMode)
│   │   ├── App.jsx            Router, Header, Routen
│   │   ├── api/               API-Client für Songs, Setlists, Einladungen und Memberships
│   │   ├── auth/              OIDC-Login (Keycloak), /api/me-Aufruf
│   │   ├── band/              aktiver Band-Kontext (Auswahl, Anlegen)
│   │   ├── db.js              IndexedDB-Zugriff (nicht mehr maßgeblich; ungenutzte Legacy-Komponenten)
│   │   ├── index.css          globales Basis-CSS
│   │   ├── pages/             Routen-Seiten
│   │   ├── components/        UI-Komponenten
│   │   ├── converter/         aktiver ChordPro-Converter
│   │   ├── utils/             ugToChordPro (nicht im UI-Pfad)
│   │   └── __tests__/         App- und DB-Tests
│   ├── Dockerfile             Multi-Stage-Build der React-SPA (Node-Build, nginx-Runtime)
│   ├── nginx.conf             SPA-Fallback und Reverse-Proxy `/api` → backend
│   ├── .dockerignore          Frontend-Build-Kontext
│   ├── .env.example           öffentliche OIDC-/API-Konfiguration (Vite)
│   ├── .env.local.example     optionale Vite-Werte gegen Compose-Keycloak
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
├── docs/                      Projektdokumentation
├── backend/                   Spring Boot (Paket `de.docfaust.mysongbook`; Health, JPA, Flyway, Auth, User, Band, Song, Setlist)
├── compose.yaml               Frontend + Backend + PostgreSQL 18 + Keycloak
├── keycloak/                  lokales Entwicklungs-Realm (Import)
├── scripts/owasp-check.sh
├── scripts/verify-local-stack.js
├── .github/workflows/ci.yml
├── Jenkinsfile
└── sonar-project.properties
```

`frontend/public/vite.svg` wird in `frontend/index.html` als Favicon referenziert. Der HTML-Titel ist `Vite + React`.

---

## Laufzeit- und Schichtenstruktur

```text
index.html
  └── src/main.jsx
        └── OidcAuthProvider
              └── App.jsx
                    └── BandProvider
                          ├── Header          globale Navigation, Band-Auswahl, Auth
                          └── PageContent     Offset unter fixer AppBar
                                └── Routen
                                      ├── Home
                                      ├── ImportPage     → converter + songs API
                                      ├── EditorPage     → songs API
                                      │     └── SongTextArea speichert via songs API (Callback)
                                      ├── SetlistPage    → songs API + setlists API
                                      ├── BandPage       → members + invitations API
                                      └── InvitePage     → accept invitation API
```

Praktische Schichten im aktuellen Code:

1. **Routing / Shell** — `main.jsx`, `App.jsx`, `Header`, `PageContent`
2. **Seiten** — laden Daten, halten lokalen UI-State, orchestrieren Features
3. **UI-Komponenten** — Darstellung und Interaktion; Speichern im Editor läuft über Callbacks der Seite
4. **API-Client** — `src/api/` kapselt `fetch` für Songs und Setlists (Token, JSON, Fehlerarten)
5. **Konvertierung** — `src/converter/*`, unabhängig von React

Die Schichtung ist konventionell, nicht durch Module-Grenzen oder Dependency-Injection erzwungen.

---

## Routing

`App.jsx` verwendet `BrowserRouter` und die folgenden Routen:

| Pfad | Seite | Navigation im Header |
|---|---|---|
| `/` | `Home` | Home |
| `/import` | `ImportPage` | Import (nur bei aktiver Band) |
| `/editor` | `EditorPage` | Editor (nur bei aktiver Band) |
| `/setlist` | `SetlistPage` | Sets (nur bei aktiver Band) |
| `/band` | `BandPage` | Band (nur OWNER/ADMIN) |
| `/invite/:token` | `InvitePage` | kein Header-Link |

Import, Editor, Setlists und die Bandverwaltung erfordern Anmeldung und eine aktive Band.
`/invite/:token` erhält den Einladungskontext über Login hinweg (`sessionStorage`).
Nach dem OIDC-Callback navigiert `PendingInviteRedirect` per React Router
zurück nach `/invite/:token`; `InvitePage` nimmt die Einladung an.
Ohne Login erscheint der bestehende Anmeldeweg; es gibt kein Fallback auf IndexedDB.

`Header` ist eine fixe MUI-`AppBar`. `PageContent` setzt `pt: 8`, damit Inhalte nicht unter der AppBar liegen. Rechts in der AppBar zeigt `AuthStatus` optional Anmelden/Abmelden und den OIDC-`preferred_username` bzw. `name` (sonst `Angemeldet`). Die interne User-UUID erscheint nicht in der UI; `/api/me` bleibt der Mapping-Aufruf. Angemeldete User sehen zusätzlich `BandSelector`: Bandliste, aktive Band und Dialog zum Anlegen. Ohne Anmeldung gibt es keinen Band-Kontext.

---

## Authentifizierung und globale User-Identität

Keycloak ist der ausgewählte Identity Provider. Wo Keycloak läuft, ist eine
Umgebungsentscheidung, keine zweite Anwendungsarchitektur:

- lokale Entwicklung/Integration: Keycloak in Docker Compose
  (`http://localhost:8081`, Realm `my-songbook`)
- später Produktion bzw. bestehendes Setup: externes Keycloak
  (z. B. `login.docfaust.de`)

Frontend und Backend hängen nur an Standard-OIDC/OAuth2/JWT-Konfiguration
(`VITE_OIDC_ISSUER`, `VITE_OIDC_CLIENT_ID`, `KEYCLOAK_ISSUER_URI`). Es gibt
keine lokale-Keycloak-spezifische Geschäftslogik.

Keycloak authentifiziert; Spring Boot validiert JWT-Access-Tokens und mappt
die externe Identität auf einen globalen My Songbook User in PostgreSQL.

**Lokales Compose-Keycloak**

- Image `quay.io/keycloak/keycloak:26.7.2`, `start-dev`, Import von
  `keycloak/realm-my-songbook.json`
- öffentlicher SPA-Client `my-songbook-spa` (Authorization Code + PKCE, kein Secret)
- Redirect/Post-Logout/Web Origin: `http://localhost:5173`
- Issuer in Tokens und Discovery: `http://localhost:8081/realms/my-songbook`
- Backend-Container holt JWKS über den Compose-Dienstnamen
  (`http://keycloak:8080/.../certs`) und prüft weiterhin denselben Issuer.
  Issuer-Validierung bleibt aktiv.
- lokaler Testbenutzer `local-dev` nur für diese Umgebung; das Passwort steht
  nicht in der Realm-Datei, sondern setzt Compose nach dem Import aus
  `LOCAL_KEYCLOAK_TEST_PASSWORD`

**Frontend**

- Compose-Service `frontend`: Multi-Stage-Image (Node 22 baut Vite, nginx 1.28
  liefert `dist/`). Host-Port `5173` bleibt die browserseitige SPA-Origin, damit
  Keycloak-Redirects und CORS unverändert bleiben.
- nginx: Client-Routen fallen auf `index.html` zurück; `/api/...` wird intern an
  den Compose-Dienst `backend:8080` weitergereicht (Authorization-Header bleiben
  erhalten). Der Browser spricht keine Docker-Dienstnamen an.
- `react-oidc-context` mit öffentlicher SPA-Client-Konfiguration
  (`frontend/.env.example` für beliebige Issuer, `frontend/.env.local.example` für den optionalen
  Vite-Dev-Server gegen Compose)
- `OidcAuthProvider` in `main.jsx`; ohne Konfiguration bleibt die App ohne Login sichtbar, der Musikworkflow ist dann nicht nutzbar
- Nach Anmeldung: Access-Token an `GET /api/me` und `GET /api/bands`
  (`VITE_API_BASE_URL`; im Frontend-Image leer = relative `/api/...`; Vite-Dev
  Standard `http://localhost:8080`)

**Backend**

- Spring Security OAuth2 Resource Server (`KEYCLOAK_ISSUER_URI`; in Compose
  zusätzlich `jwk-set-uri` für die erreichbare JWKS-URL im Container-Netz)
- CORS für die SPA über `FRONTEND_ORIGIN` (Standard `http://localhost:5173`; kein `*` mit Credentials; erlaubt `GET`, `POST`, `PUT` und `DELETE`)
- Geschützt: `/api/me`, `/api/bands`, `/api/bands/{bandId}/songs`, `/api/bands/{bandId}/setlists` und alle weiteren Endpunkte außer Actuator-Health
- User-Tabelle `users` (interne UUID + stabiler Keycloak-`sub` als `external_subject`)
- Erster authentifizierter API-Zugriff legt den User per `INSERT ... ON CONFLICT` an; spätere Logins nutzen denselben Datensatz
- Band-Tabelle `bands` und Membership-Tabelle `memberships` (genau eine Membership je User und Band; Rolle nur `OWNER`/`ADMIN`/`MEMBER`/`GUEST`)
- Song-Tabelle `songs` (Band-FK, ChordPro-`content`, ganzzahlige `version` für Optimistic Locking)
- Setlist-Tabellen `setlists` und `setlist_entries` (Band-FK, geordnete Song-Verweise, ganzzahlige `version` für Optimistic Locking)
- `POST /api/bands` legt atomar Band plus OWNER-Membership des aktuellen Users an (User-ID kommt aus dem JWT, nicht vom Frontend)
- `GET /api/bands` listet nur Bands, in denen der aktuelle User eine Membership hat, inklusive der eigenen Rolle
- Es gibt kein `GET /api/bands/{id}`; eine bekannte Band-UUID allein gewährt keinen Zugriff
- Songs API ist band-scoped unter `/api/bands/{bandId}/songs`. User und Rolle kommen aus JWT plus serverseitiger Membership, nicht aus dem Request-Body.
- Setlists API ist band-scoped unter `/api/bands/{bandId}/setlists`. User und Rolle kommen aus JWT plus serverseitiger Membership, nicht aus dem Request-Body.

Die aktive Band ist ein Frontend-Nutzungskontext (`BandProvider`, React Context). Die zuletzt gewählte Band-ID kann in `localStorage` liegen. Songs und Setlists gehören immer zur aktiven Band und werden über `/api/bands/{activeBandId}/...` geladen. Beim Bandwechsel wird der Music-UI-State verworfen. Ohne aktive Band gibt es keinen Music-Workflow. Es gibt keinen Offline-Cache.

OWNER und ADMIN erzeugen einmalige Einladungslinks (14 Tage, nur Hash in der
Datenbank). Die Annahme erzeugt eine GUEST-Membership oder belässt eine
bestehende Rolle. OWNER und ADMIN ändern Rollen zwischen ADMIN/MEMBER/GUEST
und entfernen Nicht-OWNER. OWNER ist unveränderlich. Ownership-Übertragung
und freiwilliges Verlassen sind nicht implementiert. Keycloak bleibt
ausschließlich Authentifizierung; Band-Rollen liegen nicht im Identity Provider.

### Einladungen und Mitglieder

Band-scoped REST unter `/api/bands/{bandId}/invitations` und
`/api/bands/{bandId}/members`. Annahme über `POST /api/invitations/{token}/accept`.
Der Roh-Token wird genau einmal bei der Erzeugung zurückgegeben und ist Teil
der Einladungs-URL. Persistiert wird nur der SHA-256-Hash.

| Methode | Pfad | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|---|
| `POST` | `/api/bands/{bandId}/invitations` | erzeugen | erzeugen | 403 | 403 |
| `GET` | `/api/bands/{bandId}/invitations` | lesen | lesen | 403 | 403 |
| `DELETE` | `/api/bands/{bandId}/invitations/{invitationId}` | zurückziehen | zurückziehen | 403 | 403 |
| `POST` | `/api/invitations/{token}/accept` | annehmen | annehmen | annehmen | annehmen |
| `GET` | `/api/bands/{bandId}/members` | lesen | lesen | lesen | lesen |
| `PUT` | `/api/bands/{bandId}/members/{userId}/role` | ADMIN/MEMBER/GUEST | ADMIN/MEMBER/GUEST | 403 | 403 |
| `DELETE` | `/api/bands/{bandId}/members/{userId}` | ohne OWNER | ohne OWNER | 403 | 403 |

Ohne Membership antwortet die Band-scoped API mit 404. Unbekannte Tokens
liefern 404, abgelaufene Einladungen 410, bereits verbrauchte 409.
Nicht-Mitglieder können `accept` mit einem gültigen Token ausführen; sie
werden dadurch Mitglied. Cross-Band-IDs werden immer gegen `bandId` im Pfad
geprüft. `displayName` in der Mitgliederliste ist derzeit die User-UUID;
es gibt keine zusätzlichen Profilfelder.

### Songs API

Band-scoped REST unter `/api/bands/{bandId}/songs`. Jeder Server-Song gehört zu genau einer Band. Cross-Band-Zugriff anhand einer bekannten Song-UUID ist nicht möglich: Repository-Zugriffe filtern immer nach `band_id` und Song-ID. Ohne Membership antwortet die API mit 404, damit fremde Bands nicht unterscheidbar werden.

| Methode | Pfad | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|---|
| `GET` | `/api/bands/{bandId}/songs` | lesen | lesen | lesen | lesen |
| `GET` | `/api/bands/{bandId}/songs/{songId}` | lesen | lesen | lesen | lesen |
| `POST` | `/api/bands/{bandId}/songs` | anlegen | anlegen | anlegen | 403 |
| `PUT` | `/api/bands/{bandId}/songs/{songId}` | aktualisieren | aktualisieren | aktualisieren | 403 |
| `DELETE` | `/api/bands/{bandId}/songs/{songId}?version={n}` | löschen | löschen | 403 | 403 |

Create-Body: `title`, `artist`, `content`. Update-Body zusätzlich `version` (erwartete Version). `bandId`, User-ID und Rolle im Body sind keine Autorität.

Neue Songs starten bei `version = 0`. Ein erfolgreiches Update setzt Felder nur, wenn ID, `band_id` und erwartete Version übereinstimmen, und erhöht `version`. Stale Writes (Update oder Delete mit veralteter Version) liefern **409 Conflict** (`{"error":"stale version"}`) und ändern den Serverzustand nicht. Delete ist hart (kein Soft Delete) und verlangt die aktuelle Version als Query-Parameter. Erfolgreiches Delete liefert **204 No Content**.

Persönliche Song-Notizen existieren serverseitig noch nicht. Ein Song-Delete entfernt die Song-Zeile und alle `setlist_entries`, die auf diesen Song verweisen (`ON DELETE CASCADE`). Die Setlists selbst bleiben. Delete wird nicht blockiert, nur weil ein Song in einer Setlist vorkommt.

### Setlists API

Band-scoped REST unter `/api/bands/{bandId}/setlists`. Jede Server-Setlist gehört zu genau einer Band und darf nur Songs derselben Band referenzieren. Cross-Band-Zugriff anhand einer bekannten Setlist-UUID ist nicht möglich: Repository-Zugriffe filtern immer nach `band_id` und Setlist-ID. Ohne Membership antwortet die API mit 404, damit fremde Bands nicht unterscheidbar werden. Ein Song einer anderen Band in `songIds` wird ebenfalls als 404 behandelt.

| Methode | Pfad | OWNER | ADMIN | MEMBER | GUEST |
|---|---|---|---|---|---|
| `GET` | `/api/bands/{bandId}/setlists` | lesen | lesen | lesen | lesen |
| `GET` | `/api/bands/{bandId}/setlists/{setlistId}` | lesen | lesen | lesen | lesen |
| `POST` | `/api/bands/{bandId}/setlists` | anlegen | anlegen | anlegen | 403 |
| `PUT` | `/api/bands/{bandId}/setlists/{setlistId}` | aktualisieren | aktualisieren | aktualisieren | 403 |
| `DELETE` | `/api/bands/{bandId}/setlists/{setlistId}?version={n}` | löschen | löschen | 403 | 403 |

Create-Body: `name`, `songIds` (geordnete UUID-Liste; Duplikate bleiben Duplikate; leer ist zulässig). Update-Body zusätzlich `version` (erwartete Version). `bandId`, User-ID und Rolle im Body sind keine Autorität. Die Array-Reihenfolge ist die kanonische Setlist-Reihenfolge; Positionen werden als `0, 1, 2, …` gespeichert.

Neue Setlists starten bei `version = 0`. Ein erfolgreiches Update setzt Name und Einträge nur, wenn ID, `band_id` und erwartete Version übereinstimmen, und erhöht `version`. Stale Writes (Update oder Delete mit veralteter Version) liefern **409 Conflict** (`{"error":"stale version"}`) und ändern den Serverzustand nicht. Delete ist hart (kein Soft Delete) und verlangt die aktuelle Version als Query-Parameter. Erfolgreiches Delete liefert **204 No Content** und entfernt die Einträge der Setlist.

Die Antwort enthält `id`, `bandId`, `name`, `songIds` (Reihenfolge und Duplikate bleiben) und `version`. Song-Inhalte sind nicht eingebettet.

Die React-Seiten Import, Editor und Setlists nutzen diese API über `src/api/`. IndexedDB ist dafür nicht mehr maßgeblich.

---

## Pages

### Home (`/`)

Statische Willkommensseite ohne Datenzugriff.

### ImportPage (`/import`)

- Formular: Titel, Artist, mehrzeiliger Rohtext
- Button `Konvertieren & Speichern` ist deaktiviert, solange der Text leer ist
- Konvertierung über `convertToChordPro` aus `src/converter/convertToChordPro.js`
- Speichert einen neuen Song via `POST /api/bands/{activeBandId}/songs`
- Die Song-ID kommt vom Backend
- Feedback: Erfolgs- oder Fehlermeldung, danach werden die Felder nur nach Erfolg geleert

`capo` und `key` kann der Converter entgegennehmen; die Seite übergibt sie nicht.

Der ältere Converter `src/utils/ugToChordPro.js` und die Komponente `ImportButton` werden hier nicht verwendet (im Quelltext explizit als entfernt markiert).

### EditorPage (`/editor`)

Drei-Spalten-Layout:

- links: `SongSideBar` (Songliste + `New`)
- mitte: `SongTextArea` (ChordPro-Text, Speichern)
- rechts: `SongViewer` → `ChordProViewer` (Live-Vorschau)

Beim Mount (mit aktiver Band): `GET /api/bands/{activeBandId}/songs`. Auswahl setzt `selectedSong` und `editedText`. `New` öffnet einen ungespeicherten Entwurf ohne ID. Persistenz erfolgt erst über Speichern: neuer Song per `POST`, bestehende Songs per `PUT` mit `title`, `artist`, `content` und `version`. Die Songliste verwendet `song.id`. Nach erfolgreichem Speichern ersetzt die Seite den Song im State durch die Serverantwort inklusive neuer `version`. Ein HTTP 409 zeigt Konfliktfeedback und überschreibt den Editortext nicht still.

### SetlistPage (`/setlist`)

- links: neue Setlist anlegen oder gespeicherte laden, Songs hinzufügen/entfernen (inkl. Duplikate), Reihenfolge per Hoch/Runter, speichern; gespeicherte Setlists auflisten und löschen
- rechts: Preview der aktuell zusammengestellten Songs via `SongViewer`

Beim Mount (mit aktiver Band): `GET /api/bands/{activeBandId}/songs` und `GET /api/bands/{activeBandId}/setlists`. Speichern erzeugt per `POST` oder aktualisiert per `PUT` mit `name`, `songIds` und `version`. Die Array-Reihenfolge ist maßgeblich. Dieselbe Song-ID darf mehrfach vorkommen. Löschen sendet `DELETE` mit erwarteter `version`. Ein HTTP 409 zeigt Konfliktfeedback.

### BandPage (`/band`)

Mitgliederliste der aktiven Band. OWNER/ADMIN können Rollen zwischen ADMIN,
MEMBER und GUEST ändern, Nicht-OWNER entfernen und Einladungslinks erzeugen
bzw. zurückziehen. OWNER erscheint nicht editierbar.

### InvitePage (`/invite/:token`)

Ohne Anmeldung: speichert den Token und startet den bestehenden OIDC-Login.
Nach der Anmeldung: `POST /api/invitations/{token}/accept`, aktiviert die
beigetretene Band und navigiert zum Editor.

---

## Wichtige Komponenten

Aktiver UI-Pfad:

| Komponente | Rolle |
|---|---|
| `Header` | Fixe Navigation: Home immer; Editor/Sets/Import nur bei aktiver Band; Band für OWNER/ADMIN; Band-Auswahl für angemeldete User |
| `BandSelector` | Aktive Band, Bandwechsel, Dialog „Band anlegen“ |
| `MusicWorkflowGate` | Login-/Band-Empty-States für Import, Editor, Setlists und Bandverwaltung |
| `PageContent` | Seiten-Wrapper unter der AppBar |
| `SongSideBar` | Songliste; zeigt `title` und `artist \|\| author` |
| `SongTextArea` | Editor + Speichern; Titelanzeige `title \|\| name` |
| `SongViewer` | Wrapper mit Überschrift „Vorschau“ |
| `ChordProViewer` | ChordPro → HTML |

Im Repository vorhanden, aber **nicht** von `App.jsx` oder den aktiven Seiten importiert:

- `SongList.jsx`
- `SongDetail.jsx`
- `InputArea.jsx`
- `ImportButton.jsx`
- `SongEditorLayout.jsx`
- `SongEditor/index.jsx`

Diese Dateien sind in der Coverage-Konfiguration von Vite und Sonar ausgeschlossen. `SongDetail.jsx` importiert `./ChordProViewer/ChordProViewer.jsx` (existiert nicht; der Viewer liegt unter `ChordProViewer/index.jsx`) und spricht IndexedDB direkt über `initDB()` an. Das ist kein aktiver Workflow.

---

## State Management

Es gibt keinen gemeinsamen Application Store für Songs und Setlists.

Jede Musik-Seite hält eigenen State mit `useState` / `useEffect`. Songs und Setlists werden **pro Seiten-Mount** und bei Wechsel der aktiven Band aus der API geladen. Ein Wechsel der Route verwirft den Seiten-State.

`SongTextArea` besitzt zusätzlich lokalen Snackbar-State.

Für die aktive Band gibt es einen schmalen React Context (`BandProvider` in `App.jsx`). Er lädt nach der Anmeldung `GET /api/bands` und merkt sich die Auswahl lokal. Alle Music-API-Aufrufe nutzen `activeBand.id`.

---

## Datenflüsse

### Import

1. Nutzer gibt Titel, Artist und Rohtext ein.
2. `convertToChordPro({ title, artist, input })` erzeugt ChordPro.
3. `POST /api/bands/{activeBandId}/songs` mit `{ title, artist, content }`.
4. Der Song erscheint im Editor/in Setlists nach erneutem Laden der jeweiligen Seite.

### Editor

1. `GET /api/bands/{activeBandId}/songs` füllt die Sidebar.
2. Auswahl kopiert `song.content` nach `editedText`.
3. Jede Textänderung aktualisiert die Vorschau synchron.
4. Speichern: Entwurf per `POST`, bestehender Song per `PUT` mit aktueller `version`.
5. Leerer Text wird in der UI abgelehnt und nicht geschrieben.
6. HTTP 409 zeigt Konfliktfeedback; der Editortext bleibt bis zum expliziten Reload erhalten.

### Setlist

1. `GET /api/bands/{activeBandId}/songs` und `GET /api/bands/{activeBandId}/setlists`.
2. Ausgewählte IDs werden lokal gehalten; Duplikate bleiben Duplikate.
3. `POST` bzw. `PUT` persistiert Name + `songIds` in UI-Reihenfolge plus `version` beim Update.
4. Preview mappt `songIds` auf Songs derselben Band und zeigt fehlende IDs defensiv.
5. `DELETE` mit erwarteter `version` entfernt die Setlist; Songs bleiben unverändert.

Es gibt keine Song-Löschfunktion in der UI.

---

## Persistenz (API)

Kapselung: `src/api/apiClient.js` plus `songsApi.js` / `setlistsApi.js` /
`invitationsApi.js` / `membershipsApi.js`.

Der Client sendet den OIDC-Access-Token, arbeitet JSON und unterscheidet mindestens 401, 403, 404, 409, 410 sowie Netzwerk-/Serverfehler.

`src/db.js` / IndexedDB ist **nicht** mehr die Quelle der Wahrheit für den Musikworkflow. Import, Editor, `SongTextArea` und Setlists rufen IndexedDB nicht auf. Die Datei bleibt vorerst für Tests und ungenutzte Legacy-Komponenten.

### Aktuelles Datenmodell

Die persistierten PostgreSQL-Strukturen für User, Band, Membership, Song und Setlist sind in `docs/current-data-model.md` beschrieben.
Dieser Abschnitt fasst den Frontend-Ist-Zustand des React-Musikworkflows zusammen.

Es gibt keine zentrale Modell- oder Validierungsschicht jenseits der API-Verträge.

### Song (Schreibpfad Import + Editor)

```text
{
  id: string,       // UUID vom Backend
  bandId: string,
  title: string,
  artist: string,
  content: string,  // ChordPro
  version: number
}
```

Import setzt `title` auf `"Unbenannt"`, wenn leer. Der Editor-Entwurf verwendet `"Neuer Song"` und wird erst beim ersten Speichern per `POST` angelegt.

Anzeige-Fallbacks im UI-Code deuten auf ältere Feldnamen hin:

- Titel: `title` oder `name` (`SongTextArea`)
- Artist: `artist` oder `author` (`SongSideBar`)
- Setlist-Anzeige: nur `title`, sonst Song-ID

`createdAt` / `updatedAt` werden nicht geschrieben.

### Setlist

```text
{
  id: string,        // UUID vom Backend
  bandId: string,
  name: string,
  songIds: string[], // Referenzen auf Song.id; Reihenfolge und Duplikate bleiben
  version: number
}
```

`songIds` können theoretisch auf nicht mehr vorhandene Songs zeigen. Die Preview behandelt das defensiv.

---

## ChordPro-Konvertierung

Aktiver Produktionsconverter: `src/converter/`.

| Datei | Aufgabe |
|---|---|
| `convertToChordPro.js` | Orchestrierung, Merge, Header |
| `chords.js` | Akkordzeilen-Erkennung |
| `sections.js` | Abschnittslabels → ChordPro-Direktiven |

Ablauf von `convertToChordPro({ title, artist, capo, key, input })`:

1. Header: `{title}`, `{artist}`, optional `{capo}` (1–11), optional `{key}` (Pattern inkl. `H`)
2. Zeilenweise Verarbeitung mit Akkord-Puffer
3. Akkordzeile + folgende Textzeile → positionsbasiertes `[Akkord]` im Text
4. Aufeinanderfolgende Akkordzeilen oder Akkorde vor Leerzeile → reine Chord-Zeile `[C] [G]`
5. Labels wie `[Chorus]`, `[Verse 1]`, `[Intro]`:
   - chorus/refrain → `{soc: …}`
   - verse/strophe/vers → `{sov: …}`
   - sonst → `{c: …}`

Die Logik ist deterministisch, UI-frei und durch Unit-Tests abgedeckt.

`src/utils/ugToChordPro.js` ist ein älterer, getesteter Converter (u. a. `[ch]…[/ch]`). **Kein aktiver UI- oder Import-Pfad** verwendet ihn.

---

## ChordPro-Rendering

Kette: `SongViewer` → `ChordProViewer`.

`ChordProViewer`:

1. Leerer Text → Hinweis „Kein ChordPro Text“
2. sonst `ChordProParser` + `HtmlTableFormatter` aus `chordsheetjs`
3. HTML per `dangerouslySetInnerHTML`
4. Parse-Fehler → rote Meldung `Fehler: …`

Parsing läuft synchron im UI-Thread, memoisiert über `useMemo` auf `chordProText`.

`HtmlDivFormatter` wird importiert, aber nicht verwendet (auskommentierte Alternative). Darstellung von Akkorden, Chorus, Verse und Kommentaren steuert `src/components/ChordProViewer/styles.css` über die von `chordsheetjs` erzeugten CSS-Klassen.

---

## Tests

Vitest mit `globals: true`, Umgebung `jsdom`, Setup `src/setupTests.js` (`@testing-library/jest-dom`).

Abgedeckte Bereiche:

| Bereich | Testdateien |
|---|---|
| App / DB | `src/__tests__/App.test.jsx`, `src/__tests__/db.test.js` |
| Auth | `src/auth/__tests__/AuthStatus.test.jsx` |
| Band | `src/band/__tests__/*` |
| Pages | Home, EditorPage, ImportPage, SetlistPage, BandPage, InvitePage |
| API-Client | `src/api/__tests__/*` |
| Komponenten | Header, SongSideBar, SongTextArea, SongViewer, ChordProViewer, MusicWorkflowGate |
| Converter | `convertToChordPro`, `chords`, `sections` |
| Legacy-Utils | `ugToChordPro` |

DB-Tests mocken `idb`. UI-Tests der Music-Workflows mocken die Songs-/Setlists-API, nicht IndexedDB. Coverage-Schwellen in `vite.config.js`: 80 % (lines, functions, branches, statements). Ungenutzte Komponenten sind von der Coverage ausgenommen.

Befehle (in `frontend/`): `npm test` (Watch), `npm run test:ci` (einmalig plus Coverage).

---

## Build, Entwicklung und Qualitätssicherung

| Skript | Zweck |
|---|---|
| `npm run dev` | Vite-Dev-Server (in `frontend/`) |
| `npm run build` | Produktions-Build nach `frontend/dist/` |
| `npm run preview` | lokalen Build ausliefern |
| `npm run lint` | ESLint |
| `npm run test` / `test:ci` | Vitest |
| `npm run verify:local-stack` | Compose-Smoke: Keycloak-Discovery, Backend-Readiness, Frontend, `/api`-Proxy |
| `npm run owasp` | OWASP Dependency-Check |

Die App wird als Client-SPA gebaut; es gibt keinen SSR-Einstieg. Lokal liefert
der Frontend-Container das Produktionsbundle per nginx. `frontend/vite.config.js` enthält
dennoch `ssr.noExternal` für MUI-Pakete und einen Alias für `react-transition-group`.

CI:

- GitHub Actions (`.github/workflows/ci.yml`): Node 22 in `frontend/`, `npm ci --ignore-scripts`, Lint, Tests mit Coverage, Build, SonarCloud, npm audit, OWASP
- Jenkins (`Jenkinsfile`): Tests, Build, Lint, Dependency-Check, npm audit in `frontend/`; cron `H 8 * * *`
- Dependabot: wöchentlich npm (`frontend/`), Gradle (`backend/`) und GitHub Actions
- Sonar: `sonar-project.properties`, Coverage aus `frontend/coverage/lcov.info`

---

## Abweichungen zur bestehenden Dokumentation

Wo Dokumentation und Sourcecode auseinanderlaufen, gilt für den CURRENT-State der Sourcecode.

| Quelle | Aussage | Ist im Code |
|---|---|---|
| `AGENTS.md` | `docs/architecture.md` sei die aktuelle Architektur | Dieses Dokument beschreibt den Ist-Zustand; `architecture.md` existiert parallel und enthält zusätzlich längerfristige Hinweise |
| `docs/architecture.md` | ungenutzte Komponenten: SongList, SongDetail, InputArea, ImportButton | zusätzlich ungenutzt: `SongEditor`, `SongEditorLayout`, `ugToChordPro` |
| `docs/converter.md` / Import-Kommentare | optionale `capo`/`key`-Übergabe | Converter kann das; `ImportPage` übergibt beides nicht |
| `docs/product-vision.md` | Offline-Verfügbarkeit, Multi-Band, Auth, persönliche Notizen | TARGET-Dokument; im Code nicht vorhanden |

---

## Technische Auffälligkeiten

Fakten, die vom Kern der Architektur abweichen oder sie erschweren — keine Empfehlungen:

- Import-UI und README sprechen von Ultimate-Guitar-Text; verdrahtet ist `src/converter/convertToChordPro.js`, nicht `ugToChordPro`.
- Zwei Converter existieren; nur `src/converter` ist an die UI angebunden.
- Feldnamen für Titel/Artist sind nicht einheitlich (`title`/`name`, `artist`/`author`). Aktive Schreibpfade nutzen `title`/`artist`.
- Editor-`New` und Speichern sind entkoppelt: ungespeicherte Entwürfe existieren nur im Speicher der Seite, bis der erste `POST` erfolgt.
- Mehrere Komponenten liegen tot im Baum; `SongDetail.jsx` ist intern inkonsistent zum aktuellen Viewer.
- Produktname in der UI (`SongManager`) und Repository-Name (`my-songbook`) stimmen nicht überein.
