package de.docfaust.mysongbook.band;

import java.util.UUID;

public record UserBand(UUID id, String name, MembershipRole role) {
}
