package de.docfaust.mysongbook.api;

import java.util.List;
import java.util.UUID;

public record UpdateSetlistRequest(String name, List<UUID> songIds, Integer version) {
}
