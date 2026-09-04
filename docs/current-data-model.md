# Datenmodell

## Status

CURRENT

Dieses Dokument beschreibt die **tatsächlich persistierten Strukturen** von
`my-songbook`, soweit sie im Repository verifizierbar sind:

- PostgreSQL ist maßgeblich für globale User, Bands, Memberships,
  Band-Einladungen sowie band-scoped Songs und Setlists
- IndexedDB (`frontend/src/db.js`) existiert noch als Legacy-Infrastruktur, ist aber
  **nicht** mehr die Quelle der Wahrheit für den React-Musikworkflow

Es enthält keine Zielarchitektur, keine Migrationspläne, keine Empfehlungen
und keine fachliche Zieldomäne.

Zugehörige Dokumente:

- `docs/current-architecture.md` — aktueller Anwendungsaufbau
- `docs/domain-model.md` — TARGET-Domainmodell (nicht vollständig implementiert)

---

## PostgreSQL (User, Band, Membership, Song, Setlist)

Kapselung: Spring Data JPA / Hibernate + Flyway unter `backend/`
(`de.docfaust.mysongbook`). Maßgeblich für Identität, Band-Zugehörigkeit,
Einladungen und den React-Musikworkflow (Import, Editor, Setlists). Flyway bleibt
ausschließlicher Schema-Owner; Hibernate validiert das Schema
(`ddl-auto=validate`) und erzeugt es nicht.

Es gibt keinen Offline-/PWA-Cache. Alte IndexedDB-Daten werden nicht
migriert, nicht automatisch hochgeladen und erscheinen nicht im
servergestützten Workflow.

Flyway-Migrationen:

| Version | Inhalt |
|---|---|
| `V1__infrastructure.sql` | Platzhalter, keine Domain-Tabellen |
| `V2__user.sql` | `users` |
| `V3__band.sql` | `bands`, `memberships` |
| `V4__song.sql` | `songs` |
| `V5__setlist.sql` | `setlists`, `setlist_entries` |
| `V6__invitation.sql` | `band_invitations` |

Es gibt keine generischen Audit-, Settings- oder Metadaten-Spalten.

### Tabelle `users`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `external_subject` | TEXT | NOT NULL, UNIQUE |

`external_subject` ist der Keycloak-`sub`. Der Datensatz entsteht beim ersten
authentifizierten API-Zugriff (`INSERT ... ON CONFLICT`).

### Tabelle `bands`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `name` | VARCHAR(100) | NOT NULL, nicht nur Whitespace (`btrim(name) <> ''`) |

Bandnamen sind nicht global eindeutig. Identität ist die interne UUID.
Umliegendes Whitespace wird vor dem Speichern entfernt. Es gibt keine
Beschreibungs-, Logo- oder Settings-Felder.

### Tabelle `memberships`

| Spalte | Typ | Constraints |
|---|---|---|
| `band_id` | UUID | NOT NULL, FK → `bands(id)`, Teil des PRIMARY KEY |
| `user_id` | UUID | NOT NULL, FK → `users(id)`, Teil des PRIMARY KEY |
| `role` | TEXT | NOT NULL, nur `OWNER`, `ADMIN`, `MEMBER`, `GUEST` |

Genau eine Membership je `(band_id, user_id)`. Index auf `user_id` für die
Liste der Bands des aktuellen Users.

Beim Anlegen einer Band entstehen in **einer Transaktion** die Band-Zeile und
genau eine Membership mit Rolle `OWNER` für den aus dem JWT abgeleiteten User.
OWNER und ADMIN dürfen Rollen zwischen ADMIN, MEMBER und GUEST ändern und
diese Mitglieder entfernen. OWNER bleibt unveränderlich. Ownership-Übertragung
ist nicht implementiert.

### Tabelle `songs`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `band_id` | UUID | NOT NULL, FK → `bands(id)` |
| `title` | VARCHAR(200) | NOT NULL, nicht nur Whitespace (`btrim(title) <> ''`) |
| `artist` | VARCHAR(200) | NOT NULL; leerer String nach Trim ist zulässig |
| `content` | TEXT | NOT NULL, nicht nur Whitespace (`btrim(content) <> ''`) |
| `version` | INTEGER | NOT NULL, Default `0`, `version >= 0` |

Ein Song ohne Band ist nicht speicherbar. Titel sind weder bandweit noch
global eindeutig. `content` ist der unveränderte ChordPro-Text; das Backend
parsed, normalisiert oder schreibt ChordPro nicht um. Index auf `band_id`
für die Band-Liste.

Neue Songs starten bei Version `0`. Updates und Deletes sind
versionsbedingt: sie greifen nur, wenn `id`, `band_id` und erwartete
`version` übereinstimmen. Ein erfolgreiches Update erhöht `version` um 1
(`@Version`). Eine veraltete Version ändert keine Zeile.

Delete entfernt die Song-Zeile (kein Soft Delete) und alle
`setlist_entries`, die auf diesen Song verweisen (`ON DELETE CASCADE` auf
`song_id`). Die Setlists selbst bleiben; es gibt keine Platzhalter-Einträge.
Persönliche Song-Notizen existieren noch nicht.

### Tabelle `setlists`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `band_id` | UUID | NOT NULL, FK → `bands(id)` |
| `name` | VARCHAR(200) | NOT NULL, nicht nur Whitespace (`btrim(name) <> ''`) |
| `version` | INTEGER | NOT NULL, Default `0`, `version >= 0` |

Eine Setlist ohne Band ist nicht speicherbar. Namen sind weder bandweit noch
global eindeutig. Index auf `band_id` für die Band-Liste.

Neue Setlists starten bei Version `0`. Updates und Deletes sind
versionsbedingt: sie greifen nur, wenn `id`, `band_id` und erwartete
`version` übereinstimmen. Ein erfolgreiches Update erhöht `version` um 1
(`@Version`, inkl. reiner Eintragsänderungen). Eine veraltete Version ändert
keine Zeile.

Delete entfernt die Setlist und ihre Einträge (`ON DELETE CASCADE` von
`setlist_entries.setlist_id`). Songs bleiben unverändert.

### Tabelle `setlist_entries`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `setlist_id` | UUID | NOT NULL, FK → `setlists(id)` ON DELETE CASCADE |
| `song_id` | UUID | NOT NULL, FK → `songs(id)` ON DELETE CASCADE |
| `position` | INTEGER | NOT NULL, `position >= 0`; UNIQUE zusammen mit `setlist_id` |

Die Reihenfolge ist `(setlist_id, position)`. Dieselbe `song_id` darf in
derselben Setlist mehrfach vorkommen; es gibt keine Unique-Constraint auf
`(setlist_id, song_id)`. Positionen werden als `0, 1, 2, …` gespeichert.
Index auf `song_id` für das Cascade-Delete beim Song-Löschen.

Ein Setlist-Eintrag ohne Setlist oder ohne existierenden Song ist nicht
speicherbar. Die API akzeptiert nur Songs derselben Band; ein Song einer
anderen Band wird wie ein nicht vorhandener Song als 404 behandelt.

### Tabelle `band_invitations`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `band_id` | UUID | NOT NULL, FK → `bands(id)` |
| `token_hash` | VARCHAR(64) | NOT NULL, UNIQUE; SHA-256-Hex des Roh-Tokens |
| `created_at` | TIMESTAMPTZ | NOT NULL |
| `expires_at` | TIMESTAMPTZ | NOT NULL, später als `created_at` |
| `created_by` | UUID | NOT NULL, FK → `users(id)` |
| `accepted_at` | TIMESTAMPTZ | nullable |
| `accepted_by` | UUID | nullable, FK → `users(id)` |

Der Roh-Token wird nicht gespeichert. Einladungen gelten 14 Tage, sind
einmalig und werden bei Annahme mit `accepted_at` / `accepted_by` markiert.
Index auf `band_id`; Lookup erfolgt über `token_hash`. Keycloak enthält
keine Band-Rollen.

---

## Frontend-Darstellung (API)

Der React-Musikworkflow verwendet die Backend-Darstellung:

### Song

```text
{
  id: string,
  bandId: string,
  title: string,
  artist: string,
  content: string,
  version: number
}
```

Create sendet `title`, `artist`, `content`. Update sendet zusätzlich
`version`. Die ID erzeugt das Backend.

### Setlist

```text
{
  id: string,
  bandId: string,
  name: string,
  songIds: string[],
  version: number
}
```

Create sendet `name` und `songIds`. Update sendet zusätzlich `version`.
Delete sendet die erwartete `version` als Query-Parameter. `songIds`
behalten Reihenfolge und Duplikate.

---

## IndexedDB (Legacy, nicht maßgeblich)

Kapselung: `frontend/src/db.js` über `idb.openDB`.

IndexedDB ist nach dem Frontend-Cutover **keine** Quelle der Wahrheit mehr.
Import, Editor, `SongTextArea` und Setlists nutzen sie nicht. Es gibt keine
Migration, keinen Upload und keinen Abgleich mit PostgreSQL. Späterer
Offline-/PWA-Cache ist ein anderer Schritt und verwendet dieses Modell nicht
als Cache.

| Eigenschaft | Wert |
|---|---|
| Datenbankname | `SongbookDB` |
| Version | `2` |
| Store `songs` | KeyPath `Id` (seit Version 1) |
| Store `setlists` | KeyPath `id` (seit Version 2) |

Die Datei bleibt vorerst, weil Tests und ungenutzte Legacy-Komponenten sie
noch referenzieren.

---

## Beispielobjekte

Die Beispiele entsprechen den aktiven API-Schreibpfaden.

### Song

```json
{
  "id": "2f7d6b72-8cb5-4a4e-b1d6-742a1b6b0f35",
  "bandId": "0c1a2b3d-4e5f-6789-abcd-ef0123456789",
  "title": "Wonderwall",
  "artist": "Oasis",
  "content": "{title: Wonderwall}\n{artist: Oasis}\n\n[Em7]Today is gonna be the day...",
  "version": 0
}
```

### Setlist

```json
{
  "id": "f3c2bb85-53d2-4f6e-b822-bd6e2f52f8ba",
  "bandId": "0c1a2b3d-4e5f-6789-abcd-ef0123456789",
  "name": "Akustikabend",
  "songIds": [
    "2f7d6b72-8cb5-4a4e-b1d6-742a1b6b0f35",
    "e9b3a1fd-bfd8-49f2-8a38-fec4037729f1",
    "2f7d6b72-8cb5-4a4e-b1d6-742a1b6b0f35"
  ],
  "version": 0
}
```
