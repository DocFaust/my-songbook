package de.docfaust.mysongbook.band;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class MembershipId implements Serializable {

    private static final long serialVersionUID = 1L;

    private UUID bandId;
    private UUID userId;

    public MembershipId() {
    }

    public MembershipId(UUID bandId, UUID userId) {
        this.bandId = bandId;
        this.userId = userId;
    }

    public UUID getBandId() {
        return bandId;
    }

    public void setBandId(UUID bandId) {
        this.bandId = bandId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof MembershipId that)) {
            return false;
        }
        return Objects.equals(bandId, that.bandId) && Objects.equals(userId, that.userId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(bandId, userId);
    }
}
