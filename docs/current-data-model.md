# Datenmodell

## Status

CURRENT

Dieses Dokument beschreibt die **tatsächlich persistierten IndexedDB-Strukturen**
von `my-songbook`, ihre Constraints und das aktuelle Schreib-/Leseverhalten,
soweit es im Repository verifizierbar ist.

Es enthält keine Zielarchitektur, keine Migrationspläne, keine Empfehlungen
und keine fachliche Zieldomäne.

Zugehörige Dokumente:

- `docs/current-architecture.md` — aktueller Anwendungsaufbau
- `docs/domain-model.md` — TARGET-Domainmodell (nicht implementiert)

---

## Persistenz

Kapselung: `src/db.js` über `idb.openDB`.

| Eigenschaft | Wert |
|---|---|
| Datenbankname | `SongbookDB` |
| Version | `2` |
| Store `songs` | KeyPath `Id` (seit Version 1) |
| Store `setlists` | KeyPath `id` (seit Version 2) |

Es gibt keine sekundären Indexes.

Migration läuft im `upgrade`-Callback von `openDB`: fehlende Stores werden bei
`oldVersion < 1` bzw. `< 2` angelegt. Es gibt keine Daten-Transformation
bestehender Datensätze.

IndexedDB speichert das jeweils übergebene Objekt vollständig. Es gibt keine
zentrale Modell- oder Validierungsschicht und kein Schema, das unbekannte
Felder entfernt.

---

## Persistenz-API

| Funktion | Verhalten |
|---|---|
| `initDB()` | Öffnet bzw. erstellt die Datenbank |
| `addSongs(songs)` | `put` nur wenn `song.type === 1` **und** `song.content` truthy |
| `getAllSongs()` | alle Einträge aus `songs`, ungefiltert |
| `saveSetlist(setlist)` | `put` (Upsert), ohne Feldvalidierung |
| `getSetlists()` | alle Einträge aus `setlists` |
| `getSetlistById(id)` | einzelner Setlist-Datensatz; in der UI ungenutzt |
| `deleteSetlist(id)` | löscht eine Setlist anhand von `id` |

`store.put` / `db.put` ist ein Upsert: dieselbe `Id` bzw. `id` überschreibt
den vorhandenen Datensatz.

Es gibt keine Funktion zum Lesen eines einzelnen Songs über `db.js` und keine
Funktion zum Löschen von Songs. Die ungenutzte Komponente `SongDetail` umgeht
die API und ruft `initDB().get('songs', songId)` direkt auf.

---

## Store `songs`

### Persistierte Struktur (aktive Schreibpfade)

Aktive Schreibpfade sind Import (`ImportPage`) und Speichern im Editor
(`SongTextArea` → `addSongs`). Sie schreiben:

```text
{
  Id: string,       // crypto.randomUUID(), KeyPath
  type: 1,          // Pflicht für addSongs
  title: string,
  artist: string,   // darf leer sein
  content: string   // ChordPro; Pflicht (truthy) für addSongs
}
```

`createdAt` und `updatedAt` werden nicht geschrieben.

### Constraints in `addSongs`

Ein Song wird nur persistiert, wenn **beide** Bedingungen gelten:

- `song.type === 1` (strikte Gleichheit)
- `song.content` ist truthy

Andernfalls wird der Eintrag still übersprungen. Weitere Felder werden weder
geprüft noch normalisiert.

Leerer String (`""`) ist für `content` nicht truthy und wird nicht gespeichert.
Whitespace-only-Inhalt wäre für `addSongs` truthy; die Editor-UI lehnt ihn
vor dem Aufruf ab (`editedText.trim()`).

Es gibt keine weiteren Song-Typen im UI. `type === 1` ist die einzige
Speichervoraussetzung dieser Art.

### Schreibpfade

**Import** erzeugt und speichert:

- `Id`: `crypto.randomUUID()`
- `type`: `1`
- `title`: Eingabe oder `"Unbenannt"`, wenn leer
- `artist`: Eingabe oder `""`, wenn leer
- `content`: Ergebnis von `convertToChordPro`

**Editor `New`** erzeugt denselben Feldumfang nur im lokalen Seiten-State
(`title: "Neuer Song"`, `content: ""`) und persistiert ihn nicht. Persistenz
erfolgt erst über Speichern in `SongTextArea`, und nur wenn der Text nicht
leer ist. Gespeichert wird `{ ...selectedSong, content: editedText }`.

### Feldvarianten in vorhandenen Datensätzen

Aktive Schreibpfade nutzen `title` und `artist`. Die UI liest zusätzlich
ältere Feldnamen, falls sie in vorhandenen Datensätzen vorkommen:

| Anzeige | Primär | Fallback |
|---|---|---|
| Editor-Titel (`SongTextArea`) | `title` | `name`, sonst `"Unbenannt"` |
| Sidebar-Artist (`SongSideBar`) | `artist` | `author` |
| Setlist-Anzeige | `title` | sonst `Id` |

Die Sidebar zeigt als Titel nur `title` (ohne `name`-Fallback).

Diese Fallbacks sind Leseverhalten, keine Schreibnormalisierung. Beim
Upsert über den Editor bleiben abweichende Felder eines geladenen Objekts
erhalten, weil `selectedSong` gespreaded wird.

---

## Store `setlists`

### Persistierte Struktur

Aktiver Schreibpfad: `SetlistPage` → `saveSetlist`.

```text
{
  id: string,        // uuid v4, KeyPath
  name: string,      // getrimmt
  songIds: string[]  // Referenzen auf Song.Id, Reihenfolge bleibt erhalten
}
```

### Constraints

`saveSetlist` prüft Felder nicht. IndexedDB verlangt den KeyPath `id`.

Die UI speichert nur, wenn `name.trim()` nicht leer ist. Der gespeicherte Name
ist der getrimmte Wert. Eine leere `songIds`-Liste ist zulässig.

Die UI verhindert beim Hinzufügen doppelte Song-IDs. Die Persistenz erzwingt
keine Eindeutigkeit in `songIds`.

Gespeicherte Setlists können gelöscht, in der aktuellen UI aber nicht geladen,
bearbeitet oder in der Preview angezeigt werden.

---

## Referenzen

- `setlists.songIds[]` verweist auf `songs.Id`.
- IndexedDB erzwingt hier keine referenzielle Integrität.
- Es gibt keine Song-Löschfunktion; verwaiste `songIds` können trotzdem
  entstehen, etwa wenn Datensätze außerhalb der UI entfernt werden.
- Die Setlist-Preview mappt IDs auf geladene Songs und filtert nicht
  auflösbare Einträge mit `filter(Boolean)`. Die gespeicherte Liste selbst
  wird dabei nicht bereinigt.
- `deleteSetlist` entfernt nur die Setlist. Songs bleiben unverändert.

---

## Beispielobjekte

Die Beispiele entsprechen den aktiven Schreibpfaden.

### Song

```json
{
  "Id": "2f7d6b72-8cb5-4a4e-b1d6-742a1b6b0f35",
  "type": 1,
  "title": "Wonderwall",
  "artist": "Oasis",
  "content": "{title: Wonderwall}\n{artist: Oasis}\n\n[Em7]Today is gonna be the day..."
}
```

### Setlist

```json
{
  "id": "f3c2bb85-53d2-4f6e-b822-bd6e2f52f8ba",
  "name": "Akustikabend",
  "songIds": [
    "2f7d6b72-8cb5-4a4e-b1d6-742a1b6b0f35",
    "e9b3a1fd-bfd8-49f2-8a38-fec4037729f1"
  ]
}
```
