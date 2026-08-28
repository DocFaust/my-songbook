package de.docfaust.mysongbook.song;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "songs")
public class SongEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "band_id", nullable = false)
    private UUID bandId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "artist", nullable = false, length = 200)
    private String artist;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    protected SongEntity() {
    }

    public SongEntity(UUID id, UUID bandId, String title, String artist, String content, int version) {
        this.id = id;
        this.bandId = bandId;
        this.title = title;
        this.artist = artist;
        this.content = content;
        this.version = version;
    }

    public Song toDomain() {
        return new Song(id, bandId, title, artist, content, version);
    }

    public UUID getId() {
        return id;
    }

    public UUID getBandId() {
        return bandId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getArtist() {
        return artist;
    }

    public void setArtist(String artist) {
        this.artist = artist;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public int getVersion() {
        return version;
    }
}
