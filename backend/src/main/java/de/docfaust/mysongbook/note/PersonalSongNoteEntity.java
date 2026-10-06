package de.docfaust.mysongbook.note;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "personal_song_notes")
public class PersonalSongNoteEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "song_id", nullable = false)
    private UUID songId;

    @Column(name = "text", nullable = false, columnDefinition = "TEXT")
    private String text;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    protected PersonalSongNoteEntity() {
    }

    public PersonalSongNoteEntity(UUID id, UUID userId, UUID songId, String text) {
        this.id = id;
        this.userId = userId;
        this.songId = songId;
        this.text = text;
        this.version = 0;
    }

    public PersonalSongNote toDomain() {
        return new PersonalSongNote(text, version);
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getSongId() {
        return songId;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public int getVersion() {
        return version;
    }
}
