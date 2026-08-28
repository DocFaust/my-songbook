package de.docfaust.mysongbook.api;

public record UpdateSongRequest(String title, String artist, String content, Integer version) {
}
