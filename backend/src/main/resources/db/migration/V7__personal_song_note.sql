-- Personal song note (Step 11).
-- At most one note per user and song. The song determines the band.
-- Deleting a song removes its notes. Blank text is not stored.

CREATE TABLE personal_song_notes (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id),
    song_id UUID NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    CONSTRAINT uq_personal_song_notes_user_id_song_id UNIQUE (user_id, song_id),
    CONSTRAINT chk_personal_song_notes_text_not_blank CHECK (btrim(text) <> '')
);

CREATE INDEX idx_personal_song_notes_song_id ON personal_song_notes (song_id);
