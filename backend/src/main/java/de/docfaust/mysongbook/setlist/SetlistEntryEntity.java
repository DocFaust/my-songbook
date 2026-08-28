package de.docfaust.mysongbook.setlist;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "setlist_entries")
public class SetlistEntryEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "setlist_id", nullable = false)
    private UUID setlistId;

    @Column(name = "song_id", nullable = false)
    private UUID songId;

    @Column(name = "position", nullable = false)
    private int position;

    protected SetlistEntryEntity() {
    }

    public SetlistEntryEntity(UUID id, UUID setlistId, UUID songId, int position) {
        this.id = id;
        this.setlistId = setlistId;
        this.songId = songId;
        this.position = position;
    }

    public UUID getId() {
        return id;
    }

    public UUID getSetlistId() {
        return setlistId;
    }

    public UUID getSongId() {
        return songId;
    }

    public int getPosition() {
        return position;
    }
}
