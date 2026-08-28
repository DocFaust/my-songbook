package de.docfaust.mysongbook.user;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class UserEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "external_subject", nullable = false, unique = true, columnDefinition = "TEXT")
    private String externalSubject;

    protected UserEntity() {
    }

    public UserEntity(UUID id, String externalSubject) {
        this.id = id;
        this.externalSubject = externalSubject;
    }

    public User toDomain() {
        return new User(id, externalSubject);
    }

    public UUID getId() {
        return id;
    }

    public String getExternalSubject() {
        return externalSubject;
    }
}
