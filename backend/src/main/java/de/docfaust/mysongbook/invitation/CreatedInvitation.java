package de.docfaust.mysongbook.invitation;

import java.time.Instant;
import java.util.UUID;

public record CreatedInvitation(UUID id, UUID bandId, String token, Instant expiresAt) {
}
