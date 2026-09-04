package de.docfaust.mysongbook.band;

import java.util.UUID;

public record BandMember(UUID userId, String displayName, MembershipRole role) {
}
