package de.docfaust.mysongbook.invitation;

import java.time.Instant;
import java.util.UUID;

public record InvitationView(
        UUID id,
        Instant createdAt,
        Instant expiresAt,
        InvitationStatus status) {
}
