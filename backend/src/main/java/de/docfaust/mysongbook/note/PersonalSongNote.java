package de.docfaust.mysongbook.note;

/**
 * The current user's note for one song.
 * {@code version} is {@code null} when no note is stored.
 */
public record PersonalSongNote(String text, Integer version) {

    public static PersonalSongNote empty() {
        return new PersonalSongNote("", null);
    }
}
