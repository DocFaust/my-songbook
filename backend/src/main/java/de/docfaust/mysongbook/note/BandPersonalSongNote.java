package de.docfaust.mysongbook.note;

import java.util.UUID;

/**
 * One stored personal note of the current user inside a single band.
 * Notes that were never saved are absent, not returned as empty text.
 */
public record BandPersonalSongNote(UUID songId, String text, int version) {
}
