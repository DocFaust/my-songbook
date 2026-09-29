package de.docfaust.mysongbook;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "GUEST", "MEMBER", "ADMIN" })
    void ownerTransfersOwnershipToGuestMemberOrAdmin(MembershipRole targetRole) {
        String suffix = "transfer-" + targetRole.name().toLowerCase();
        RoleActor owner = actorWithRole(MembershipRole.OWNER, suffix);
        addMember(owner.bandId(), suffix + "-target", targetRole);
        UUID targetId = userId(suffix + "-target");

        ResponseEntity<Map<String, Object>> response = transfer(owner.subject(), owner.bandId(), targetId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsKeys("newOwner", "previousOwner");
        assertThat(memberMap(response.getBody(), "newOwner"))
                .containsEntry("userId", targetId.toString())
                .containsEntry("role", "OWNER");
        assertThat(memberMap(response.getBody(), "previousOwner"))
                .containsEntry("userId", userId(owner.subject()).toString())
                .containsEntry("role", "ADMIN");
        assertThat(memberRole(owner.bandId(), suffix + "-target")).isEqualTo("OWNER");
        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("ADMIN");
        assertThat(countOwners(owner.bandId())).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "ADMIN", "MEMBER", "GUEST" })
    void onlyOwnerCanTransferOwnership(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "transfer-forbidden-" + role.name().toLowerCase());
        addMember(actor.bandId(), actor.suffix() + "-target", MembershipRole.MEMBER);
        UUID targetId = userId(actor.suffix() + "-target");

        ResponseEntity<String> response = transferRaw(actor.subject(), actor.bandId(), targetId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(memberRole(actor.bandId(), actor.ownerSubject())).isEqualTo("OWNER");
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-target")).isEqualTo("MEMBER");
        assertThat(countOwners(actor.bandId())).isEqualTo(1);
    }

    @Test
    void ownershipTransferRejectsSelfMissingAndForeignTargets() {
        RoleActor owner = actorWithRole(MembershipRole.OWNER, "transfer-invalid");
        addMember(owner.bandId(), "transfer-invalid-member", MembershipRole.MEMBER);
        UUID bandB = createOwnedBand("transfer-invalid-other-owner", "Transfer Other");
        addMember(bandB, "transfer-invalid-foreign", MembershipRole.ADMIN);
        UUID foreignId = userId("transfer-invalid-foreign");

        ResponseEntity<String> self = transferRaw(owner.subject(), owner.bandId(), userId(owner.subject()));
        assertThat(self.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(self.getBody()).contains("Ownership cannot be transferred to yourself");

        ResponseEntity<String> missing = transferRaw(owner.subject(), owner.bandId(), UUID.randomUUID());
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(missing.getBody()).contains("Not found");

        ResponseEntity<String> foreign = transferRaw(owner.subject(), owner.bandId(), foreignId);
        assertThat(foreign.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(foreign.getBody()).contains("Not found").doesNotContain(bandB.toString());
        assertThat(memberRole(bandB, "transfer-invalid-foreign")).isEqualTo("ADMIN");
        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("OWNER");
        assertThat(countOwners(owner.bandId())).isEqualTo(1);
        assertThat(countOwners(bandB)).isEqualTo(1);
    }

    @Test
    void ownershipTransferRequiresATargetMember() {
        RoleActor owner = actorWithRole(MembershipRole.OWNER, "transfer-empty");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + owner.bandId() + "/ownership-transfer",
                HttpMethod.POST,
                jsonEntity(owner.subject(), "{}"),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("Target member is required");
        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("OWNER");
        assertThat(countOwners(owner.bandId())).isEqualTo(1);
    }

    @Test
    void unauthenticatedOwnershipTransferReturns401() {
        ResponseEntity<String> response = restTemplate.postForEntity(
                "/api/bands/" + UUID.randomUUID() + "/ownership-transfer",
                "{\"userId\":\"" + UUID.randomUUID() + "\"}",
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void strangerCannotTransferOwnershipOfAnotherBand() {
        UUID bandA = createOwnedBand("transfer-stranger-a", "Transfer Stranger A");
        String ownerB = "transfer-stranger-b";
        createOwnedBand(ownerB, "Transfer Stranger B");
        addMember(bandA, "transfer-stranger-target", MembershipRole.MEMBER);

        ResponseEntity<String> response = transferRaw(
                ownerB,
                bandA,
                userId("transfer-stranger-target"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).doesNotContain("transfer-stranger-target");
        assertThat(memberRole(bandA, "transfer-stranger-a")).isEqualTo("OWNER");
        assertThat(countOwners(bandA)).isEqualTo(1);
    }

    @Test
    void normalRoleChangeAndRemovalStillCannotChangeOwner() {
        RoleActor owner = actorWithRole(MembershipRole.OWNER, "transfer-immutable");
        addMember(owner.bandId(), "transfer-immutable-target", MembershipRole.MEMBER);
        transfer(owner.subject(), owner.bandId(), userId("transfer-immutable-target"));

        ResponseEntity<String> demote = updateRoleRaw(
                "transfer-immutable-target",
                owner.bandId(),
                userId("transfer-immutable-target"),
                "{\"role\":\"ADMIN\"}");
        ResponseEntity<String> promote = updateRoleRaw(
                "transfer-immutable-target",
                owner.bandId(),
                userId(owner.subject()),
                "{\"role\":\"OWNER\"}");
        ResponseEntity<String> remove = removeMember(
                owner.subject(),
                owner.bandId(),
                userId("transfer-immutable-target"));

        assertThat(demote.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(promote.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(remove.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(memberRole(owner.bandId(), "transfer-immutable-target")).isEqualTo("OWNER");
        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("ADMIN");
        assertThat(countOwners(owner.bandId())).isEqualTo(1);
    }

    @Test
    void concurrentOwnershipTransfersKeepExactlyOneOwner() throws Exception {
        RoleActor owner = actorWithRole(MembershipRole.OWNER, "transfer-race");
        addMember(owner.bandId(), "transfer-race-guest", MembershipRole.GUEST);
        addMember(owner.bandId(), "transfer-race-member", MembershipRole.MEMBER);
        UUID guestId = userId("transfer-race-guest");
        UUID memberId = userId("transfer-race-member");

        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Future<ResponseEntity<String>> first = pool.submit(
                    () -> transferRaw(owner.subject(), owner.bandId(), guestId));
            Future<ResponseEntity<String>> second = pool.submit(
                    () -> transferRaw(owner.subject(), owner.bandId(), memberId));
            ResponseEntity<String> left = first.get(20, TimeUnit.SECONDS);
            ResponseEntity<String> right = second.get(20, TimeUnit.SECONDS);
            List<Integer> statuses = new ArrayList<>();
            statuses.add(left.getStatusCode().value());
            statuses.add(right.getStatusCode().value());
            assertThat(statuses).contains(HttpStatus.OK.value(), HttpStatus.FORBIDDEN.value());
        } finally {
            pool.shutdownNow();
        }

        assertThat(countOwners(owner.bandId())).isEqualTo(1);
        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("ADMIN");
        int newOwnerCount = ownerCountAmong(
                owner.bandId(),
                "transfer-race-guest",
                "transfer-race-member");
        assertThat(newOwnerCount).isEqualTo(1);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "ADMIN", "MEMBER", "GUEST" })
    void memberCanLeaveVoluntarily(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "leave-" + role.name().toLowerCase());
        addMember(actor.bandId(), actor.suffix() + "-other", MembershipRole.MEMBER);
        UUID songId = UUID.randomUUID();
        UUID setlistId = UUID.randomUUID();
        jdbcTemplate.update(
                "INSERT INTO songs (id, band_id, title, artist, content, version) VALUES (?, ?, 'Titel', 'Artist', 'Inhalt', 0)",
                songId,
                actor.bandId());
        jdbcTemplate.update(
                "INSERT INTO setlists (id, band_id, name, version) VALUES (?, ?, 'Probe', 0)",
                setlistId,
                actor.bandId());

        ResponseEntity<String> response = leave(actor.subject(), actor.bandId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(membershipCount(actor.bandId(), actor.subject())).isZero();
        assertThat(memberRole(actor.bandId(), actor.ownerSubject())).isEqualTo("OWNER");
        assertThat(memberRole(actor.bandId(), actor.suffix() + "-other")).isEqualTo("MEMBER");
        assertThat(countOwners(actor.bandId())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bands WHERE id = ?",
                Integer.class,
                actor.bandId())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM songs WHERE id = ? AND band_id = ?",
                Integer.class,
                songId,
                actor.bandId())).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM setlists WHERE id = ? AND band_id = ?",
                Integer.class,
                setlistId,
                actor.bandId())).isEqualTo(1);
    }

    @Test
    void ownerCannotLeave() {
        RoleActor owner = actorWithRole(MembershipRole.OWNER, "leave-owner");

        ResponseEntity<String> response = leave(owner.subject(), owner.bandId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("OWNER cannot leave the band");
        assertThat(memberRole(owner.bandId(), owner.subject())).isEqualTo("OWNER");
        assertThat(countOwners(owner.bandId())).isEqualTo(1);
    }

    @Test
    void leaveRemovesOnlyTheAuthenticatedMembership() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "leave-self");
        addMember(member.bandId(), "leave-self-peer", MembershipRole.GUEST);

        ResponseEntity<String> response = leave(member.subject(), member.bandId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(membershipCount(member.bandId(), member.subject())).isZero();
        assertThat(memberRole(member.bandId(), member.ownerSubject())).isEqualTo("OWNER");
        assertThat(memberRole(member.bandId(), "leave-self-peer")).isEqualTo("GUEST");
    }

    @Test
    void leaveIsTenantIsolated() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "leave-iso");
        UUID otherBand = createOwnedBand("leave-iso-other", "Leave Other");

        ResponseEntity<String> foreign = leave(member.subject(), otherBand);
        ResponseEntity<String> stranger = leave("leave-iso-other", member.bandId());

        assertThat(foreign.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(stranger.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(memberRole(member.bandId(), member.subject())).isEqualTo("MEMBER");
        assertThat(memberRole(otherBand, "leave-iso-other")).isEqualTo("OWNER");
    }

    @Test
    void unauthenticatedLeaveReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/members/me",
                HttpMethod.DELETE,
                new HttpEntity<>(new HttpHeaders()),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
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

    private ResponseEntity<Map<String, Object>> transfer(String subject, UUID bandId, UUID targetUserId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/ownership-transfer",
                HttpMethod.POST,
                jsonEntity(subject, "{\"userId\":\"" + targetUserId + "\"}"),
                OBJECT);
    }

    private ResponseEntity<String> transferRaw(String subject, UUID bandId, UUID targetUserId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/ownership-transfer",
                HttpMethod.POST,
                jsonEntity(subject, "{\"userId\":\"" + targetUserId + "\"}"),
                String.class);
    }

    private ResponseEntity<String> leave(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/members/me",
                HttpMethod.DELETE,
                authenticated(subject),
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

    private Integer membershipCount(UUID bandId, String subject) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memberships WHERE band_id = ? AND user_id = ?",
                Integer.class,
                bandId,
                userId(subject));
    }

    private int ownerCountAmong(UUID bandId, String... subjects) {
        int owners = 0;
        for (String subject : subjects) {
            if ("OWNER".equals(memberRole(bandId, subject))) {
                owners++;
            }
        }
        return owners;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> memberMap(Map<String, Object> body, String field) {
        return (Map<String, Object>) body.get(field);
    }

    private record RoleActor(String subject, String ownerSubject, UUID bandId, String suffix) {
    }
}
