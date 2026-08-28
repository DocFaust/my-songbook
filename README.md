# My Songbook

`my-songbook` ist eine React/Vite-Webanwendung zum Verwalten von Songs im ChordPro-Format.
Songs und Setlists gehören zu einer Band und werden über die Spring-Boot-API
in PostgreSQL gespeichert.

## Funktionen auf einen Blick

- Import von Ultimate-Guitar-Texten mit Konvertierung nach ChordPro
- Song-Editor mit Live-Vorschau (ChordPro-Rendering)
- Verwaltung von Setlists fuer Auftritte
- Band-bezogener Musikworkflow nach Anmeldung (PostgreSQL über die API)

## Voraussetzungen

- Node.js 20+ (empfohlen)
- npm 10+ (oder passend zur installierten Node-Version)
- Docker und Docker Compose, wenn Backend, PostgreSQL und lokales Keycloak
  gestartet werden sollen

## Installation und Start

```bash
npm install
npm run dev
```

Danach ist die App ueber die von Vite angezeigte lokale URL erreichbar (standardmaessig `http://localhost:5173`).

Import, Editor und Setlists erfordern Anmeldung und eine aktive Band.

## Lokale Integrationsumgebung (Frontend, Backend, PostgreSQL, Keycloak)

Fuer den echten Browser-Login ohne das externe Keycloak unter
`login.docfaust.de` startet Docker Compose ein lokales Keycloak. Das ist
dieselbe OIDC/JWT-Anbindung wie gegen ein externes Keycloak, nur mit
anderen Runtime-URLs.

Lokale Entwicklungszugangsdaten, nicht fuer Produktion und nicht ausserhalb
dieser Compose-Umgebung verwenden:

- Keycloak Admin Console `http://localhost:8081`: `admin` / `admin`
- Realm `my-songbook`, Benutzer `local-dev`, Passwort aus
  `LOCAL_KEYCLOAK_TEST_PASSWORD` (Standard: derselbe lokale Wert wie der
  Benutzername)

Das Realm-Import enthaelt den Benutzer ohne Passwortfeld. Compose setzt das
lokale Testpasswort nach dem Start. Der Standard ist bewusst oeffentliche
Entwicklungskonfiguration, kein Produktionsgeheimnis.

### Stack starten

```bash
docker compose up --build --wait
cp .env.local.example .env.local
npm run dev
```

Damit laufen:

- React/Vite: `http://localhost:5173`
- Spring Boot: `http://localhost:8080`
- PostgreSQL: `localhost:5432`
- Keycloak: `http://localhost:8081`

Issuer: `http://localhost:8081/realms/my-songbook`

Optional pruefen, ob Realm-Import, Discovery und Backend-Readiness stehen:

```bash
npm run verify:local-stack
```

### Anmelden

1. SPA unter `http://localhost:5173` oeffnen
2. `Anmelden` klicken
3. Im lokalen Keycloak `local-dev` / `local-dev` eingeben
4. Nach der Rueckkehr zur SPA ruft die App `/api/me` auf und legt den
   globalen User in PostgreSQL an bzw. verwendet ihn erneut
5. Zunaechst ist keine Band ausgewaehlt (`Keine Band`)
6. Ueber `Band anlegen` eine Band erzeugen; sie wird aktiv und im Header sichtbar
7. In `Import` / `Editor` / `Sets` Songs und Setlists dieser Band anlegen
8. Eine zweite Band anlegen und zwischen den Bands wechseln; die Songs der ersten Band erscheinen dort nicht
9. `Abmelden` beendet die Sitzung

Import, Editor und Setlists gehoeren zur ausgewaehlten Band und liegen in
PostgreSQL. Ohne Login oder ohne aktive Band ist der Musikworkflow nicht
nutzbar. Es gibt noch keinen Offline-Modus.

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

## Grundlegende Nutzung

Die Navigation erfolgt ueber die obere Leiste:

- `Home`: Startseite
- `Import`: Songtext importieren und als ChordPro speichern
- `Editor`: Songs auswaehlen, bearbeiten und Vorschau sehen
- `Sets`: Setlists erstellen, Songs hinzufuegen und gespeicherte Setlists verwalten

### Typischer Workflow

1. In `Import` Titel/Artist setzen, UG-Inhalt einfuegen und speichern.
2. In `Editor` importierten Song auswaehlen, Text anpassen und speichern.
3. In `Sets` neue Setlist anlegen, Songs hinzufuegen und als Auftritts-Setlist sichern.

## Wichtige npm-Skripte

- `npm run dev` - Entwicklungsserver starten
- `npm run build` - Produktions-Build erstellen
- `npm run preview` - Build lokal testen
- `npm run test` - Tests im Watch-Modus ausfuehren
- `npm run test:ci` - Tests mit Coverage (CI-Modus)
- `npm run lint` - ESLint ausfuehren

## Datenhaltung

Songs und Setlists der aktiven Band liegen in PostgreSQL und werden über die
Spring-Boot-API gelesen und geschrieben. Die aktive Band im Header ist der
Tenant-Kontext für diesen Workflow.

Es gibt noch keinen Offline-/PWA-Cache. Alte lokale IndexedDB-Daten werden
nicht übernommen.
