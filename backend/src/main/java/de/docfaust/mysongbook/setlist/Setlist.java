package de.docfaust.mysongbook.setlist;

import java.util.List;
import java.util.UUID;

public record Setlist(
        UUID id,
        UUID bandId,
        String name,
        List<UUID> songIds,
        int version) {
}
