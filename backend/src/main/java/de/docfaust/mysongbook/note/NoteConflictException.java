package de.docfaust.mysongbook.note;

/**
 * The conditional note change did not match the server state.
 * {@code text} and {@code version} describe the current server note when one exists.
 */
public class NoteConflictException extends RuntimeException {

    private final String code;
    private final String text;
    private final Integer version;

    public NoteConflictException(String code, String text, Integer version) {
        super("stale version");
        this.code = code;
        this.text = text;
        this.version = version;
    }

    public String getCode() {
        return code;
    }

    public String getText() {
        return text;
    }

    public Integer getVersion() {
        return version;
    }
}
