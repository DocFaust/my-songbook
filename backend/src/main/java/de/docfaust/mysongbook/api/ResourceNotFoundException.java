package de.docfaust.mysongbook.api;

public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException() {
        super("Not found");
    }
}
