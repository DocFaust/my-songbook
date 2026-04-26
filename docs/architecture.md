# Architekturueberblick

## Ziel und Kontext

`my-songbook` ist eine Single-Page-Webanwendung (SPA) auf Basis von React und Vite.
Die App verwaltet Songs im ChordPro-Format lokal im Browser und unterstuetzt:

- Import von Texten (z. B. Ultimate Guitar) mit ChordPro-Konvertierung
- Bearbeitung und Vorschau von Songs
- Erstellung und Verwaltung von Setlists

Es gibt kein serverseitiges Backend. Persistenz erfolgt ausschliesslich ueber IndexedDB.

## Technologiestack

- UI/Frontend: React 19
- Routing: `react-router-dom`
- UI-Komponenten: Material UI (`@mui/material`)
- ChordPro Rendering: `chordsheetjs`
- Lokale Persistenz: IndexedDB ueber `idb`
- Build/Dev-Server: Vite
- Tests: Vitest + Testing Library

## Laufzeitarchitektur

Die Anwendung ist in klar getrennte Schichten aufgeteilt:

1. **Routing- und Seitenebene**
   - Einstieg ueber `src/main.jsx` und `src/App.jsx`
   - Routen:
     - `/` -> `Home`
     - `/import` -> `ImportPage`
     - `/editor` -> `EditorPage`
     - `/setlist` -> `SetlistPage`
   - Globale Navigation im `Header`

2. **Feature-Seiten**
   - `ImportPage`: Konvertiert Rohtext nach ChordPro und speichert als Song
   - `EditorPage`: Songauswahl, Textbearbeitung, Live-Vorschau
   - `SetlistPage`: Zusammenstellen/Speichern/Loeschen von Setlists inkl. Preview

3. **Wiederverwendbare UI-Komponenten**
   - `SongSideBar`: Songliste und Auswahl
   - `SongTextArea`: Bearbeitung und Speichern
   - `SongViewer` + `ChordProViewer`: Darstellung von ChordPro-Inhalten

4. **Datenzugriffsschicht**
   - `src/db.js` kapselt alle IndexedDB-Zugriffe (`songs`, `setlists`)
   - Seiten greifen nur ueber diese Funktionen auf Daten zu

5. **Domainenlogik / Konvertierung**
   - `src/converter/convertToChordPro.js`: zentrale Konvertierungslogik
   - Hilfslogik in:
     - `src/converter/chords.js` (Akkorderkennung)
     - `src/converter/sections.js` (Abschnittserkennung, Direktiven)

## Datenmodell

### Song (`songs` Store)

Typische Felder:

- `Id`: eindeutige ID (KeyPath)
- `type`: Song-Typ (relevant fuer Speichern in `addSongs`)
- `title` / `name`: Titel (im Bestand teils unterschiedlich genutzt)
- `artist` / `author`: Kuenstler (im Bestand teils unterschiedlich genutzt)
- `content`: ChordPro-Text

### Setlist (`setlists` Store)

- `id`: eindeutige ID (KeyPath)
- `name`: Name der Setlist
- `songIds`: Liste der referenzierten Song-IDs (`songs.Id`)

## Zentrale Datenfluesse

## 1) Importfluss (`ImportPage`)

1. Nutzer gibt Titel, Artist und Rohtext ein.
2. `convertToChordPro(...)` erzeugt ChordPro-Text.
3. Songobjekt wird erstellt und via `addSongs([song])` gespeichert.
4. Song ist danach im Editor/Setlist-Modul verfuegbar.

## 2) Editorfluss (`EditorPage`)

1. Beim Laden: `getAllSongs()` fuellt die Sidebar.
2. Songauswahl setzt `selectedSong` und `editedText`.
3. Vorschau rendert den aktuellen Text via `SongViewer` -> `ChordProViewer`.
4. Speichern schreibt den bearbeiteten Inhalt via `addSongs(...)` zurueck.

## 3) Setlistfluss (`SetlistPage`)

1. Initial: `getAllSongs()` und `getSetlists()`.
2. Nutzer waehlt Song-IDs fuer eine neue Setlist.
3. `saveSetlist(...)` persistiert die Setlist.
4. Preview rendert alle ausgewaehlten Songs in Reihenfolge der Auswahl.
5. Loeschen einer Setlist ueber `deleteSetlist(id)`.

## Rendering von ChordPro

`ChordProViewer` nutzt `ChordProParser` aus `chordsheetjs` und formatiert mit `HtmlTableFormatter`.
Das erzeugte HTML wird per `dangerouslySetInnerHTML` eingebettet.

Folgen fuer die Architektur:

- Parsing/Formatting ist clientseitig und synchron im UI-Thread.
- Ungueltiger ChordPro-Text wird abgefangen und als Fehlermeldung angezeigt.
- Styling erfolgt ueber `src/components/ChordProViewer/styles.css`.

## Persistenz und Versionierung

`initDB()` erstellt/aktualisiert die DB `SongbookDB` mit Version `2`:

- Version 1: Store `songs`
- Version 2: Store `setlists`

Die Migration erfolgt im `upgrade(...)`-Callback von `idb.openDB(...)`.

## Tests und Qualitaet

- Basistest in `src/__tests__/App.test.jsx` prueft Header-Rendering.
- Linting ueber ESLint.
- CI-Pipeline ueber GitHub Actions (`.github/workflows/ci.yml`) und Jenkinsfile.

## Aktuelle technische Beobachtungen

- Im Codebestand existieren teils aeltere/derzeit ungenutzte Komponenten (z. B. `SongList`, `SongDetail`, `InputArea`, `ImportButton`).
- Feldnamen sind nicht durchgaengig vereinheitlicht (`title` vs `name`, `artist` vs `author`).
- Die aktuelle Architektur ist stark frontend-zentriert und fuer lokale Nutzung optimiert.

Diese Punkte sind funktional handhabbar, sollten aber langfristig konsolidiert werden, um Wartbarkeit und Datenkonsistenz zu verbessern.
