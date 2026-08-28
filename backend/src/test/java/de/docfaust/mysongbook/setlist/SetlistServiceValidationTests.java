package de.docfaust.mysongbook.setlist;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SetlistServiceValidationTests {

    @Test
    void normalizeNameTrimsAndRejectsBlankAndOverlong() {
        assertThat(SetlistService.normalizeName("  Gig  ")).isEqualTo("Gig");
        assertThatThrownBy(() -> SetlistService.normalizeName(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Setlist name must not be blank");
        assertThatThrownBy(() -> SetlistService.normalizeName("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Setlist name must not be blank");
        assertThatThrownBy(() -> SetlistService.normalizeName("x".repeat(201)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Setlist name is too long");
        assertThat(SetlistService.normalizeName("x".repeat(200))).hasSize(200);
    }

    @Test
    void requireSongIdsTreatsNullAsEmptyPreservesDuplicatesAndRejectsNullElements() {
        assertThat(SetlistService.requireSongIds(null)).isEmpty();
        UUID songId = UUID.randomUUID();
        List<UUID> original = new ArrayList<>();
        original.add(songId);
        original.add(songId);
        assertThat(SetlistService.requireSongIds(original)).containsExactly(songId, songId);
        original.add(null);
        assertThatThrownBy(() -> SetlistService.requireSongIds(original))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Setlist song id must not be null");
    }

    @Test
    void requireExpectedVersionRejectsNullAndNegative() {
        SetlistService.requireExpectedVersion(0);
        SetlistService.requireExpectedVersion(3);
        assertThatThrownBy(() -> SetlistService.requireExpectedVersion(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Setlist version is required");
        assertThatThrownBy(() -> SetlistService.requireExpectedVersion(-1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Setlist version is invalid");
    }
}
