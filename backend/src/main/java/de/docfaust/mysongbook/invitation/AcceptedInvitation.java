package de.docfaust.mysongbook.invitation;

import java.util.UUID;

import de.docfaust.mysongbook.band.MembershipRole;

public record AcceptedInvitation(UUID bandId, String bandName, MembershipRole role) {
}
