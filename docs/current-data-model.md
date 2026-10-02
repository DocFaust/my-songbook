# Datenmodell

## Status

CURRENT

Dieses Dokument beschreibt die **tatsächlich persistierten Strukturen** von
`my-songbook`, soweit sie im Repository verifizierbar sind:

- PostgreSQL ist maßgeblich für globale User, Bands, Memberships,
  Band-Einladungen, band-scoped Songs und Setlists sowie persönliche
  Song-Notizen
- Frontend-IndexedDB ist **kein** Anwendungsspeicher. Er enthält den
  wegwerfbaren Read-only-Snapshot und ist keine Quelle der Wahrheit für den
  React-Musikworkflow

Es enthält keine Zielarchitektur, keine Migrationspläne, keine Empfehlungen
und keine fachliche Zieldomäne.

Zugehörige Dokumente:

- `docs/current-architecture.md` — aktueller Anwendungsaufbau
- `docs/domain-model.md` — TARGET-Domainmodell (nicht vollständig implementiert)

---

## PostgreSQL (User, Band, Membership, Song, Setlist)

Kapselung: Spring Data JPA / Hibernate + Flyway unter `backend/`
(`de.docfaust.mysongbook`). Maßgeblich für Identität, Band-Zugehörigkeit,
Einladungen, persönliche Song-Notizen und den React-Musikworkflow (Import, Editor, Setlists). Flyway bleibt
ausschließlicher Schema-Owner; Hibernate validiert das Schema
(`ddl-auto=validate`) und erzeugt es nicht.

Es gibt keinen maßgeblichen Offline-Musikcache. Der Service Worker speichert
nur die statische App-Shell, keine Songs, Setlists oder Notizen. IndexedDB
hält einen wegwerfbaren Read-only-Snapshot, den die Online-UI nicht liest.
Alte lokale Musikdaten werden nicht migriert, nicht automatisch hochgeladen
und erscheinen nicht im servergestützten Workflow.

Flyway-Migrationen:

| Version | Inhalt |
|---|---|
| `V1__infrastructure.sql` | Platzhalter, keine Domain-Tabellen |
| `V2__user.sql` | `users` |
| `V3__band.sql` | `bands`, `memberships` |
| `V4__song.sql` | `songs` |
| `V5__setlist.sql` | `setlists`, `setlist_entries` |
| `V6__invitation.sql` | `band_invitations` |
| `V7__personal_song_note.sql` | `personal_song_notes` |

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
diese Mitglieder entfernen. Die normale Rollenänderung und das Entfernen
fassen OWNER nicht an. Ownership wechselt nur über die Übertragung: in
derselben Transaktion wird das Ziel `OWNER` und der bisherige OWNER `ADMIN`.
Es gibt keine zusätzliche Spalte dafür. ADMIN, MEMBER und GUEST können die
eigene Membership löschen; der OWNER nicht. Endet eine Membership
freiwillig oder durch Entfernen, werden in derselben Transaktion die
persönlichen Song-Notizen dieses Users zu Songs dieser Band gelöscht.
Notizen in anderen Bands bleiben. Eine Ownership-Übertragung löscht keine
Notizen.

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
Persönliche Song-Notizen dieses Songs werden über `ON DELETE CASCADE` auf
`personal_song_notes.song_id` mitgelöscht.

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

### Tabelle `personal_song_notes`

| Spalte | Typ | Constraints |
|---|---|---|
| `id` | UUID | PRIMARY KEY |
| `user_id` | UUID | NOT NULL, FK → `users(id)` |
| `song_id` | UUID | NOT NULL, FK → `songs(id)` ON DELETE CASCADE |
| `text` | TEXT | NOT NULL, nicht nur Whitespace (`btrim(text) <> ''`) |

Höchstens eine Notiz je `(user_id, song_id)` (`UNIQUE`). Die Band ergibt
sich aus dem Song; es gibt keine `band_id`-Spalte. Die Notiz-ID wird von
der API nicht zurückgegeben. Leerer oder nur aus Whitespace bestehender
Text wird nicht gespeichert: `PUT` mit solchem Text löscht eine vorhandene
Notiz.

Index auf `song_id` für das Cascade-Delete beim Song-Löschen. Der Unique-
Index auf `(user_id, song_id)` trägt Lookups der eigenen Notiz.

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

### Persönliche Song-Notiz

```text
{
  text: string
}
```

`GET` und `PUT` unter `/api/bands/{bandId}/songs/{songId}/note`.
`GET /api/bands/{bandId}/notes` liefert nur tatsächlich gespeicherte eigene
Notizen dieser Band (`songId`, `text`). Ohne gespeicherte Notiz ist der
songbezogene `GET` ein leerer String; der Bulk-`GET` enthält den Song dann
nicht. `PUT` sendet nur `text`. Ein leerer oder nur aus Whitespace bestehender
Text löscht die Notiz. `DELETE` entfernt sie ebenfalls. User-ID, Band-ID und
Song-ID kommen nicht aus dem Body.

---

## Browser-Speicher

PostgreSQL bleibt maßgeblich. `frontend/src/db.js` und `SongbookDB` sind
entfernt. Es gibt keine Migration historischer lokaler Songs oder Setlists.

Der Snapshot liegt in IndexedDB unter dem Namen `mysongbook-offline-snapshot`
(Schema-Version 1, Bibliothek `idb` 8). Stores:

| Store | Schlüssel | Inhalt |
|---|---|---|
| `bands` | `[userId, bandId]` | `name` der Band |
| `songs` | `[userId, bandId, songId]` | Titel, Interpret, ChordPro-`content` |
| `setlists` | `[userId, bandId, setlistId]` | Name und `songIds` in Reihenfolge, inklusive Duplikaten |
| `notes` | `[userId, bandId, songId]` | eigene gespeicherte Notiz |
| `meta` | `[userId, bandId]` | `refreshedAt` des letzten vollständigen Refreshs |

`userId` ist die interne My-Songbook-User-ID aus `GET /api/me`. Tokens,
OIDC-Daten und Notizen anderer User werden nicht gespeichert. Ein späteres
inkompatibles Schema verwirft den Cache. Logout löscht ihn nicht.

Weiterer Browser-Speicher:

| Speicher | Inhalt | Zweck |
|---|---|---|
| `localStorage` `mysongbook.activeBandId` | zuletzt gewählte Band-ID | UI-Kontext |
| `sessionStorage` `mysongbook.pendingInviteToken` | Einladungs-Token über den Login hinweg | Auth-/Einladungsfluss |
| OIDC-Bibliothek | Sitzungs-/Token-State | Authentifizierung |
| Cache API des Service Workers | gebaute JS-, CSS- und HTML-Dateien, Icons, Manifest | statische App-Shell der installierbaren PWA |

Der Service-Worker-Cache ist kein Musikspeicher und nicht maßgeblich.
`/api/**` wird dort nicht abgelegt. Access Tokens, Refresh Tokens und
OIDC-Antworten liegen nicht in diesem Cache. Die Online-UI liest den
IndexedDB-Snapshot nicht.

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
