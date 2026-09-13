package de.docfaust.mysongbook.api;

import java.util.UUID;

import de.docfaust.mysongbook.band.MembershipRole;

public record AcceptedInvitationResponse(UUID bandId, String bandName, MembershipRole role) {
}
