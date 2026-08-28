package de.docfaust.mysongbook.song;

import java.util.UUID;

public record Song(
        UUID id,
        UUID bandId,
        String title,
        String artist,
        String content,
        int version) {
}
