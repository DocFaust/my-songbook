package de.docfaust.mysongbook;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import de.docfaust.mysongbook.band.MembershipRole;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import({ PostgresTestcontainersConfiguration.class, TestJwtDecoderConfiguration.class })
class MembershipEndpointTests {

    private static final ParameterizedTypeReference<Map<String, Object>> OBJECT =
            new ParameterizedTypeReference<>() {
            };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> OBJECT_LIST =
            new ParameterizedTypeReference<>() {
            };

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void unauthenticatedMemberListReturns401() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/bands/" + UUID.randomUUID() + "/members",
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void everyRoleCanReadMemberList(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "members-read-" + role.name().toLowerCase());
        ResponseEntity<List<Map<String, Object>>> response = listMembers(actor.subject(), actor.bandId());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).extracting(member -> member.get("role").toString())
                .contains("OWNER", role.name());
        assertThat(response.getBody()).allSatisfy(member -> {
            assertThat(member).containsKeys("userId", "displayName", "role");
            assertThat(member).doesNotContainKeys("externalSubject", "token");
        });
    }

    @Test
    void memberListIsTenantIsolated() {
        String ownerA = "members-iso-a";
        String ownerB = "members-iso-b";
        UUID bandA = createOwnedBand(ownerA, "Iso A");
        UUID bandB = createOwnedBand(ownerB, "Iso B");
        addMember(bandA, "members-iso-guest-a", MembershipRole.GUEST);

        ResponseEntity<List<Map<String, Object>>> listed = listMembers(ownerA, bandA);
        assertThat(listed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listed.getBody()).extracting(member -> member.get("userId").toString())
                .containsExactlyInAnyOrder(userId(ownerA).toString(), userId("members-iso-guest-a").toString())
                .doesNotContain(userId(ownerB).toString());

        ResponseEntity<String> stranger = listMembersRaw(ownerB, bandA);
        assertThat(stranger.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN" })
    void ownerAndAdminCanChangeAssignableRoles(MembershipRole actorRole) {
        RoleActor actor = actorWithRole(actorRole, "role-change-" + actorRole.name().toLowerCase());
        addMember(actor.bandId(), actor.suffix() + "-target", MembershipRole.GUEST);
        UUID targetId = userId(actor.suffix() + "-target");

        ResponseEntity<Map<String, Object>> toMember = updateRole(
                actor.subject(),
                actor.bandId(),
                targetId,
                "MEMBER");
        assertThat(toMember.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(toMember.getBody()).containsEntry("role", "MEMBER");
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-target")).isEqualTo("MEMBER");

        ResponseEntity<Map<String, Object>> toAdmin = updateRole(
                actor.subject(),
                actor.bandId(),
                targetId,
                "ADMIN");
        assertThat(toAdmin.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-target")).isEqualTo("ADMIN");

        ResponseEntity<Map<String, Object>> toGuest = updateRole(
                actor.subject(),
                actor.bandId(),
                targetId,
                "GUEST");
        assertThat(toGuest.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-target")).isEqualTo("GUEST");
    }

    @Test
    void adminCanDemoteAnotherAdmin() {
        RoleActor admin = actorWithRole(MembershipRole.ADMIN, "admin-demote");
        addMember(admin.bandId(), "admin-demote-peer", MembershipRole.ADMIN);

        ResponseEntity<Map<String, Object>> response = updateRole(
                admin.subject(),
                admin.bandId(),
                userId("admin-demote-peer"),
                "MEMBER");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(memberRole(admin.bandId(), "admin-demote-peer")).isEqualTo("MEMBER");
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "MEMBER", "GUEST" })
    void memberAndGuestCannotManageRoles(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "role-forbidden-" + role.name().toLowerCase());
        addMember(actor.bandId(), actor.suffix() + "-target", MembershipRole.GUEST);

        ResponseEntity<String> response = updateRoleRaw(
                actor.subject(),
                actor.bandId(),
                userId(actor.suffix() + "-target"),
                "{\"role\":\"MEMBER\"}");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-target")).isEqualTo("GUEST");
    }

    @Test
    void ownerCannotBeDemotedOrPromotedOver() {
        RoleActor owner = actorWithRole(MembershipRole.OWNER, "owner-immutable");
        addMember(owner.bandId(), "owner-immutable-admin", MembershipRole.ADMIN);

        ResponseEntity<String> demoteOwner = updateRoleRaw(
                owner.subject(),
                owner.bandId(),
                userId(owner.subject()),
                "{\"role\":\"ADMIN\"}");
        assertThat(demoteOwner.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<String> promoteToOwner = updateRoleRaw(
                owner.subject(),
                owner.bandId(),
                userId("owner-immutable-admin"),
                "{\"role\":\"OWNER\"}");
        assertThat(promoteToOwner.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        ResponseEntity<String> invalid = updateRoleRaw(
                owner.subject(),
                owner.bandId(),
                userId("owner-immutable-admin"),
                "{\"role\":\"LEADER\"}");
        assertThat(invalid.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("OWNER");
        assertThat(memberRole(owner.bandId(), "owner-immutable-admin")).isEqualTo("ADMIN");
        assertThat(countOwners(owner.bandId())).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN" })
    void ownerAndAdminCanRemoveNonOwners(MembershipRole actorRole) {
        RoleActor actor = actorWithRole(actorRole, "remove-" + actorRole.name().toLowerCase());
        addMember(actor.bandId(), actor.suffix() + "-target", MembershipRole.ADMIN);

        ResponseEntity<String> response = removeMember(
                actor.subject(),
                actor.bandId(),
                userId(actor.suffix() + "-target"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memberships WHERE band_id = ? AND user_id = ?",
                Integer.class,
                actor.bandId(),
                userId(actor.suffix() + "-target"))).isZero();
    }

    @Test
    void ownerCannotBeRemoved() {
        RoleActor admin = actorWithRole(MembershipRole.ADMIN, "remove-owner");
        ResponseEntity<String> response = removeMember(admin.subject(), admin.bandId(), userId(admin.ownerSubject()));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(memberRole(admin.bandId(), admin.ownerSubject())).isEqualTo("OWNER");
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "MEMBER", "GUEST" })
    void memberAndGuestCannotRemoveMembers(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "remove-forbidden-" + role.name().toLowerCase());
        addMember(actor.bandId(), actor.suffix() + "-target", MembershipRole.GUEST);

        ResponseEntity<String> response = removeMember(
                actor.subject(),
                actor.bandId(),
                userId(actor.suffix() + "-target"));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-target")).isEqualTo("GUEST");
    }

    @Test
    void crossBandMemberManipulationIsRejected() {
        String ownerA = "members-xband-a";
        String ownerB = "members-xband-b";
        UUID bandA = createOwnedBand(ownerA, "XBand A");
        UUID bandB = createOwnedBand(ownerB, "XBand B");
        addMember(bandA, "members-xband-guest", MembershipRole.GUEST);
        UUID guestId = userId("members-xband-guest");

        assertThat(updateRoleRaw(ownerB, bandB, guestId, "{\"role\":\"MEMBER\"}").getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(updateRoleRaw(ownerB, bandA, guestId, "{\"role\":\"MEMBER\"}").getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(removeMember(ownerB, bandB, guestId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(removeMember(ownerB, bandA, guestId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(memberRole(bandA, "members-xband-guest")).isEqualTo("GUEST");
    }

    private RoleActor actorWithRole(MembershipRole role, String suffix) {
        String ownerSubject = suffix + "-owner";
        UUID bandId = createOwnedBand(ownerSubject, "Members " + suffix);
        if (role == MembershipRole.OWNER) {
            return new RoleActor(ownerSubject, ownerSubject, bandId, suffix);
        }
        String subject = suffix + "-actor";
        addMember(bandId, subject, role);
        return new RoleActor(subject, ownerSubject, bandId, suffix);
    }

    private UUID createOwnedBand(String subject, String name) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                "/api/bands",
                HttpMethod.POST,
                new HttpEntity<>("{\"name\":\"" + name + "\"}", headers),
                OBJECT);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return UUID.fromString(response.getBody().get("id").toString());
    }

    private void addMember(UUID bandId, String subject, MembershipRole role) {
        restTemplate.exchange("/api/me", HttpMethod.GET, authenticated(subject), OBJECT);
        jdbcTemplate.update(
                "INSERT INTO memberships (band_id, user_id, role) VALUES (?, ?, ?)",
                bandId,
                userId(subject),
                role.name());
    }

    private ResponseEntity<List<Map<String, Object>>> listMembers(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/members",
                HttpMethod.GET,
                authenticated(subject),
                OBJECT_LIST);
    }

    private ResponseEntity<String> listMembersRaw(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/members",
                HttpMethod.GET,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<Map<String, Object>> updateRole(String subject, UUID bandId, UUID userId, String role) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/members/" + userId + "/role",
                HttpMethod.PUT,
                jsonEntity(subject, "{\"role\":\"" + role + "\"}"),
                OBJECT);
    }

    private ResponseEntity<String> updateRoleRaw(String subject, UUID bandId, UUID userId, String json) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/members/" + userId + "/role",
                HttpMethod.PUT,
                jsonEntity(subject, json),
                String.class);
    }

    private ResponseEntity<String> removeMember(String subject, UUID bandId, UUID userId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/members/" + userId,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private HttpEntity<Void> authenticated(String subject) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        return new HttpEntity<>(headers);
    }

    private HttpEntity<String> jsonEntity(String subject, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(json, headers);
    }

    private UUID userId(String subject) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE external_subject = ?",
                UUID.class,
                subject);
    }

    private String memberRole(UUID bandId, String subject) {
        return jdbcTemplate.queryForObject(
                "SELECT role FROM memberships WHERE band_id = ? AND user_id = ?",
                String.class,
                bandId,
                userId(subject));
    }

    private Integer countOwners(UUID bandId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memberships WHERE band_id = ? AND role = 'OWNER'",
                Integer.class,
                bandId);
    }

    private record RoleActor(String subject, String ownerSubject, UUID bandId, String suffix) {
    }
}
