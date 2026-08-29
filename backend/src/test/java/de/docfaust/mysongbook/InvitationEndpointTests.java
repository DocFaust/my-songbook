package de.docfaust.mysongbook;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.invitation.InvitationService;

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
class InvitationEndpointTests {

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
    void unauthenticatedCreateReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/invitations",
                HttpMethod.POST,
                new HttpEntity<>(new HttpHeaders()),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unauthenticatedAcceptReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/invitations/not-a-real-token/accept",
                HttpMethod.POST,
                new HttpEntity<>(new HttpHeaders()),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN" })
    void ownerAndAdminCanCreateInvitation(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "invite-create-" + role.name().toLowerCase());
        ResponseEntity<Map<String, Object>> response = createInvitation(actor.subject(), actor.bandId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        String token = body.get("token").toString();
        assertThat(token).isNotBlank().hasSizeGreaterThan(20);
        assertThat(body.get("bandId").toString()).isEqualTo(actor.bandId().toString());
        assertThat(body.get("inviteUrl").toString()).endsWith("/invite/" + token);
        assertThat(body.get("id")).isNotNull();

        Instant expiresAt = Instant.parse(body.get("expiresAt").toString());
        Instant createdAt = jdbcTemplate.queryForObject(
                "SELECT created_at FROM band_invitations WHERE id = ?",
                Timestamp.class,
                UUID.fromString(body.get("id").toString())).toInstant();
        assertThat(Duration.between(createdAt, expiresAt).abs().minus(InvitationService.VALIDITY).abs())
                .isLessThan(Duration.ofSeconds(2));

        String storedHash = jdbcTemplate.queryForObject(
                "SELECT token_hash FROM band_invitations WHERE id = ?",
                String.class,
                UUID.fromString(body.get("id").toString()));
        assertThat(storedHash).isNotBlank().hasSize(64).isNotEqualTo(token);
        Integer rawMatches = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM band_invitations
                WHERE id = ? AND (
                    CAST(id AS TEXT) = ? OR token_hash = ? OR CAST(created_by AS TEXT) = ?
                )
                """,
                Integer.class,
                UUID.fromString(body.get("id").toString()),
                token,
                token,
                token);
        assertThat(rawMatches).isZero();
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "MEMBER", "GUEST" })
    void memberAndGuestCannotCreateInvitation(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "invite-forbidden-" + role.name().toLowerCase());
        ResponseEntity<String> response = createInvitationRaw(actor.subject(), actor.bandId());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(countInvitations(actor.bandId())).isZero();
    }

    @Test
    void strangerCannotCreateInvitation() {
        String owner = "invite-stranger-owner";
        UUID bandId = createOwnedBand(owner, "Invite Stranger Band");
        ResponseEntity<String> response = createInvitationRaw("invite-stranger", bandId);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countInvitations(bandId)).isZero();
    }

    @Test
    void ownerAndAdminCanListInvitationsWithoutRawToken() {
        RoleActor admin = actorWithRole(MembershipRole.ADMIN, "invite-list-admin");
        Map<String, Object> created = createInvitation(admin.subject(), admin.bandId()).getBody();
        assertThat(created).isNotNull();
        String token = created.get("token").toString();

        ResponseEntity<List<Map<String, Object>>> listed = listInvitations(admin.subject(), admin.bandId());
        assertThat(listed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(listed.getBody()).hasSize(1);
        assertThat(listed.getBody().get(0)).containsEntry("status", "ACTIVE");
        assertThat(listed.getBody().get(0)).containsKeys("id", "createdAt", "expiresAt");
        assertThat(listed.getBody().get(0)).doesNotContainKey("token");
        assertThat(listed.getBody().get(0).values()).doesNotContain(token);
    }

    @Test
    void memberCannotListInvitations() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "invite-list-member");
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + member.bandId() + "/invitations",
                HttpMethod.GET,
                authenticated(member.subject()),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void acceptCreatesGuestMembershipAndConsumesInvitation() {
        String owner = "invite-accept-owner";
        UUID bandId = createOwnedBand(owner, "Accept Band");
        Map<String, Object> created = createInvitation(owner, bandId).getBody();
        String token = created.get("token").toString();

        ResponseEntity<Map<String, Object>> accepted = acceptInvitation("invite-accept-guest", token);
        assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accepted.getBody()).containsEntry("bandName", "Accept Band");
        assertThat(accepted.getBody()).containsEntry("role", "GUEST");
        assertThat(accepted.getBody().get("bandId").toString()).isEqualTo(bandId.toString());

        assertThat(memberRole(bandId, "invite-accept-guest")).isEqualTo("GUEST");
        assertThat(invitationStatus(UUID.fromString(created.get("id").toString()))).isEqualTo("ACCEPTED");
    }

    @Test
    void unknownTokenIsRejected() {
        ResponseEntity<String> response = acceptInvitationRaw("invite-unknown", "unknown-token-value");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void expiredInvitationIsRejected() {
        String owner = "invite-expired-owner";
        UUID bandId = createOwnedBand(owner, "Expired Band");
        Map<String, Object> created = createInvitation(owner, bandId).getBody();
        UUID invitationId = UUID.fromString(created.get("id").toString());
        Instant now = Instant.now();
        jdbcTemplate.update(
                "UPDATE band_invitations SET created_at = ?, expires_at = ? WHERE id = ?",
                Timestamp.from(now.minus(Duration.ofDays(15))),
                Timestamp.from(now.minus(Duration.ofMinutes(1))),
                invitationId);

        ResponseEntity<String> response = acceptInvitationRaw("invite-expired-user", created.get("token").toString());
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(countMemberships(bandId)).isEqualTo(1);
    }

    @Test
    void acceptedInvitationCannotCreateDuplicateMembership() {
        String owner = "invite-dup-owner";
        UUID bandId = createOwnedBand(owner, "Dup Band");
        Map<String, Object> created = createInvitation(owner, bandId).getBody();
        String token = created.get("token").toString();

        assertThat(acceptInvitation("invite-dup-first", token).getStatusCode()).isEqualTo(HttpStatus.OK);
        ResponseEntity<String> second = acceptInvitationRaw("invite-dup-second", token);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(countMemberships(bandId)).isEqualTo(2);
        assertThat(memberRole(bandId, "invite-dup-first")).isEqualTo("GUEST");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memberships WHERE band_id = ? AND user_id = ?",
                Integer.class,
                bandId,
                userId("invite-dup-second"))).isZero();
    }

    @Test
    void existingMemberAcceptingInviteIsNotDowngraded() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "invite-keep-member");
        Map<String, Object> created = createInvitation(member.ownerSubject(), member.bandId()).getBody();

        ResponseEntity<Map<String, Object>> accepted = acceptInvitation(member.subject(), created.get("token").toString());
        assertThat(accepted.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(accepted.getBody()).containsEntry("role", "MEMBER");
        assertThat(memberRole(member.bandId(), member.subject())).isEqualTo("MEMBER");
        assertThat(countMemberships(member.bandId())).isEqualTo(2);
    }

    @Test
    void sameUserCanAcceptUsedInvitationIdempotently() {
        String owner = "invite-idem-owner";
        UUID bandId = createOwnedBand(owner, "Idem Band");
        Map<String, Object> created = createInvitation(owner, bandId).getBody();
        String token = created.get("token").toString();

        assertThat(acceptInvitation("invite-idem-guest", token).getStatusCode()).isEqualTo(HttpStatus.OK);
        ResponseEntity<Map<String, Object>> again = acceptInvitation("invite-idem-guest", token);
        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(again.getBody()).containsEntry("role", "GUEST");
        assertThat(countMemberships(bandId)).isEqualTo(2);
    }

    @Test
    void concurrentAcceptCannotCreateDuplicateMembership() throws Exception {
        String owner = "invite-race-owner";
        UUID bandId = createOwnedBand(owner, "Race Band");
        Map<String, Object> created = createInvitation(owner, bandId).getBody();
        String token = created.get("token").toString();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<ResponseEntity<String>> responses = new CopyOnWriteArrayList<>();
        List<Future<?>> futures = new ArrayList<>();
        try {
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(acceptInvitationRaw("invite-race-a", token));
                return null;
            }));
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(acceptInvitationRaw("invite-race-b", token));
                return null;
            }));
            start.countDown();
            for (Future<?> future : futures) {
                future.get(15, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(responses).hasSize(2);
        assertThat(responses).extracting(ResponseEntity::getStatusCode)
                .containsExactlyInAnyOrder(HttpStatus.OK, HttpStatus.CONFLICT);
        assertThat(countMemberships(bandId)).isEqualTo(2);
    }

    @Test
    void ownerCanRevokeUnusedInvitationAndAcceptedRevokeDoesNotRemoveMembership() {
        String owner = "invite-revoke-owner";
        UUID bandId = createOwnedBand(owner, "Revoke Band");
        Map<String, Object> unused = createInvitation(owner, bandId).getBody();
        Map<String, Object> used = createInvitation(owner, bandId).getBody();
        acceptInvitation("invite-revoke-guest", used.get("token").toString());

        ResponseEntity<String> revoked = revokeInvitation(
                owner,
                bandId,
                UUID.fromString(unused.get("id").toString()));
        assertThat(revoked.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(acceptInvitationRaw("invite-revoke-late", unused.get("token").toString()).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);

        ResponseEntity<String> acceptedRevoke = revokeInvitation(
                owner,
                bandId,
                UUID.fromString(used.get("id").toString()));
        assertThat(acceptedRevoke.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(memberRole(bandId, "invite-revoke-guest")).isEqualTo("GUEST");
    }

    @Test
    void cannotRevokeInvitationOfAnotherBand() {
        String ownerA = "invite-cross-a";
        String ownerB = "invite-cross-b";
        UUID bandA = createOwnedBand(ownerA, "Cross A");
        UUID bandB = createOwnedBand(ownerB, "Cross B");
        Map<String, Object> invitation = createInvitation(ownerA, bandA).getBody();

        ResponseEntity<String> response = revokeInvitation(
                ownerB,
                bandB,
                UUID.fromString(invitation.get("id").toString()));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countInvitations(bandA)).isEqualTo(1);
    }

    private RoleActor actorWithRole(MembershipRole role, String suffix) {
        String ownerSubject = suffix + "-owner";
        UUID bandId = createOwnedBand(ownerSubject, "Invite " + suffix);
        if (role == MembershipRole.OWNER) {
            return new RoleActor(ownerSubject, ownerSubject, bandId);
        }
        String subject = suffix + "-actor";
        addMember(bandId, subject, role);
        return new RoleActor(subject, ownerSubject, bandId);
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

    private ResponseEntity<Map<String, Object>> createInvitation(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/invitations",
                HttpMethod.POST,
                authenticated(subject),
                OBJECT);
    }

    private ResponseEntity<String> createInvitationRaw(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/invitations",
                HttpMethod.POST,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<List<Map<String, Object>>> listInvitations(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/invitations",
                HttpMethod.GET,
                authenticated(subject),
                OBJECT_LIST);
    }

    private ResponseEntity<Map<String, Object>> acceptInvitation(String subject, String token) {
        return restTemplate.exchange(
                "/api/invitations/" + token + "/accept",
                HttpMethod.POST,
                authenticated(subject),
                OBJECT);
    }

    private ResponseEntity<String> acceptInvitationRaw(String subject, String token) {
        return restTemplate.exchange(
                "/api/invitations/" + token + "/accept",
                HttpMethod.POST,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<String> revokeInvitation(String subject, UUID bandId, UUID invitationId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/invitations/" + invitationId,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private HttpEntity<Void> authenticated(String subject) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        return new HttpEntity<>(headers);
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

    private String invitationStatus(UUID invitationId) {
        Instant acceptedAt = jdbcTemplate.queryForObject(
                "SELECT accepted_at FROM band_invitations WHERE id = ?",
                Instant.class,
                invitationId);
        return acceptedAt == null ? "ACTIVE" : "ACCEPTED";
    }

    private Integer countInvitations(UUID bandId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM band_invitations WHERE band_id = ?",
                Integer.class,
                bandId);
    }

    private Integer countMemberships(UUID bandId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM memberships WHERE band_id = ?",
                Integer.class,
                bandId);
    }

    private record RoleActor(String subject, String ownerSubject, UUID bandId) {
    }
}
