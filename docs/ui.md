# UI-Dokumentation

## Ziel der UI

Die Benutzeroberflaeche von `my-songbook` soll einen einfachen, durchgaengigen Ablauf fuer Musiker:innen bieten:

1. Song importieren
2. Song bearbeiten und pruefen
3. Songs zu Setlists zusammenstellen

Die UI ist als Single-Page-App umgesetzt und auf lokale Nutzung im Browser ausgelegt.

## Design- und UI-Stack

- React 19 fuer komponentenbasierte UI
- Material UI (`@mui/material`) fuer Layout, Formulare und Bedienelemente
- `react-router-dom` fuer Navigation zwischen den Seiten
- `chordsheetjs` fuer visuelle Ausgabe von ChordPro-Inhalten

Globale Basisstile liegen in `src/index.css`, weitere Styles in komponentenspezifischen CSS-Dateien.

## Navigationskonzept

Die Hauptnavigation erfolgt ueber eine fixe AppBar (`Header`) am oberen Rand.
Sie ist auf allen Seiten sichtbar und bietet vier Haupteinstiege:

- `Home` (`/`)
- `Editor` (`/editor`)
- `Sets` (`/setlist`)
- `Import` (`/import`)

Dadurch bleibt der Wechsel zwischen den Hauptaufgaben jederzeit moeglich.

## Seiten und UI-Verhalten

## 1) Home (`/`)

**Zweck**
- Einfache Startansicht mit Begruessung und Hinweis auf die Navigation.

**UI-Elemente**
- Ueberschrift
- Kurzer Hilfetext

## 2) Import (`/import`)

**Zweck**
- Uebernahme von Rohtext (z. B. aus Ultimate Guitar) und Speicherung als ChordPro-Song.

**Wichtige UI-Elemente**
- Textfeld `Titel`
- Textfeld `Artist`
- Mehrzeiliges Eingabefeld fuer den Importinhalt
- Primar-Button `Konvertieren & Speichern`
- Rechtlicher Hinweis (Nutzungsbedingungen)

**Interaktion**
- Der Speichern-Button ist deaktiviert, solange kein Importtext vorhanden ist.
- Nach dem Speichern werden Felder zurueckgesetzt und eine Rueckmeldung angezeigt.

## 3) Editor (`/editor`)

**Zweck**
- Bearbeiten bestehender Songs mit direkter Vorschau.

**Layout**
- Linke Spalte: Songliste (`SongSideBar`)
- Rechte Seite in zwei Bereichen:
  - Editor (`SongTextArea`)
  - Vorschau (`SongViewer` -> `ChordProViewer`)

**Wichtige UI-Elemente**
- Songauswahl in einer Liste
- Button `New` zum Anlegen eines neuen Songs
- Mehrzeilige Texteingabe
- Button `Speichern`
- Snackbar-Benachrichtigung nach erfolgreichem Speichern

**Interaktion**
- Bei Songauswahl wird der Inhalt in den Editor geladen.
- Jede Eingabe aktualisiert die Vorschau unmittelbar.
- Speichern schreibt den aktuellen Stand in die lokale Datenbank.

## 4) Sets (`/setlist`)

**Zweck**
- Erstellung und Verwaltung von Setlists fuer Auftritte.

**Layout**
- Linke Spalte: Erstellung/Verwaltung von Setlists
- Rechte Spalte: Auftritts-Preview der ausgewaehlten Songs

**Wichtige UI-Elemente (links)**
- Textfeld `Name` fuer neue Setlist
- Select `Song hinzufuegen`
- Liste der aktuell ausgewaehlten Songs
- `Entfernen` je Song in der aktuellen Auswahl
- Button `Setlist speichern`
- Liste gespeicherter Setlists inkl. `Loeschen`

**Wichtige UI-Elemente (rechts)**
- Bereich `Auftritts-Ansicht (Preview)`
- Pro Song ein Block mit Titel und ChordPro-Ausgabe

**Interaktion**
- Songs werden nur einmal pro neuer Setlist aufgenommen.
- Setlists werden lokal gespeichert und koennen wieder geloescht werden.

## Wiederverwendete UI-Komponenten

- `Header`: globale Navigation
- `SongSideBar`: Songliste/Selektion
- `SongTextArea`: Textbearbeitung und Speichern
- `SongViewer`: Wrapper fuer Vorschau
- `ChordProViewer`: Rendert ChordPro-Text als HTML-Ausgabe

## UI-Zustaende und Feedback

Typische Zustandsarten in der aktuellen UI:

- **Leerzustaende**
  - Keine Songauswahl im Editor
  - Keine Songs in der Setlist-Preview
- **Validierungsnahe Zustaende**
  - Deaktivierter Import-Button bei leerem Input
  - Speichern in Sets ohne Namen wird still abgebrochen
- **Erfolgsfeedback**
  - Snackbar im Editor (`Song gespeichert!`)
  - Browser-Alert nach Import (`Song importiert!`)
- **Fehlerfeedback**
  - ChordPro-Parsingfehler werden in der Vorschau als roter Text angezeigt

## Responsiveness und Layout-Verhalten

- Die Hauptnavigation ist fixiert; Seiteninhalte werden mit Top-Margin darunter positioniert.
- Der Editor verwendet ein horizontales Split-Layout mit eigenem Scrollbereich.
- Setlist- und Songlisten nutzen begrenzte Hoehen mit vertikalem Scrollen.
- Die aktuelle UI ist vorrangig fuer Desktop-/Tablet-Breite optimiert.

## Stilistische Konventionen

- MUI-SX-Props werden stark fuer direktes Component-Styling genutzt.
- Globale Typografie ist derzeit minimal (Arial als Basisfont).
- ChordPro-spezifische Darstellung (Akkordfarben, Chorus-Einrueckung etc.) liegt in `ChordProViewer/styles.css`.

## Bekannte UI-Schulden

- Uneinheitliche Feldbezeichnungen in der Anzeige (`title/name`, `artist/author`) koennen zu inkonsistenten Labels fuehren.
- Einige aeltere Komponenten existieren im Codebestand, sind aber nicht Teil des aktiven UI-Flows.
- Feedbackmechanismen sind gemischt (`Snackbar` vs `alert`) und noch nicht vereinheitlicht.
