package de.docfaust.mysongbook.band;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

@Entity
@Table(name = "memberships")
@IdClass(MembershipId.class)
public class MembershipEntity {

    @Id
    @Column(name = "band_id", nullable = false)
    private UUID bandId;

    @Id
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, columnDefinition = "TEXT")
    private MembershipRole role;

    protected MembershipEntity() {
    }

    public MembershipEntity(UUID bandId, UUID userId, MembershipRole role) {
        this.bandId = bandId;
        this.userId = userId;
        this.role = role;
    }

    public Membership toDomain() {
        return new Membership(bandId, userId, role);
    }

    public UUID getBandId() {
        return bandId;
    }

    public UUID getUserId() {
        return userId;
    }

    public MembershipRole getRole() {
        return role;
    }

    public void setRole(MembershipRole role) {
        this.role = role;
    }
}
