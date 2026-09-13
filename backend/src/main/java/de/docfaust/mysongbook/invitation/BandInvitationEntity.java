package de.docfaust.mysongbook.invitation;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "band_invitations")
public class BandInvitationEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "band_id", nullable = false)
    private UUID bandId;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "accepted_by")
    private UUID acceptedBy;

    protected BandInvitationEntity() {
    }

    public BandInvitationEntity(
            UUID id,
            UUID bandId,
            String tokenHash,
            Instant createdAt,
            Instant expiresAt,
            UUID createdBy) {
        this.id = id;
        this.bandId = bandId;
        this.tokenHash = tokenHash;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.createdBy = createdBy;
    }

    public UUID getId() {
        return id;
    }

    public UUID getBandId() {
        return bandId;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public UUID getAcceptedBy() {
        return acceptedBy;
    }

    public void markAccepted(Instant acceptedAt, UUID acceptedBy) {
        this.acceptedAt = acceptedAt;
        this.acceptedBy = acceptedBy;
    }

    public InvitationStatus statusAt(Instant now) {
        if (acceptedAt != null) {
            return InvitationStatus.ACCEPTED;
        }
        if (!expiresAt.isAfter(now)) {
            return InvitationStatus.EXPIRED;
        }
        return InvitationStatus.ACTIVE;
    }
}
