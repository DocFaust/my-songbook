-- Optimistic locking for personal song notes (Step 12C).
-- Existing rows start at version 0, matching songs and setlists.

ALTER TABLE personal_song_notes
    ADD COLUMN version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE personal_song_notes
    ADD CONSTRAINT chk_personal_song_notes_version_non_negative CHECK (version >= 0);
