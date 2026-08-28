-- Band-scoped Setlist (Step 6).
-- A Setlist belongs to exactly one Band. Optimistic locking uses version.
-- Entries may repeat the same Song; order is (setlist_id, position).
-- Deleting a Setlist removes its entries (ON DELETE CASCADE).
-- Deleting a Song removes matching entries; Setlists remain.

CREATE TABLE setlists (
    id UUID PRIMARY KEY,
    band_id UUID NOT NULL REFERENCES bands (id),
    name VARCHAR(200) NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_setlists_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT chk_setlists_version_non_negative CHECK (version >= 0)
);

CREATE INDEX idx_setlists_band_id ON setlists (band_id);

CREATE TABLE setlist_entries (
    id UUID PRIMARY KEY,
    setlist_id UUID NOT NULL REFERENCES setlists (id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    CONSTRAINT chk_setlist_entries_position_non_negative CHECK (position >= 0),
    CONSTRAINT uq_setlist_entries_setlist_id_position UNIQUE (setlist_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_setlist_entries_song_id ON setlist_entries (song_id);
