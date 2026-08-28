package de.docfaust.mysongbook.song;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SongRepository {

    private final JdbcTemplate jdbcTemplate;

    public SongRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(Song song) {
        jdbcTemplate.update(
                """
                INSERT INTO songs (id, band_id, title, artist, content, version)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                song.id(),
                song.bandId(),
                song.title(),
                song.artist(),
                song.content(),
                song.version());
    }

    public List<Song> findByBandId(UUID bandId) {
        return jdbcTemplate.query(
                """
                SELECT id, band_id, title, artist, content, version
                FROM songs
                WHERE band_id = ?
                ORDER BY title, id
                """,
                SongRepository::mapSong,
                bandId);
    }

    public Optional<Song> findByBandIdAndId(UUID bandId, UUID songId) {
        return jdbcTemplate.query(
                """
                SELECT id, band_id, title, artist, content, version
                FROM songs
                WHERE band_id = ? AND id = ?
                """,
                SongRepository::mapSong,
                bandId,
                songId)
                .stream()
                .findFirst();
    }

    public Optional<Song> updateIfVersionMatches(
            UUID bandId,
            UUID songId,
            String title,
            String artist,
            String content,
            int expectedVersion) {
        return jdbcTemplate.query(
                """
                UPDATE songs
                SET title = ?, artist = ?, content = ?, version = version + 1
                WHERE id = ? AND band_id = ? AND version = ?
                RETURNING id, band_id, title, artist, content, version
                """,
                SongRepository::mapSong,
                title,
                artist,
                content,
                songId,
                bandId,
                expectedVersion)
                .stream()
                .findFirst();
    }

    public int deleteIfVersionMatches(UUID bandId, UUID songId, int expectedVersion) {
        return jdbcTemplate.update(
                "DELETE FROM songs WHERE id = ? AND band_id = ? AND version = ?",
                songId,
                bandId,
                expectedVersion);
    }

    private static Song mapSong(ResultSet rs, int rowNum) throws SQLException {
        return new Song(
                rs.getObject("id", UUID.class),
                rs.getObject("band_id", UUID.class),
                rs.getString("title"),
                rs.getString("artist"),
                rs.getString("content"),
                rs.getInt("version"));
    }
}
