package de.docfaust.mysongbook.invitation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InvitationTokensTests {

    @Test
    void generatesDistinctUrlSafeTokensAndHashesThem() {
        String first = InvitationTokens.generateRawToken();
        String second = InvitationTokens.generateRawToken();

        assertThat(first).isNotBlank().isNotEqualTo(second);
        assertThat(first).doesNotContain("+", "/", "=");
        assertThat(InvitationTokens.hash(first))
                .hasSize(64)
                .isNotEqualTo(first)
                .isEqualTo(InvitationTokens.hash(first))
                .isNotEqualTo(InvitationTokens.hash(second));
    }
}
