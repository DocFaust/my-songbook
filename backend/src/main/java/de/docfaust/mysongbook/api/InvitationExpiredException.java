package de.docfaust.mysongbook.api;

public class InvitationExpiredException extends RuntimeException {

    public InvitationExpiredException() {
        super("Invitation expired");
    }
}
