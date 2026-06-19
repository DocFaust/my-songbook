# Datenmodell

## Zweck

Dieses Dokument beschreibt das aktuelle Datenmodell von `my-songbook` in IndexedDB und legt eine empfohlene, konsistente Zielstruktur fest.

Die Persistenz ist lokal im Browser umgesetzt (DB: `SongbookDB`) und wird ueber `src/db.js` gekapselt.

## Persistenzlayer (IndexedDB)

- Datenbankname: `SongbookDB`
- Aktuelle DB-Version: `2`
- Object Stores:
  - `songs` (KeyPath: `Id`)
  - `setlists` (KeyPath: `id`)

Migrationen erfolgen im `upgrade(...)`-Callback von `openDB(...)`.

## Aktuelles Song-Modell (Ist-Zustand)

Der Song-Store erwartet aktuell mindestens:

- `Id: string` (Primary Key)
- `type: number` (nur `type === 1` wird von `addSongs(...)` gespeichert)
- `content: string` (ohne `content` wird nicht gespeichert)

Im Code treten zusaetzlich unterschiedliche Namensvarianten auf:

- Titel: `title` **oder** `name`
- Artist: `artist` **oder** `author`

## Empfohlenes Song-Modell (Soll-Zustand)

Zur Vereinheitlichung sollte mittelfristig ein kanonisches Modell verwendet werden:

```ts
type Song = {
  Id: string;            // UUID
  type: 1;               // aktuell fixer Song-Typ
  title: string;         // Anzeigename des Songs
  artist: string;        // Artist/Band
  content: string;       // ChordPro-Inhalt
  createdAt?: string;    // ISO-Timestamp (optional, empfohlen)
  updatedAt?: string;    // ISO-Timestamp (optional, empfohlen)
};
```

## Setlist-Modell (Ist/Soll)

Setlists sind bereits relativ konsistent:

```ts
type Setlist = {
  id: string;        // UUID
  name: string;      // frei waehlbarer Setlist-Name
  songIds: string[]; // Referenzen auf Song.Id
};
```

Hinweise:

- `songIds` kann verwaiste Referenzen enthalten, wenn Songs geloescht werden (aktuell kein Song-Delete im UI, aber technisch moeglich).
- Beim Rendern werden nicht aufloesbare IDs bereits defensiv herausgefiltert.

## Geschaeftsregeln im aktuellen Code

## Songs

- `addSongs(songs)` speichert nur Eintraege mit:
  - `song.type === 1`
  - vorhandenem `song.content`
- `store.put(song)` bedeutet:
  - existierende IDs werden aktualisiert (Upsert)
  - neue IDs werden eingefuegt

## Setlists

- `saveSetlist(setlist)` arbeitet ebenfalls als Upsert.
- `deleteSetlist(id)` entfernt eine Setlist vollstaendig.

## Referenzbeziehungen

- `Setlist.songIds[]` verweist auf `Song.Id`.
- Es gibt aktuell keine referenzielle Integritaet auf Datenbankebene (IndexedDB erzwingt das hier nicht).
- Die Integritaet wird in der UI logisch behandelt (`filter(Boolean)` im Setlist-Preview-Mapping).

## Validierung und Datenqualitaet

Aktuell:

- Basisvalidierung bei Songs ueber `addSongs(...)` (`type`, `content`)
- Setlist-Name wird in der UI auf `trim()` geprueft
- Keine zentrale Schema-Validierung pro Datentyp

Empfehlung:

- Gemeinsame Validatoren fuer `Song` und `Setlist` einfuehren (z. B. in `src/model/validators.js`).
- Vor dem Schreiben in IndexedDB immer normalisieren:
  - `name -> title`
  - `author -> artist`
- Optional `createdAt/updatedAt` standardisieren.

## Migrationsstrategie (Empfehlung)

Beim naechsten DB-Versionssprung (z. B. auf `3`) koennen Alt-Daten konsolidiert werden:

1. Alle Songs lesen
2. Feldmapping anwenden (`name/author` auf `title/artist`)
3. Bereinigte Datensaetze zurueckschreiben
4. Optional: verwaiste `songIds` aus Setlists entfernen

Damit wird die UI einfacher, weil keine Fallback-Logik (`title || name`) mehr noetig ist.

## Beispielobjekte

### Song (kanonisch)

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

## Offene Punkte

- Soll `type` langfristig bleiben (mehrere Songquellen) oder entfernt werden?
- Sollen Songs loeschbar sein und Setlists dabei automatisch bereinigt werden?
- Sollen Metadaten wie BPM, Tonart oder Tags als strukturierte Felder eingefuehrt werden?
