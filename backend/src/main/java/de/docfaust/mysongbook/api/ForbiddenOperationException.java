package de.docfaust.mysongbook.api;

public class ForbiddenOperationException extends RuntimeException {

    public ForbiddenOperationException() {
        super("Forbidden");
    }
}
