package de.docfaust.mysongbook.api;

import java.time.Instant;
import java.util.UUID;

public record CreatedInvitationResponse(
        UUID id,
        UUID bandId,
        String token,
        Instant expiresAt,
        String inviteUrl) {
}
