package de.docfaust.mysongbook.note;

/**
 * The note cannot be read or changed because the membership or the song is gone.
 * {@code code} is {@code membership} or {@code song}.
 */
public class NoteUnavailableException extends RuntimeException {

    private final String code;

    public NoteUnavailableException(String code) {
        super("Not found");
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
