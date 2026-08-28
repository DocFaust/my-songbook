package de.docfaust.mysongbook.setlist;

import java.util.List;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "setlists")
public class SetlistEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "band_id", nullable = false)
    private UUID bandId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Version
    @Column(name = "version", nullable = false)
    private int version;

    protected SetlistEntity() {
    }

    public SetlistEntity(UUID id, UUID bandId, String name, int version) {
        this.id = id;
        this.bandId = bandId;
        this.name = name;
        this.version = version;
    }

    public Setlist toDomain(List<UUID> songIds) {
        return new Setlist(id, bandId, name, List.copyOf(songIds), version);
    }

    public UUID getId() {
        return id;
    }

    public UUID getBandId() {
        return bandId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getVersion() {
        return version;
    }
}
