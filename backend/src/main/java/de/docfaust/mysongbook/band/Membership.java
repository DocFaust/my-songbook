package de.docfaust.mysongbook.band;

import java.util.UUID;

public record Membership(UUID bandId, UUID userId, MembershipRole role) {
}
