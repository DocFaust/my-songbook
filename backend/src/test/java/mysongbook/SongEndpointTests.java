package mysongbook;

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

import mysongbook.band.MembershipRole;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import({ PostgresTestcontainersConfiguration.class, TestJwtDecoderConfiguration.class })
class SongEndpointTests {

    private static final ParameterizedTypeReference<Map<String, Object>> OBJECT =
            new ParameterizedTypeReference<>() {
            };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> OBJECT_LIST =
            new ParameterizedTypeReference<>() {
            };
    private static final String CHORDPRO = "{title: Wonderwall}\n{artist: Oasis}\n\n[Em7]Today";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void unauthenticatedListReturns401() {
        ResponseEntity<String> response = restTemplate.getForEntity(
                "/api/bands/" + UUID.randomUUID() + "/songs",
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unauthenticatedCreateReturns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/songs",
                HttpMethod.POST,
                new HttpEntity<>(createBody("Title", "Artist", CHORDPRO), headers),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unauthenticatedUpdateReturns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/songs/" + UUID.randomUUID(),
                HttpMethod.PUT,
                new HttpEntity<>(updateBody("Title", "Artist", CHORDPRO, 0), headers),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unauthenticatedDeleteReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/songs/" + UUID.randomUUID() + "?version=0",
                HttpMethod.DELETE,
                new HttpEntity<>(new HttpHeaders()),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void everyRoleCanListAndRead(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "read-" + role.name().toLowerCase());
        Map<String, Object> created = createSong(actor.ownerSubject(), actor.bandId(), "Readable", "Artist", CHORDPRO)
                .getBody();
        assertThat(created).isNotNull();
        String songId = created.get("id").toString();

        ResponseEntity<List<Map<String, Object>>> list = listSongs(actor.subject(), actor.bandId());
        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(list.getBody()).extracting(song -> song.get("id").toString()).containsExactly(songId);

        ResponseEntity<Map<String, Object>> read = getSong(actor.subject(), actor.bandId(), songId);
        assertThat(read.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(read.getBody()).containsEntry("title", "Readable");
        assertThat(read.getBody()).containsEntry("content", CHORDPRO);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN", "MEMBER" })
    void ownerAdminMemberCanCreate(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "create-" + role.name().toLowerCase());
        ResponseEntity<Map<String, Object>> response = createSong(
                actor.subject(),
                actor.bandId(),
                "Created by " + role,
                "Artist",
                CHORDPRO);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("title", "Created by " + role);
        assertThat(response.getBody().get("bandId").toString()).isEqualTo(actor.bandId().toString());
    }

    @Test
    void guestCannotCreate() {
        RoleActor guest = actorWithRole(MembershipRole.GUEST, "guest-create");
        ResponseEntity<String> response = createSongRaw(
                guest.subject(),
                guest.bandId(),
                createBody("Nope", "Artist", CHORDPRO));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(countSongs(guest.bandId())).isEqualTo(0);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN", "MEMBER" })
    void ownerAdminMemberCanUpdate(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "update-" + role.name().toLowerCase());
        Map<String, Object> created = createSong(actor.ownerSubject(), actor.bandId(), "Before", "A", CHORDPRO).getBody();
        ResponseEntity<Map<String, Object>> updated = updateSong(
                actor.subject(),
                actor.bandId(),
                created.get("id").toString(),
                "After " + role,
                "B",
                "{title: After}",
                0);
        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("title", "After " + role);
        assertThat(updated.getBody()).containsEntry("version", 1);
    }

    @Test
    void guestCannotUpdate() {
        RoleActor guest = actorWithRole(MembershipRole.GUEST, "guest-update");
        Map<String, Object> created = createSong(guest.ownerSubject(), guest.bandId(), "Locked", "A", CHORDPRO).getBody();
        ResponseEntity<String> response = updateSongRaw(
                guest.subject(),
                guest.bandId(),
                created.get("id").toString(),
                updateBody("Hacked", "B", "{title: Hacked}", 0));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(getSong(guest.ownerSubject(), guest.bandId(), created.get("id").toString()).getBody())
                .containsEntry("title", "Locked")
                .containsEntry("version", 0);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN" })
    void ownerAndAdminCanDelete(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "delete-" + role.name().toLowerCase());
        Map<String, Object> created = createSong(actor.ownerSubject(), actor.bandId(), "Remove me", "A", CHORDPRO)
                .getBody();
        ResponseEntity<String> deleted = deleteSong(
                actor.subject(),
                actor.bandId(),
                created.get("id").toString(),
                0);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getSong(actor.ownerSubject(), actor.bandId(), created.get("id").toString()).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "MEMBER", "GUEST" })
    void memberAndGuestCannotDelete(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "nodelete-" + role.name().toLowerCase());
        Map<String, Object> created = createSong(actor.ownerSubject(), actor.bandId(), "Keep me", "A", CHORDPRO)
                .getBody();
        ResponseEntity<String> response = deleteSong(
                actor.subject(),
                actor.bandId(),
                created.get("id").toString(),
                0);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(getSong(actor.ownerSubject(), actor.bandId(), created.get("id").toString()).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void createStoresNormalizedFieldsGeneratedIdAndInitialVersion() {
        String subject = "song-create-fields";
        UUID bandId = createOwnedBand(subject, "Field Band");
        String content = "{title: Wonderwall}\n[Em7]Today is gonna be the day";
        ResponseEntity<Map<String, Object>> response = createSong(
                subject,
                bandId,
                "  Wonderwall  ",
                "  Oasis  ",
                content);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        UUID songId = UUID.fromString(body.get("id").toString());
        assertThat(body.get("bandId").toString()).isEqualTo(bandId.toString());
        assertThat(body).containsEntry("title", "Wonderwall");
        assertThat(body).containsEntry("artist", "Oasis");
        assertThat(body).containsEntry("content", content);
        assertThat(body).containsEntry("version", 0);

        Map<String, Object> stored = jdbcTemplate.queryForMap(
                "SELECT band_id, title, artist, content, version FROM songs WHERE id = ?",
                songId);
        assertThat(stored.get("band_id")).isEqualTo(bandId);
        assertThat(stored.get("title")).isEqualTo("Wonderwall");
        assertThat(stored.get("artist")).isEqualTo("Oasis");
        assertThat(stored.get("content")).isEqualTo(content);
        assertThat(stored.get("version")).isEqualTo(0);
    }

    @Test
    void createAllowsBlankArtist() {
        String subject = "song-blank-artist";
        UUID bandId = createOwnedBand(subject, "Artist Band");
        ResponseEntity<Map<String, Object>> response = createSong(subject, bandId, "Untitled", "   ", CHORDPRO);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("artist", "");
    }

    @Test
    void blankTitleReturns400() {
        String subject = "song-blank-title";
        UUID bandId = createOwnedBand(subject, "Validation Band");
        ResponseEntity<String> response = createSongRaw(subject, bandId, createBody("   ", "Artist", CHORDPRO));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(countSongs(bandId)).isEqualTo(0);
    }

    @Test
    void overlongTitleReturns400() {
        String subject = "song-long-title";
        UUID bandId = createOwnedBand(subject, "Validation Band");
        ResponseEntity<String> response = createSongRaw(
                subject,
                bandId,
                createBody("x".repeat(201), "Artist", CHORDPRO));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(countSongs(bandId)).isEqualTo(0);
    }

    @Test
    void missingContentReturns400() {
        String subject = "song-missing-content";
        UUID bandId = createOwnedBand(subject, "Validation Band");
        ResponseEntity<String> response = createSongRaw(
                subject,
                bandId,
                "{\"title\":\"Has Title\",\"artist\":\"Artist\"}");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(countSongs(bandId)).isEqualTo(0);
    }

    @Test
    void blankContentReturns400() {
        String subject = "song-blank-content";
        UUID bandId = createOwnedBand(subject, "Validation Band");
        ResponseEntity<String> response = createSongRaw(subject, bandId, createBody("Title", "Artist", "   "));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(countSongs(bandId)).isEqualTo(0);
    }

    @Test
    void overlongArtistReturns400() {
        String subject = "song-long-artist";
        UUID bandId = createOwnedBand(subject, "Validation Band");
        ResponseEntity<String> response = createSongRaw(
                subject,
                bandId,
                createBody("Title", "y".repeat(201), CHORDPRO));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void updateWithoutVersionReturns400() {
        String subject = "song-update-no-version";
        UUID bandId = createOwnedBand(subject, "Version Band");
        Map<String, Object> created = createSong(subject, bandId, "Needs Version", "A", CHORDPRO).getBody();
        ResponseEntity<String> response = updateSongRaw(
                subject,
                bandId,
                created.get("id").toString(),
                createBody("Changed", "A", CHORDPRO));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(getSong(subject, bandId, created.get("id").toString()).getBody())
                .containsEntry("title", "Needs Version")
                .containsEntry("version", 0);
    }

    @Test
    void updateChangesFieldsIncrementsVersionAndKeepsBand() {
        String subject = "song-update-fields";
        UUID bandId = createOwnedBand(subject, "Update Band");
        Map<String, Object> created = createSong(subject, bandId, "Before", "Old Artist", CHORDPRO).getBody();
        String songId = created.get("id").toString();
        String updatedContent = "{title: After}\n[C]Hello";

        ResponseEntity<Map<String, Object>> updated = updateSong(
                subject,
                bandId,
                songId,
                "  After  ",
                "  New Artist  ",
                updatedContent,
                0);

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("title", "After");
        assertThat(updated.getBody()).containsEntry("artist", "New Artist");
        assertThat(updated.getBody()).containsEntry("content", updatedContent);
        assertThat(updated.getBody()).containsEntry("version", 1);
        assertThat(updated.getBody().get("bandId").toString()).isEqualTo(bandId.toString());
        assertThat(updated.getBody().get("id").toString()).isEqualTo(songId);
    }

    @Test
    void staleUpdateReturns409AndLeavesServerStateUnchanged() {
        String subject = "song-stale-update";
        UUID bandId = createOwnedBand(subject, "Lock Band");
        Map<String, Object> created = createSong(subject, bandId, "Original", "A", CHORDPRO).getBody();
        String songId = created.get("id").toString();
        assertThat(created).containsEntry("version", 0);

        String winnerContent = "{title: Winner}";
        ResponseEntity<Map<String, Object>> winner = updateSong(
                subject,
                bandId,
                songId,
                "Winner",
                "B",
                winnerContent,
                0);
        assertThat(winner.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(winner.getBody()).containsEntry("version", 1);

        ResponseEntity<String> stale = updateSongRaw(
                subject,
                bandId,
                songId,
                updateBody("Stale", "C", "{title: Stale}", 0));
        assertThat(stale.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(stale.getBody()).contains("stale version");

        ResponseEntity<Map<String, Object>> reloaded = getSong(subject, bandId, songId);
        assertThat(reloaded.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reloaded.getBody()).containsEntry("title", "Winner");
        assertThat(reloaded.getBody()).containsEntry("artist", "B");
        assertThat(reloaded.getBody()).containsEntry("content", winnerContent);
        assertThat(reloaded.getBody()).containsEntry("version", 1);
    }

    @Test
    void concurrentUpdatesWithSameVersionYieldOneSuccessAndOneConflict() throws Exception {
        String subject = "song-concurrent-update";
        UUID bandId = createOwnedBand(subject, "Concurrent Band");
        Map<String, Object> created = createSong(subject, bandId, "Race", "A", CHORDPRO).getBody();
        String songId = created.get("id").toString();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<ResponseEntity<String>> responses = new CopyOnWriteArrayList<>();
        List<Future<?>> futures = new ArrayList<>();
        try {
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(updateSongRaw(
                        subject,
                        bandId,
                        songId,
                        updateBody("First", "A", "{title: First}", 0)));
                return null;
            }));
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(updateSongRaw(
                        subject,
                        bandId,
                        songId,
                        updateBody("Second", "A", "{title: Second}", 0)));
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

        Map<String, Object> stored = getSong(subject, bandId, songId).getBody();
        assertThat(stored).containsEntry("version", 1);
        assertThat(stored.get("title")).isIn("First", "Second");
    }

    @Test
    void staleDeleteReturns409ThenCurrentVersionDeletes() {
        String subject = "song-stale-delete";
        UUID bandId = createOwnedBand(subject, "Delete Lock Band");
        Map<String, Object> created = createSong(subject, bandId, "Doomed", "A", CHORDPRO).getBody();
        String songId = created.get("id").toString();

        ResponseEntity<Map<String, Object>> updated = updateSong(
                subject,
                bandId,
                songId,
                "Doomed",
                "A",
                "{title: Doomed v2}",
                0);
        assertThat(updated.getBody()).containsEntry("version", 1);

        ResponseEntity<String> stale = deleteSong(subject, bandId, songId, 0);
        assertThat(stale.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(getSong(subject, bandId, songId).getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> deleted = deleteSong(subject, bandId, songId, 1);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getSong(subject, bandId, songId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countSongs(bandId)).isEqualTo(0);
    }

    @Test
    void deleteWithoutVersionReturns400() {
        String subject = "song-delete-no-version";
        UUID bandId = createOwnedBand(subject, "Delete Band");
        Map<String, Object> created = createSong(subject, bandId, "Needs Version", "A", CHORDPRO).getBody();
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + created.get("id"),
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(countSongs(bandId)).isEqualTo(1);
    }

    @Test
    void memberOfBandACannotAccessBandBSongs() {
        String subjectA = "song-tenant-a";
        String subjectB = "song-tenant-b";
        UUID bandA = createOwnedBand(subjectA, "Band A");
        UUID bandB = createOwnedBand(subjectB, "Band B");
        Map<String, Object> songA = createSong(subjectA, bandA, "Song A", "A", "{title: A}").getBody();
        Map<String, Object> songB = createSong(subjectB, bandB, "Song B", "B", "{title: B}").getBody();
        String songBId = songB.get("id").toString();

        assertThat(listSongsRaw(subjectA, bandB).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(getSong(subjectA, bandB, songBId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(updateSongRaw(subjectA, bandB, songBId, updateBody("Hacked", "X", "{title: Hacked}", 0))
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(deleteSong(subjectA, bandB, songBId, 0).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        assertThat(getSong(subjectA, bandA, songBId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(updateSongRaw(subjectA, bandA, songBId, updateBody("Hacked", "X", "{title: Hacked}", 0))
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(deleteSong(subjectA, bandA, songBId, 0).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);

        List<Map<String, Object>> listA = listSongs(subjectA, bandA).getBody();
        assertThat(listA).extracting(song -> song.get("id").toString())
                .containsExactly(songA.get("id").toString())
                .doesNotContain(songBId);

        assertThat(getSong(subjectB, bandB, songBId).getBody()).containsEntry("title", "Song B");
        assertThat(getSong(subjectB, bandB, songBId).getBody()).containsEntry("content", "{title: B}");
    }

    @Test
    void memberOfBothBandsSeesOnlySongsOfRequestedBand() {
        String subject = "song-two-bands-member";
        UUID bandA = createOwnedBand(subject, "Shared User A");
        UUID bandB = createOwnedBand("song-two-bands-other", "Shared User B");
        addMember(bandB, subject, MembershipRole.MEMBER);
        createSong(subject, bandA, "Only A", "A", "{title: A}");
        Map<String, Object> songB = createSong("song-two-bands-other", bandB, "Only B", "B", "{title: B}").getBody();

        List<Map<String, Object>> listA = listSongs(subject, bandA).getBody();
        List<Map<String, Object>> listB = listSongs(subject, bandB).getBody();
        assertThat(listA).extracting(song -> song.get("title")).containsExactly("Only A");
        assertThat(listB).extracting(song -> song.get("title")).containsExactly("Only B");
        assertThat(getSong(subject, bandA, songB.get("id").toString()).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void nonMemberCannotCreateInForeignBand() {
        UUID bandB = createOwnedBand("song-foreign-owner", "Foreign Band");
        ResponseEntity<String> response = createSongRaw(
                "song-foreign-stranger",
                bandB,
                createBody("Nope", "X", CHORDPRO));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countSongs(bandB)).isEqualTo(0);
    }

    @Test
    void songWithoutBandIsRejectedByForeignKey() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO songs (id, band_id, title, artist, content, version)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Orphan",
                "",
                CHORDPRO,
                0))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void createRequestBandIdInBodyDoesNotOverrideUrlBand() {
        String subject = "song-ignore-body-band";
        UUID bandA = createOwnedBand(subject, "Body Band A");
        UUID bandB = createOwnedBand("song-ignore-body-other", "Body Band B");
        String json = "{\"title\":\"Scoped\",\"artist\":\"A\",\"content\":" + quote(CHORDPRO)
                + ",\"bandId\":\"" + bandB + "\"}";
        ResponseEntity<Map<String, Object>> created = restTemplate.exchange(
                "/api/bands/" + bandA + "/songs",
                HttpMethod.POST,
                jsonEntity(subject, json),
                OBJECT);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody().get("bandId").toString()).isEqualTo(bandA.toString());
        assertThat(countSongs(bandB)).isEqualTo(0);
    }

    @Test
    void preflightPutAndDeleteFromAllowedOriginReceiveCorsHeaders() {
        HttpHeaders putHeaders = new HttpHeaders();
        putHeaders.setOrigin("http://localhost:5173");
        putHeaders.setAccessControlRequestMethod(HttpMethod.PUT);
        putHeaders.add(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type");
        ResponseEntity<String> put = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/songs/" + UUID.randomUUID(),
                HttpMethod.OPTIONS,
                new HttpEntity<>(putHeaders),
                String.class);
        assertThat(put.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(put.getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:5173");
        assertThat(put.getHeaders().getAccessControlAllowMethods()).contains(HttpMethod.PUT);

        HttpHeaders deleteHeaders = new HttpHeaders();
        deleteHeaders.setOrigin("http://localhost:5173");
        deleteHeaders.setAccessControlRequestMethod(HttpMethod.DELETE);
        deleteHeaders.add(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization");
        ResponseEntity<String> delete = restTemplate.exchange(
                "/api/bands/" + UUID.randomUUID() + "/songs/" + UUID.randomUUID(),
                HttpMethod.OPTIONS,
                new HttpEntity<>(deleteHeaders),
                String.class);
        assertThat(delete.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(delete.getHeaders().getAccessControlAllowOrigin()).isEqualTo("http://localhost:5173");
        assertThat(delete.getHeaders().getAccessControlAllowMethods()).contains(HttpMethod.DELETE);
    }

    private RoleActor actorWithRole(MembershipRole role, String suffix) {
        String ownerSubject = "song-owner-" + suffix;
        UUID bandId = createOwnedBand(ownerSubject, "Role Band " + suffix);
        if (role == MembershipRole.OWNER) {
            return new RoleActor(ownerSubject, ownerSubject, bandId);
        }
        String actorSubject = "song-actor-" + suffix;
        addMember(bandId, actorSubject, role);
        return new RoleActor(actorSubject, ownerSubject, bandId);
    }

    private UUID createOwnedBand(String subject, String name) {
        Map<String, Object> band = createBand(subject, name).getBody();
        assertThat(band).isNotNull();
        return UUID.fromString(band.get("id").toString());
    }

    private void addMember(UUID bandId, String subject, MembershipRole role) {
        restTemplate.exchange("/api/me", HttpMethod.GET, authenticated(subject), String.class);
        jdbcTemplate.update(
                "INSERT INTO memberships (band_id, user_id, role) VALUES (?, ?, ?)",
                bandId,
                userId(subject),
                role.name());
    }

    private ResponseEntity<Map<String, Object>> createBand(String subject, String name) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands",
                HttpMethod.POST,
                new HttpEntity<>("{\"name\":\"" + name + "\"}", headers),
                OBJECT);
    }

    private ResponseEntity<Map<String, Object>> createSong(
            String subject,
            UUID bandId,
            String title,
            String artist,
            String content) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs",
                HttpMethod.POST,
                jsonEntity(subject, createBody(title, artist, content)),
                OBJECT);
    }

    private ResponseEntity<String> createSongRaw(String subject, UUID bandId, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs",
                HttpMethod.POST,
                new HttpEntity<>(json, headers),
                String.class);
    }

    private ResponseEntity<List<Map<String, Object>>> listSongs(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs",
                HttpMethod.GET,
                authenticated(subject),
                OBJECT_LIST);
    }

    private ResponseEntity<String> listSongsRaw(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs",
                HttpMethod.GET,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<Map<String, Object>> getSong(String subject, UUID bandId, String songId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId,
                HttpMethod.GET,
                authenticated(subject),
                OBJECT);
    }

    private ResponseEntity<Map<String, Object>> updateSong(
            String subject,
            UUID bandId,
            String songId,
            String title,
            String artist,
            String content,
            int version) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId,
                HttpMethod.PUT,
                jsonEntity(subject, updateBody(title, artist, content, version)),
                OBJECT);
    }

    private ResponseEntity<String> updateSongRaw(String subject, UUID bandId, String songId, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId,
                HttpMethod.PUT,
                new HttpEntity<>(json, headers),
                String.class);
    }

    private ResponseEntity<String> deleteSong(String subject, UUID bandId, String songId, int version) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId + "?version=" + version,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private Integer countSongs(UUID bandId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM songs WHERE band_id = ?",
                Integer.class,
                bandId);
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

    private static String createBody(String title, String artist, String content) {
        return "{\"title\":" + quote(title)
                + ",\"artist\":" + quote(artist)
                + ",\"content\":" + quote(content) + "}";
    }

    private static String updateBody(String title, String artist, String content, int version) {
        return "{\"title\":" + quote(title)
                + ",\"artist\":" + quote(artist)
                + ",\"content\":" + quote(content)
                + ",\"version\":" + version + "}";
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    private record RoleActor(String subject, String ownerSubject, UUID bandId) {
    }
}
