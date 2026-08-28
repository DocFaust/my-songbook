package de.docfaust.mysongbook.api;

import java.util.List;
import java.util.UUID;

public record CreateSetlistRequest(String name, List<UUID> songIds) {
}
