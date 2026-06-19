# My Songbook

`my-songbook` ist eine React/Vite-Webanwendung zum Verwalten von Songs im ChordPro-Format.
Songs werden lokal im Browser (IndexedDB) gespeichert und koennen in Setlists organisiert werden.

## Funktionen auf einen Blick

- Import von Ultimate-Guitar-Texten mit Konvertierung nach ChordPro
- Song-Editor mit Live-Vorschau (ChordPro-Rendering)
- Verwaltung von Setlists fuer Auftritte
- Lokale Datenspeicherung im Browser (kein Server notwendig)

## Voraussetzungen

- Node.js 20+ (empfohlen)
- npm 10+ (oder passend zur installierten Node-Version)

## Installation und Start

```bash
npm install
npm run dev
```

Danach ist die App ueber die von Vite angezeigte lokale URL erreichbar (standardmaessig `http://localhost:5173`).

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

Die App speichert Daten in IndexedDB unter der Datenbank `SongbookDB` mit den Stores:

- `songs`
- `setlists`

Beim Loeschen von Browserdaten gehen auch Songs/Setlists verloren.
