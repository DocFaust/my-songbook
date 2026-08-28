package de.docfaust.mysongbook.setlist;

public class StaleSetlistVersionException extends RuntimeException {

    public StaleSetlistVersionException() {
        super("stale version");
    }
}
