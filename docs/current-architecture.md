# Current Architecture

## Status

CURRENT

Dieses Dokument beschreibt den **tatsächlich implementierten Ist-Zustand** der Anwendung, soweit er im Repository verifizierbar ist.

Es enthält keine Zielarchitektur, keine Migrationspläne und keine Produktvision.

Nicht vorhanden und daher **keine** bestehende Architektur:

- Anbindung von Editor, Import und Setlists an die Songs- und Setlists-API
- Band-Rollenverwaltung, Einladungen oder Ownership-Übertragung
- Synchronisation zwischen Geräten oder Nutzern
- globales State-Management (Redux, Zustand, MobX)

Unter `backend/` existiert ein Spring-Boot-Service (Java 25, Gradle Kotlin DSL,
Wurzelpaket `de.docfaust.mysongbook`) mit Actuator-Liveness/Readiness,
OAuth2-Resource-Server (JWT von Keycloak) und Persistenz in PostgreSQL über
Spring Data JPA / Hibernate für globale User, Bands, Memberships, Songs und
Setlists. Flyway bleibt Schema-Owner (`ddl-auto=validate`). Docker Compose startet Backend,
PostgreSQL 18 und ein lokales Keycloak für Entwicklung/Integrationstests. Flyway wendet Infrastruktur-, User-, Band-,
Song- und Setlist-Migrationen an. Die React-SPA kann optional per Keycloak anmelden, ruft
`GET /api/me` auf und kann Bands anlegen sowie die aktive Band wählen. Es gibt
eine band-scoped Songs API und eine band-scoped Setlists API mit Membership-Prüfungen
und Optimistic Locking.
Editor, Import und Setlists bleiben in IndexedDB, sind ohne Login nutzbar und
gehören **nicht** zur ausgewählten Band. Die aktive Band filtert lokale Songs
nicht. Ein externes Keycloak (z. B. `login.docfaust.de`) bleibt unberührt und
ist dieselbe OIDC/JWT-Anbindung mit anderen Runtime-URLs, keine zweite
Auth-Architektur.

---

## Anwendungsüberblick

`my-songbook` ist eine clientseitige Single-Page-Anwendung (SPA).

Sie läuft als React-SPA im Browser. Import, Editor und Setlists persistieren
lokal in IndexedDB. User, Band, Membership, Song und Setlist liegen zusätzlich im
Spring-Boot-Backend in PostgreSQL (Spring Data JPA / Hibernate + Flyway).

Die sichtbare Anwendung heißt in der UI **SongManager** (`Header`, `Home`). Repository, `package.json` und README verwenden den Namen **my-songbook**.

---

## Technologiestack

| Bereich | Implementierung |
|---|---|
| UI | React 19 (JavaScript/JSX, kein TypeScript im Anwendungscode) |
| Build / Dev | Vite 8, Plugin `@vitejs/plugin-react` |
| Routing | `react-router-dom` 7 (`BrowserRouter`) |
| UI-Bibliothek | Material UI 9 (`@mui/material`) plus Emotion |
| ChordPro-Rendering | `chordsheetjs` (`ChordProParser`, `HtmlTableFormatter`) |
| Persistenz | IndexedDB über `idb` (maßgeblich für den React-Musikworkflow); PostgreSQL über Spring Data JPA / Hibernate + Flyway für User, Band, Membership, Song, Setlist |
| IDs | `crypto.randomUUID()` für Songs, `uuid` v4 für Setlists; UUID für User/Band im Backend |
| Tests | Vitest 4, Testing Library, jsdom; Backend: JUnit + Testcontainers PostgreSQL 18 |
| Backend | Spring Boot 4.1 unter `backend/` (Java 25, Gradle Wrapper, Kotlin DSL), Wurzelpaket `de.docfaust.mysongbook`, Spring Data JPA / Hibernate + Flyway, OAuth2 Resource Server |
| Authentifizierung | Keycloak als Identity Provider; lokal in Compose oder extern über dieselben OIDC/JWT-Einstellungen; `react-oidc-context` im Frontend |
| Runtime | Docker Compose: `backend` + `postgres:18` + `keycloak` |
| Lint | ESLint 10 |

Es gibt keinen `ThemeProvider` und keine eigene MUI-Theme-Konfiguration. Komponenten nutzen die MUI-Defaults und überwiegend `sx`-Props.

---

## Projekt- und Verzeichnisstruktur

Relevante Teile des Repositories:

```text
my-songbook/
├── index.html                 Einstieg HTML (Mount-Punkt #root)
├── public/vite.svg            Favicon
├── src/
│   ├── main.jsx               React-Bootstrap (StrictMode)
│   ├── App.jsx                Router, Header, Routen
│   ├── auth/                  OIDC-Login (Keycloak), /api/me-Aufruf
│   ├── band/                  aktiver Band-Kontext (Auswahl, Anlegen)
│   ├── db.js                  IndexedDB-Zugriff
│   ├── index.css              globales Basis-CSS
│   ├── pages/                 Routen-Seiten
│   ├── components/            UI-Komponenten
│   ├── converter/             aktiver ChordPro-Converter
│   ├── utils/                 ugToChordPro (nicht im UI-Pfad)
│   └── __tests__/             App- und DB-Tests
├── docs/                      Projektdokumentation
├── backend/                   Spring Boot (Paket `de.docfaust.mysongbook`; Health, JPA, Flyway, Auth, User, Band, Song, Setlist)
├── .env.example               öffentliche OIDC-/API-Konfiguration (Vite)
├── .env.local.example         lokale Compose-Keycloak-Werte für Vite
├── compose.yaml               Backend + PostgreSQL 18 + Keycloak
├── keycloak/                  lokales Entwicklungs-Realm (Import)
├── scripts/owasp-check.sh
├── scripts/verify-local-stack.js
├── .github/workflows/ci.yml
├── Jenkinsfile
├── vite.config.js
├── eslint.config.js
└── sonar-project.properties
```

`public/vite.svg` wird in `index.html` als Favicon referenziert. Der HTML-Titel ist `Vite + React`.

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
                                      ├── ImportPage     → converter + db.addSongs
                                      ├── EditorPage     → db.getAllSongs
                                      │     └── SongTextArea speichert via db.addSongs
                                      └── SetlistPage    → db songs + setlists
```

Praktische Schichten im aktuellen Code:

1. **Routing / Shell** — `main.jsx`, `App.jsx`, `Header`, `PageContent`
2. **Seiten** — laden Daten, halten lokalen UI-State, orchestrieren Features
3. **UI-Komponenten** — Darstellung und Interaktion; `SongTextArea` schreibt selbst in die DB
4. **Persistenz** — `src/db.js` kapselt IndexedDB (`idb`)
5. **Konvertierung** — `src/converter/*`, unabhängig von React

Die Schichtung ist konventionell, nicht durch Module-Grenzen oder Dependency-Injection erzwungen.

---

## Routing

`App.jsx` verwendet `BrowserRouter` und vier Routen:

| Pfad | Seite | Navigation im Header |
|---|---|---|
| `/` | `Home` | Home |
| `/import` | `ImportPage` | Import |
| `/editor` | `EditorPage` | Editor |
| `/setlist` | `SetlistPage` | Sets |

Es gibt keine Nested Routes, keine Route-Parameter, keinen Catch-all und keinen Auth-Guard. Login ist optional; Import, Editor und Setlists funktionieren ohne Anmeldung.

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

- `react-oidc-context` mit öffentlicher SPA-Client-Konfiguration
  (`.env.example` für beliebige Issuer, `.env.local.example` für Compose)
- `OidcAuthProvider` in `main.jsx`; ohne Konfiguration bleibt die App ohne Login lauffähig
- Nach Anmeldung: Access-Token an `GET /api/me` und `GET /api/bands` (`VITE_API_BASE_URL`, Standard
  `http://localhost:8080`)

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

Die aktive Band ist ein Frontend-Nutzungskontext (`BandProvider`, React Context). Die zuletzt gewählte Band-ID kann in `localStorage` liegen. Songs und Setlists in IndexedDB werden nicht nach Band gefiltert und gehören nicht zur ausgewählten Band. Die Songs- und Setlists-API wird vom React-Musikworkflow noch nicht verwendet.

Rollenverwaltung, Einladungen und Ownership-Übertragung existieren noch nicht. Keycloak bleibt ausschließlich Authentifizierung; Band-Rollen liegen nicht im Identity Provider.

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

Die React-`SetlistPage` nutzt diese API noch nicht; IndexedDB bleibt für den UI-Workflow maßgeblich.

---

## Pages

### Home (`/`)

Statische Willkommensseite ohne Datenzugriff.

### ImportPage (`/import`)

- Formular: Titel, Artist, mehrzeiliger Rohtext
- Button `Konvertieren & Speichern` ist deaktiviert, solange der Text leer ist
- Konvertierung über `convertToChordPro` aus `src/converter/convertToChordPro.js`
- Speichert einen neuen Song via `addSongs([song])`
- Song-ID: `crypto.randomUUID()`
- Feedback: `alert("Song importiert!")`, danach werden die Felder geleert

`capo` und `key` kann der Converter entgegennehmen; die Seite übergibt sie nicht.

Der ältere Converter `src/utils/ugToChordPro.js` und die Komponente `ImportButton` werden hier nicht verwendet (im Quelltext explizit als entfernt markiert).

### EditorPage (`/editor`)

Drei-Spalten-Layout:

- links: `SongSideBar` (Songliste + `New`)
- mitte: `SongTextArea` (ChordPro-Text, Speichern)
- rechts: `SongViewer` → `ChordProViewer` (Live-Vorschau)

Beim Mount: `getAllSongs()`. Auswahl setzt `selectedSong` und `editedText`. `New` erzeugt einen Song nur im lokalen State (`title: "Neuer Song"`, leerer `content`) und persistiert ihn nicht. Persistenz erfolgt erst über `SongTextArea` → `addSongs`, und nur wenn der Text nicht leer ist.

Die Songliste wird nach dem Speichern nicht neu aus der DB geladen.

### SetlistPage (`/setlist`)

- links: neue Setlist anlegen, Songs hinzufügen/entfernen, speichern; gespeicherte Setlists auflisten und löschen
- rechts: Preview der **aktuell zusammengestellten** Songs via `SongViewer`

Beim Mount: `getAllSongs()` und `getSetlists()`. Speichern erzeugt `{ id: uuid(), name, songIds }` und schreibt per `saveSetlist`. Leerer Name bricht still ab. Gespeicherte Setlists können gelöscht, aber **nicht geladen, bearbeitet oder in der Preview angezeigt** werden.

`getSetlistById` existiert in `db.js`, wird von keiner Seite verwendet.

---

## Wichtige Komponenten

Aktiver UI-Pfad:

| Komponente | Rolle |
|---|---|
| `Header` | Fixe Navigation zu den vier Routen; Band-Auswahl für angemeldete User |
| `BandSelector` | Aktive Band, Bandwechsel, Dialog „Band anlegen“ |
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

Diese Dateien sind in der Coverage-Konfiguration von Vite und Sonar ausgeschlossen. `SongDetail.jsx` importiert `./ChordProViewer/ChordProViewer.jsx` (existiert nicht; der Viewer liegt unter `ChordProViewer/index.jsx`) und spricht IndexedDB direkt über `initDB()` an.

---

## State Management

Es gibt keinen gemeinsamen Application Store für Songs und Setlists.

Jede Musik-Seite hält eigenen State mit `useState` / `useEffect`. Songs und Setlists werden **pro Seiten-Mount** aus IndexedDB geladen. Ein Wechsel der Route verwirft den Seiten-State. Änderungen auf einer Seite sind auf einer anderen erst nach erneutem Laden sichtbar.

`SongTextArea` besitzt zusätzlich lokalen Snackbar-State.

Für die aktive Band gibt es einen schmalen React Context (`BandProvider` in `App.jsx`). Er lädt nach der Anmeldung `GET /api/bands`, merkt sich die Auswahl lokal und beeinflusst IndexedDB nicht.

---

## Datenflüsse

### Import

1. Nutzer gibt Titel, Artist und Rohtext ein.
2. `convertToChordPro({ title, artist, input })` erzeugt ChordPro.
3. Es entsteht `{ Id, type: 1, title, artist, content }`.
4. `addSongs([song])` schreibt nach IndexedDB.
5. Der Song erscheint im Editor/in Setlists nach erneutem Laden der jeweiligen Seite.

### Editor

1. `getAllSongs()` füllt die Sidebar.
2. Auswahl kopiert `song.content` nach `editedText`.
3. Jede Textänderung aktualisiert die Vorschau synchron.
4. Speichern: `addSongs([{ ...selectedSong, content: editedText }])` (Upsert über `Id`).
5. Leerer Text wird in der UI abgelehnt und nicht geschrieben.

### Setlist

1. `getAllSongs()` und `getSetlists()`.
2. Ausgewählte IDs werden lokal gehalten; Duplikate werden verhindert.
3. `saveSetlist` persistiert Name + `songIds`.
4. Preview mappt `songIds` auf Songs und filtert unauflösbare IDs mit `filter(Boolean)`.
5. `deleteSetlist(id)` entfernt die Setlist; Songs bleiben unverändert.

Es gibt keine Song-Löschfunktion in `db.js` und keine UI dafür.

---

## Persistenz (IndexedDB)

Kapselung: `src/db.js` über `idb.openDB`.

| Eigenschaft | Wert |
|---|---|
| Datenbankname | `SongbookDB` |
| Version | `2` |
| Store `songs` | KeyPath `Id` (seit Version 1) |
| Store `setlists` | KeyPath `id` (seit Version 2) |

Migration läuft im `upgrade`-Callback: fehlende Stores werden bei `oldVersion < 1` bzw. `< 2` angelegt. Es gibt keine Daten-Transformation bestehender Datensätze.

### API

| Funktion | Verhalten |
|---|---|
| `initDB()` | Öffnet/erstellt die DB |
| `addSongs(songs)` | `put` nur wenn `song.type === 1` **und** `song.content` truthy |
| `getAllSongs()` | alle Songs |
| `saveSetlist(setlist)` | Upsert |
| `getSetlists()` | alle Setlists |
| `getSetlistById(id)` | einzelne Setlist; ungenutzt in der UI |
| `deleteSetlist(id)` | Löschen einer Setlist |

`store.put` ist ein Upsert: gleiche `Id` / `id` überschreibt. Es gibt keine sekundären Indexes und keine referenzielle Integrität zwischen `setlists.songIds` und `songs.Id`.

Aktive Seiten und `SongTextArea` nutzen die exportierten Funktionen. Die ungenutzte Komponente `SongDetail` umgeht das und ruft `initDB().get('songs', songId)` direkt auf.

---

## Aktuelles Datenmodell

Die persistierten IndexedDB-Strukturen und das PostgreSQL-Schema für User, Band,
Membership, Song und Setlist sind in `docs/current-data-model.md` beschrieben.
Dieser Abschnitt fasst den IndexedDB-Ist-Zustand des React-Musikworkflows zusammen.
Server-Songs und Server-Setlists liegen zusätzlich in PostgreSQL und sind vom Editor
noch getrennt.

Es gibt keine zentrale Modell- oder Validierungsschicht. Die Struktur ergibt sich aus den Schreibpfaden und `db.js`.

### Song (Schreibpfad Import + Editor)

```text
{
  Id: string,       // crypto.randomUUID(), KeyPath
  type: 1,          // Pflicht für addSongs
  title: string,
  artist: string,
  content: string   // ChordPro; Pflicht (truthy) für addSongs
}
```

Import setzt `title` auf `"Unbenannt"`, wenn leer. Der Editor legt lokal `"Neuer Song"` an.

Anzeige-Fallbacks im UI-Code deuten auf ältere Feldnamen hin:

- Titel: `title` oder `name` (`SongTextArea`)
- Artist: `artist` oder `author` (`SongSideBar`)
- Setlist-Anzeige: nur `title`, sonst `Id`

`createdAt` / `updatedAt` werden nicht geschrieben.

### Setlist

```text
{
  id: string,        // uuid v4, KeyPath
  name: string,
  songIds: string[]  // Referenzen auf Song.Id
}
```

`songIds` können auf nicht mehr vorhandene Songs zeigen. Die Preview filtert solche Einträge.

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
| Pages | Home, EditorPage, ImportPage, SetlistPage |
| Komponenten | Header, SongSideBar, SongTextArea, SongViewer, ChordProViewer |
| Converter | `convertToChordPro`, `chords`, `sections` |
| Legacy-Utils | `ugToChordPro` |

DB-Tests mocken `idb`. UI-Tests mocken `src/db`. Coverage-Schwellen in `vite.config.js`: 80 % (lines, functions, branches, statements). Ungenutzte Komponenten sind von der Coverage ausgenommen.

Befehle: `npm test` (Watch), `npm run test:ci` (einmalig plus Coverage).

---

## Build, Entwicklung und Qualitätssicherung

| Skript | Zweck |
|---|---|
| `npm run dev` | Vite-Dev-Server |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm run preview` | lokalen Build ausliefern |
| `npm run lint` | ESLint |
| `npm run test` / `test:ci` | Vitest |
| `npm run verify:local-stack` | Compose-Smoke: Keycloak-Discovery + Backend-Readiness |
| `npm run owasp` | OWASP Dependency-Check |

Die App wird als Client-SPA gebaut; es gibt keinen SSR-Einstieg. `vite.config.js` enthält dennoch `ssr.noExternal` für MUI-Pakete und einen Alias für `react-transition-group`.

CI:

- GitHub Actions (`.github/workflows/ci.yml`): Node 22, `npm ci --ignore-scripts`, Lint, Tests mit Coverage, Build, SonarCloud, npm audit, OWASP
- Jenkins (`Jenkinsfile`): Tests, Build, Lint, Dependency-Check, npm audit; cron `H 8 * * *`
- Dependabot: wöchentlich npm, Gradle (`backend/`) und GitHub Actions
- Sonar: `sonar-project.properties`, Coverage aus `coverage/lcov.info`

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
- Song-IDs und Setlist-IDs werden mit unterschiedlichen Generatoren erzeugt.
- `type === 1` ist eine Speichervoraussetzung ohne weitere Typen im UI.
- Editor-`New` und Speichern sind entkoppelt: ungespeicherte neue Songs existieren nur im Speicher der Seite; nach Speichern wird die Sidebar-Liste nicht aus der DB aktualisiert.
- Gespeicherte Setlists sind in der UI nicht wieder ladbar.
- `getSetlistById` ist implementiert und getestet, aber ungenutzt.
- Mehrere Komponenten liegen tot im Baum; `SongDetail.jsx` ist intern inkonsistent zum aktuellen Viewer.
- Produktname in der UI (`SongManager`) und Repository-Name (`my-songbook`) stimmen nicht überein.
