-- Band-scoped Song (Step 5).
-- A Song belongs to exactly one Band. Optimistic locking uses version.
-- Dependent PersonalSongNote / Setlist-entry cascade is not implemented
-- here; those tables do not exist yet. Song delete removes only the Song.

CREATE TABLE songs (
    id UUID PRIMARY KEY,
    band_id UUID NOT NULL REFERENCES bands (id),
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_songs_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT chk_songs_content_not_blank CHECK (btrim(content) <> ''),
    CONSTRAINT chk_songs_version_non_negative CHECK (version >= 0)
);

CREATE INDEX idx_songs_band_id ON songs (band_id);
