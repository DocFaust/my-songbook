package de.docfaust.mysongbook.note;

public record PersonalSongNote(String text) {

    public static PersonalSongNote empty() {
        return new PersonalSongNote("");
    }
}
