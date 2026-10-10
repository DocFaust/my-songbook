# My Songbook

`my-songbook` ist eine React/Vite-Webanwendung zum Verwalten von Songs im ChordPro-Format.
Songs und Setlists gehören zu einer Band und werden über die Spring-Boot-API
in PostgreSQL gespeichert.

## Repository-Struktur

- `frontend/` — React, Vite, nginx-Image
- `backend/` — Spring Boot
- `compose.yaml` — lokaler Gesamtstack (Frontend, Backend, PostgreSQL, Keycloak)
- `compose.qa.yaml` — derselbe Stack fuer die QA-Umgebung auf rwf-devpi

## Funktionen auf einen Blick

- Import von Ultimate-Guitar-Texten mit Konvertierung nach ChordPro
- Song-Editor mit Live-Vorschau (ChordPro-Rendering)
- Verwaltung von Setlists fuer Auftritte
- Band-bezogener Musikworkflow nach Anmeldung (PostgreSQL über die API)
- Einladungslinks, Mitgliederverwaltung, Eigentumsübertragung und freiwilliges Verlassen einer Band

## Voraussetzungen

- Docker und Docker Compose fuer den lokalen Gesamtstack
- Node.js 22+ und npm 10+ nur fuer Tests, Lint oder den optionalen Vite-Dev-Server

## Installation und Start

Der primaere lokale Workflow startet die komplette Anwendung (Frontend,
Backend, PostgreSQL, Keycloak) in Docker Compose:

```bash
docker compose up -d --build
```

Danach ist die App im Browser unter `http://localhost:5173` erreichbar.
Ein separates `npm run dev` ist dafuer nicht noetig.

Import, Editor und Setlists erfordern Anmeldung und eine aktive Band.

## Lokale Integrationsumgebung (Frontend, Backend, PostgreSQL, Keycloak)

Fuer den echten Browser-Login ohne das externe Keycloak unter
`login.docfaust.de` startet Docker Compose ein lokales Keycloak. Das ist
dieselbe OIDC/JWT-Anbindung wie gegen ein externes Keycloak, nur mit
anderen Runtime-URLs.

**Nur lokale Development-/Test-Zugaenge. Nicht fuer Produktion verwenden.**

Lokale Entwicklungszugangsdaten, nicht fuer Produktion und nicht ausserhalb
dieser Compose-Umgebung verwenden:

- Keycloak Admin Console `http://localhost:8081`: `admin` / `admin`
- Realm `my-songbook`, Benutzer `local-dev`, Passwort aus
  `LOCAL_KEYCLOAK_TEST_PASSWORD` (Standard: derselbe lokale Wert wie der
  Benutzername)
- Realm `my-songbook`, Benutzer `user1` und `user2`, Passwort `test1234`

`local-dev` steht im Realm-Import ohne Passwortfeld. Compose setzt dieses
Testpasswort nach dem Start. `user1` und `user2` legt derselbe Realm-Import
mit festem Development-Passwort an (`temporary: false`). Sie haben keine
Keycloak-Rollen und gehoeren keiner Band an. Mitgliedschaften entstehen nur
in der Anwendung, zum Beispiel durch eine Einladung. Der Standard ist bewusst
oeffentliche Entwicklungskonfiguration, kein Produktionsgeheimnis.

### Stack starten

```bash
docker compose up -d --build
```

Damit laufen:

- React-Frontend (nginx): `http://localhost:5173`
- Spring Boot API: `http://localhost:8080` (auch direkt erreichbar, z. B. Health)
- PostgreSQL: `localhost:5432`
- Keycloak: `http://localhost:8081`

Issuer: `http://localhost:8081/realms/my-songbook`

Das Frontend im Browser spricht die API ueber relative Pfade `/api/...` an.
nginx im Frontend-Container leitet diese Aufrufe intern an den Compose-Dienst
`backend` weiter. Der Browser loest keine Docker-Dienstnamen auf.

Die SPA-Origin bleibt `http://localhost:5173`, damit die bestehenden
Keycloak-Redirects und die Backend-CORS-Annahme weiter gelten. Der
browserseitige Keycloak-Issuer bleibt `http://localhost:8081/realms/my-songbook`;
das Backend holt JWKS intern ueber `http://keycloak:8080/...`.

Relevante Variablen:

- Frontend-Build (`VITE_*`, Build-Zeit im Image): `VITE_OIDC_ISSUER`,
  `VITE_OIDC_CLIENT_ID`, `VITE_API_BASE_URL` (leer = relative `/api`-Aufrufe)
- Backend/Compose: `KEYCLOAK_ISSUER_URI`, `FRONTEND_ORIGIN`
  (Standard `http://localhost:5173`), `LOCAL_KEYCLOAK_TEST_PASSWORD`

Optional pruefen, ob Realm-Import, Discovery, Backend-Readiness, Frontend
und der `/api`-Proxy stehen (vom Repository-Root):

```bash
node scripts/verify-local-stack.js
```

Denselben Check gibt es als `npm run verify:local-stack` in `frontend/`.

### Anmelden

1. SPA unter `http://localhost:5173` oeffnen
2. `Anmelden` klicken
3. Im lokalen Keycloak `local-dev` / `local-dev` eingeben
4. Nach der Rueckkehr zur SPA ruft die App `/api/me` auf und legt den
   globalen User in PostgreSQL an bzw. verwendet ihn erneut
5. Zunaechst ist keine Band ausgewaehlt (`Keine Band`)
6. Ueber `Band anlegen` eine Band erzeugen; sie wird aktiv und im Header sichtbar
7. In `Import` / `Editor` / `Sets` Songs und Setlists dieser Band anlegen
8. Unter `Band` einen Einladungslink erzeugen und an eine zweite Person weitergeben
9. Eine zweite Band anlegen und zwischen den Bands wechseln; die Songs der ersten Band erscheinen dort nicht
10. `Abmelden` beendet die Sitzung

Import, Editor und Setlists gehoeren zur ausgewaehlten Band und liegen in
PostgreSQL. Ohne Login oder ohne aktive Band ist der Musikworkflow nicht
nutzbar. Es gibt noch keinen Offline-Modus.

### Optional: Vite-Dev-Server

Fuer Frontend-Entwicklung mit Hot Reload den Frontend-Container stoppen und
Vite lokal starten. Die restlichen Compose-Dienste bleiben laufen:

```bash
docker compose stop frontend
cd frontend
cp .env.local.example .env.local
npm ci
npm run dev
```

`.env.local` setzt `VITE_API_BASE_URL=http://localhost:8080`, weil Vite
keinen nginx-`/api`-Proxy hat. Port 5173 darf dann nicht vom Frontend-Container
belegt sein.

### Stack stoppen und zuruecksetzen

```bash
docker compose down
```

Keycloak speichert lokal nichts dauerhaft. Ein erneutes `docker compose up`
importiert das Realm wieder. PostgreSQL-Daten (einschliesslich User) liegen
im Volume `postgres_data`.

```bash
docker compose down -v
```

loescht das PostgreSQL-Volume. Danach erzeugt der naechste Login wieder
einen neuen globalen User.

## QA-Umgebung auf rwf-devpi

`compose.qa.yaml` startet denselben Stack auf rwf-devpi. Traefik der
Plattform (Docker-Netz `proxy`, Entrypoint `web`) macht ihn im LAN per HTTP
erreichbar. Host-Ports bleiben zu. Das ist keine Produktionsumgebung:
Zugangsdaten und Keycloak-`start-dev` entsprechen dem lokalen Compose.

Hostnamen, die auf die Adresse von rwf-devpi zeigen muessen (aktuell
`192.168.178.87`, analog zu `portainer.qa.rwf-devpi`):

- `my-songbook.qa.rwf-devpi` — Anwendung
- `auth.my-songbook.qa.rwf-devpi` — Keycloak

Auf rwf-devpi, im ausgecheckten Repository:

```bash
docker compose -f compose.qa.yaml up -d --build
```

Danach:

- Anwendung: `http://my-songbook.qa.rwf-devpi`
- Keycloak Admin: `http://auth.my-songbook.qa.rwf-devpi` mit `admin` / `admin`
- Anmeldung in der App: `local-dev` / `local-dev`, sofern
  `LOCAL_KEYCLOAK_TEST_PASSWORD` nicht gesetzt ist
- dieselben Realm-Benutzer `user1` und `user2` mit Passwort `test1234`,
  nachdem das Realm neu importiert wurde

Das Frontend spricht `/api` weiterhin relativ an. nginx leitet an den
Compose-Dienst `backend` weiter. Issuer fuer Browser und Backend ist
`http://auth.my-songbook.qa.rwf-devpi/realms/my-songbook`. Das Realm erlaubt
zusaetzlich zur lokalen Origin `http://localhost:5173` die QA-Origin
`http://my-songbook.qa.rwf-devpi`.

PostgreSQL und Keycloak liegen in Volumes (`postgres_data`, `keycloak_data`)
des Compose-Projekts `my-songbook-qa`.

```bash
docker compose -f compose.qa.yaml down
```

stoppt den Stack und behaelt die Volumes.

```bash
docker compose -f compose.qa.yaml down -v
```

loescht diese Volumes.

## Grundlegende Nutzung

Die Kopfzeile zeigt SongManager, `+ Song`, Setlists, die aktive Band, den Status
und das Konto. `/` öffnet vorläufig den Editor. `+ Song` legt einen Song an
oder öffnet den Import. `Setlists` öffnet die Setlists. Beides ist ein Übergang,
bis das Repertoire diese Abläufe aufnimmt.

### Typischer Workflow

1. Eine Band im Bandmenü erstellen oder auswählen.
2. Über `+ Song` → `Song importieren` Titel und Artist setzen, UG-Inhalt einfügen und speichern.
3. Im Editor den Song auswählen, den Text anpassen und speichern.
4. Über `Setlists` eine Setlist anlegen, Songs hinzufügen und sichern.

## Wichtige npm-Skripte

Vom Verzeichnis `frontend/`:

```bash
cd frontend
npm ci
npm run dev
```

- `npm run dev` - Entwicklungsserver starten
- `npm run build` - Produktions-Build erstellen
- `npm run preview` - Build lokal testen
- `npm run test` - Tests im Watch-Modus ausfuehren
- `npm run test:ci` - Tests mit Coverage (CI-Modus)
- `npm run lint` - ESLint ausfuehren
- `npm run verify:local-stack` - Compose-Smoke: Keycloak, Backend, Frontend, `/api`-Proxy
- `npm run test:e2e` - Playwright-Smoke gegen den laufenden Compose-Stack (Chromium)
- `npm run test:e2e:ui` - dieselbe Suite im Playwright UI Mode

## End-to-End-Tests (Playwright)

Die E2E-Suite prueft kritische Benutzerfluesse im echten lokalen Stack:
Browser, nginx-Frontend, Keycloak, Spring Boot und PostgreSQL. Vitest und
die Backend-Tests bleiben zusaetzlich bestehen. Es gibt keine Auth-Mocks
und keine direkten Datenbankzugriffe aus den Tests.

Abgedeckt sind Anmeldung, Band anlegen, Einladung, Rollenwechsel, Song,
Setlist (einschliesslich desselben Songs zweimal), persoenliche Notizen,
Verlassen der Band und Eigentumsuebertragung. Zusaetzlich prueft
`frontend/e2e/pwa.spec.js` Manifest, Service Worker und dass `/api`
nicht im App-Shell-Cache liegt. Nicht dabei: Offline-Musiknutzung,
weitere Browser, visuelle Regression, Last- und Accessibility-Audits.

Die Produktfaelle in `frontend/e2e/critical-path.spec.js` haengen an einer
gemeinsamen Band und laufen nacheinander. Ein frischer Lauf erzeugt eigene
Namen und braucht keinen manuell vorbereiteten Datenbestand. Ein bereits
benutztes PostgreSQL-Volume ist in Ordnung, solange die Testuser existieren.

### Voraussetzungen

- Docker und Docker Compose
- Node.js 22+ und npm 10+
- Chromium fuer Playwright (`npx playwright install chromium` in `frontend/`)

### Start

```bash
docker compose up -d --build
node scripts/wait-for-local-stack.mjs
cd frontend
npm ci
npx playwright install chromium
npm run test:e2e
```

Die App muss unter `http://localhost:5173` laufen. `npm run test:e2e` wartet
zusaetzlich, bis Keycloak, Backend, Frontend und der `/api`-Proxy bereit sind.
Dafuer gibt es Wiederholungen gegen die Health-Pruefung, keine festen Pausen
im Testablauf.

Eine leere Datenbank entsteht mit:

```bash
docker compose down -v
docker compose up -d --build
```

### Testuser

Nur fuer die lokale Development- und E2E-Umgebung, nicht fuer Produktion.
Die Suite verwendet die weiter oben beschriebenen Zugaenge:

| Benutzer | Rolle in der Suite |
|---|---|
| `local-dev` | Eigentuemer |
| `user1` | zweites Mitglied |
| `user2` | wird von dieser Suite nicht benutzt |

Das Passwort von `user1` lesen die Tests aus dem Realm-Import. Das Passwort
von `local-dev` ist der Compose-Standard. Abweichende Werte koennen die Tests
ueber `E2E_OWNER_USERNAME`, `E2E_OWNER_PASSWORD`, `E2E_MEMBER_USERNAME` und
`E2E_MEMBER_PASSWORD` lesen.

Browser ist ausschliesslich Chromium. Die Anmeldung laeuft ueber die
Keycloak-Oberflaeche. Folgefaelle nutzen die dabei gespeicherte Browser-Session
(`storageState` plus Session-Storage, weil der OIDC-Client dort liegt).
Diese Dateien liegen unter `frontend/e2e/.auth/` und gehoeren nicht ins Git.

### Debugging

```bash
cd frontend
npm run test:e2e:ui
npx playwright test --debug
npx playwright show-report
```

Bei einem Fehlschlag bleiben Trace und Screenshot unter
`frontend/test-results/` und im HTML-Report. Videos werden nicht aufgezeichnet.
In GitHub Actions laedt der Job `Playwright E2E` Report und Traces nur bei
Fehlschlag hoch und startet dafuer denselben Compose-Stack.

`user2` bleibt fuer spaetere Faelle frei. Der Offline-Ablauf
online, dann offline, dann Song anzeigen gehoert zu einem spaeteren Schritt.

## Datenhaltung

Songs und Setlists der aktiven Band liegen in PostgreSQL und werden über die
Spring-Boot-API gelesen und geschrieben. Die aktive Band im Header ist der
Tenant-Kontext für diesen Workflow.

Die Produktionsanwendung ist eine installierbare PWA. Der Service Worker
speichert nur die statische App-Shell. Songs, Setlists und persönliche Notizen
kommen in der normalen Oberfläche ausschließlich von der Backend-API; `/api`
wird nicht als Offline-Musikcache verwendet. Ein automatischer read-only
Snapshot in IndexedDB wird online im Hintergrund aktualisiert und ist nicht
maßgeblich. Ein Offline-Performance-Modus gibt es noch nicht.
Alte lokale IndexedDB-Daten werden nicht übernommen. Im Vite-Dev-Server
(`npm run dev`) ist der Service Worker aus.
