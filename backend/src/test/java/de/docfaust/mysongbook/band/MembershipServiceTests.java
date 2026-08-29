package de.docfaust.mysongbook.band;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MembershipServiceTests {

    @Test
    void parseAssignableRoleAcceptsAdminMemberAndGuest() {
        assertThat(MembershipService.parseAssignableRole("ADMIN")).isEqualTo(MembershipRole.ADMIN);
        assertThat(MembershipService.parseAssignableRole(" MEMBER ")).isEqualTo(MembershipRole.MEMBER);
        assertThat(MembershipService.parseAssignableRole("GUEST")).isEqualTo(MembershipRole.GUEST);
    }

    @Test
    void parseAssignableRoleRejectsOwnerAndUnknownValues() {
        assertThatThrownBy(() -> MembershipService.parseAssignableRole("OWNER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("OWNER role cannot be assigned");
        assertThatThrownBy(() -> MembershipService.parseAssignableRole("LEADER"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid role");
        assertThatThrownBy(() -> MembershipService.parseAssignableRole(" "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid role");
        assertThatThrownBy(() -> MembershipService.parseAssignableRole(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid role");
    }
}
