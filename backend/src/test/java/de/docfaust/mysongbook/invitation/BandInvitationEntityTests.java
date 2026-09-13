package de.docfaust.mysongbook.invitation;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BandInvitationEntityTests {

    @Test
    void statusPrefersAcceptedThenExpiredThenActive() {
        Instant now = Instant.parse("2026-08-29T12:00:00Z");
        BandInvitationEntity invitation = new BandInvitationEntity(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "hash",
                now.minusSeconds(60),
                now.plusSeconds(60),
                UUID.randomUUID());

        assertThat(invitation.statusAt(now)).isEqualTo(InvitationStatus.ACTIVE);
        assertThat(invitation.statusAt(now.plusSeconds(60))).isEqualTo(InvitationStatus.EXPIRED);

        invitation.markAccepted(now, UUID.randomUUID());
        assertThat(invitation.statusAt(now.plusSeconds(120))).isEqualTo(InvitationStatus.ACCEPTED);
        assertThat(invitation.getAcceptedAt()).isEqualTo(now);
        assertThat(invitation.getAcceptedBy()).isNotNull();
    }
}
