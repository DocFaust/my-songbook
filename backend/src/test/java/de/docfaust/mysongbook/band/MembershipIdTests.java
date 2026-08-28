package de.docfaust.mysongbook.band;

import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MembershipIdTests {

    @Test
    void equalsAndHashCodeUseBandAndUserIdentity() {
        UUID bandId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        MembershipId id = new MembershipId(bandId, userId);
        MembershipId same = new MembershipId(bandId, userId);
        MembershipId otherBand = new MembershipId(UUID.randomUUID(), userId);
        MembershipId otherUser = new MembershipId(bandId, UUID.randomUUID());

        assertThat(id).isEqualTo(id);
        assertThat(id).isEqualTo(same);
        assertThat(id).hasSameHashCodeAs(same);
        assertThat(id).isNotEqualTo(otherBand);
        assertThat(id).isNotEqualTo(otherUser);
        assertThat(id).isNotEqualTo(null);
        assertThat(id).isNotEqualTo(bandId);
        assertThat(id.getBandId()).isEqualTo(bandId);
        assertThat(id.getUserId()).isEqualTo(userId);
    }

    @Test
    void settersUpdateCompositeIdentityUsedByJpa() {
        UUID bandId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        MembershipId id = new MembershipId();
        id.setBandId(bandId);
        id.setUserId(userId);

        assertThat(id).isEqualTo(new MembershipId(bandId, userId));
        assertThat(id).hasSameHashCodeAs(new MembershipId(bandId, userId));
    }
}
