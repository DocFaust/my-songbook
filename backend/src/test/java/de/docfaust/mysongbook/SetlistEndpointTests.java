package de.docfaust.mysongbook;

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
import java.util.stream.Collectors;

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
class SetlistEndpointTests {

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
                "/api/bands/" + UUID.randomUUID() + "/setlists",
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN", "MEMBER" })
    void ownerAdminMemberCanCreate(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "create-" + role.name().toLowerCase());
        String songId = createSong(actor.ownerSubject(), actor.bandId(), "Song", "A", CHORDPRO);

        ResponseEntity<Map<String, Object>> response = createSetlist(
                actor.subject(),
                actor.bandId(),
                "Created by " + role,
                List.of(songId));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("name", "Created by " + role);
        assertThat(response.getBody().get("bandId").toString()).isEqualTo(actor.bandId().toString());
        assertThat(songIds(response.getBody())).containsExactly(songId);
        assertThat(response.getBody()).containsEntry("version", 0);
    }

    @Test
    void guestCannotCreate() {
        RoleActor guest = actorWithRole(MembershipRole.GUEST, "guest-create");
        String songId = createSong(guest.ownerSubject(), guest.bandId(), "Song", "A", CHORDPRO);

        ResponseEntity<String> response = createSetlistRaw(
                guest.subject(),
                guest.bandId(),
                createBody("Nope", List.of(songId)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(countSetlists(guest.bandId())).isEqualTo(0);
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void everyRoleCanListAndRead(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "read-" + role.name().toLowerCase());
        String songId = createSong(actor.ownerSubject(), actor.bandId(), "Readable", "A", CHORDPRO);
        Map<String, Object> created = createSetlist(
                actor.ownerSubject(),
                actor.bandId(),
                "Readable Set",
                List.of(songId)).getBody();
        String setlistId = created.get("id").toString();

        ResponseEntity<List<Map<String, Object>>> list = listSetlists(actor.subject(), actor.bandId());
        assertThat(list.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(list.getBody()).extracting(setlist -> setlist.get("id").toString()).containsExactly(setlistId);

        ResponseEntity<Map<String, Object>> read = getSetlist(actor.subject(), actor.bandId(), setlistId);
        assertThat(read.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(read.getBody()).containsEntry("name", "Readable Set");
        assertThat(songIds(read.getBody())).containsExactly(songId);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN", "MEMBER" })
    void ownerAdminMemberCanUpdate(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "update-" + role.name().toLowerCase());
        String first = createSong(actor.ownerSubject(), actor.bandId(), "First", "A", CHORDPRO);
        String second = createSong(actor.ownerSubject(), actor.bandId(), "Second", "B", CHORDPRO);
        Map<String, Object> created = createSetlist(
                actor.ownerSubject(),
                actor.bandId(),
                "Before",
                List.of(first)).getBody();

        ResponseEntity<Map<String, Object>> updated = updateSetlist(
                actor.subject(),
                actor.bandId(),
                created.get("id").toString(),
                "After " + role,
                List.of(second, first),
                0);

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("name", "After " + role);
        assertThat(updated.getBody()).containsEntry("version", 1);
        assertThat(songIds(updated.getBody())).containsExactly(second, first);
    }

    @Test
    void guestCannotUpdate() {
        RoleActor guest = actorWithRole(MembershipRole.GUEST, "guest-update");
        String songId = createSong(guest.ownerSubject(), guest.bandId(), "Locked", "A", CHORDPRO);
        Map<String, Object> created = createSetlist(
                guest.ownerSubject(),
                guest.bandId(),
                "Locked",
                List.of(songId)).getBody();

        ResponseEntity<String> response = updateSetlistRaw(
                guest.subject(),
                guest.bandId(),
                created.get("id").toString(),
                updateBody("Hacked", List.of(songId), 0));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(getSetlist(guest.ownerSubject(), guest.bandId(), created.get("id").toString()).getBody())
                .containsEntry("name", "Locked")
                .containsEntry("version", 0);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN" })
    void ownerAndAdminCanDelete(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "delete-" + role.name().toLowerCase());
        Map<String, Object> created = createSetlist(
                actor.ownerSubject(),
                actor.bandId(),
                "Remove me",
                List.of()).getBody();

        ResponseEntity<String> deleted = deleteSetlist(
                actor.subject(),
                actor.bandId(),
                created.get("id").toString(),
                0);

        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getSetlist(actor.ownerSubject(), actor.bandId(), created.get("id").toString()).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "MEMBER", "GUEST" })
    void memberAndGuestCannotDelete(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "nodelete-" + role.name().toLowerCase());
        Map<String, Object> created = createSetlist(
                actor.ownerSubject(),
                actor.bandId(),
                "Keep me",
                List.of()).getBody();

        ResponseEntity<String> response = deleteSetlist(
                actor.subject(),
                actor.bandId(),
                created.get("id").toString(),
                0);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(getSetlist(actor.ownerSubject(), actor.bandId(), created.get("id").toString()).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }

    @Test
    void setlistBelongsToExactlyOneBand() {
        String subjectA = "setlist-one-band-a";
        String subjectB = "setlist-one-band-b";
        UUID bandA = createOwnedBand(subjectA, "Band A");
        UUID bandB = createOwnedBand(subjectB, "Band B");
        String songA = createSong(subjectA, bandA, "Song A", "A", CHORDPRO);

        Map<String, Object> created = createSetlist(subjectA, bandA, "Only A", List.of(songA)).getBody();
        assertThat(created.get("bandId").toString()).isEqualTo(bandA.toString());
        assertThat(getSetlist(subjectB, bandB, created.get("id").toString()).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(listSetlists(subjectB, bandB).getBody()).isEmpty();
    }

    @Test
    void userWithoutMembershipCannotReadSetlists() {
        UUID bandId = createOwnedBand("setlist-owner-private", "Private Band");
        createSetlist("setlist-owner-private", bandId, "Hidden", List.of());

        assertThat(listSetlistsRaw("setlist-stranger", bandId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countSetlists(bandId)).isEqualTo(1);
    }

    @Test
    void foreignBandSetlistIdIsInaccessible() {
        String subjectA = "setlist-tenant-a";
        String subjectB = "setlist-tenant-b";
        UUID bandA = createOwnedBand(subjectA, "Band A");
        UUID bandB = createOwnedBand(subjectB, "Band B");
        String songB = createSong(subjectB, bandB, "Song B", "B", CHORDPRO);
        Map<String, Object> setlistB = createSetlist(subjectB, bandB, "Set B", List.of(songB)).getBody();
        String setlistBId = setlistB.get("id").toString();

        assertThat(listSetlistsRaw(subjectA, bandB).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(getSetlist(subjectA, bandB, setlistBId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(getSetlist(subjectA, bandA, setlistBId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(updateSetlistRaw(subjectA, bandA, setlistBId, updateBody("Hacked", List.of(), 0)).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(deleteSetlist(subjectA, bandA, setlistBId, 0).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(getSetlist(subjectB, bandB, setlistBId).getBody()).containsEntry("name", "Set B");
    }

    @Test
    void emptySetlistIsAllowed() {
        String subject = "setlist-empty";
        UUID bandId = createOwnedBand(subject, "Empty Band");

        ResponseEntity<Map<String, Object>> created = createSetlist(subject, bandId, "Empty", List.of());

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(songIds(created.getBody())).isEmpty();
        assertThat(countEntries(UUID.fromString(created.getBody().get("id").toString()))).isEqualTo(0);
    }

    @Test
    void setlistPreservesSongOrderAndDuplicateIds() {
        String subject = "setlist-order-dup";
        UUID bandId = createOwnedBand(subject, "Order Band");
        String alpha = createSong(subject, bandId, "Alpha", "A", CHORDPRO);
        String bravo = createSong(subject, bandId, "Bravo", "B", CHORDPRO);
        List<String> requested = List.of(bravo, alpha, bravo, alpha);

        Map<String, Object> created = createSetlist(subject, bandId, "Gig", requested).getBody();
        assertThat(songIds(created)).containsExactlyElementsOf(requested);

        Map<String, Object> reloaded = getSetlist(subject, bandId, created.get("id").toString()).getBody();
        assertThat(songIds(reloaded)).containsExactlyElementsOf(requested);

        List<Map<String, Object>> stored = jdbcTemplate.queryForList(
                """
                SELECT song_id, position FROM setlist_entries
                WHERE setlist_id = ? ORDER BY position
                """,
                UUID.fromString(created.get("id").toString()));
        assertThat(stored).extracting(row -> row.get("position")).containsExactly(0, 1, 2, 3);
        assertThat(stored).extracting(row -> row.get("song_id").toString()).containsExactlyElementsOf(requested);
    }

    @Test
    void foreignBandSongCannotBeAdded() {
        String subjectA = "setlist-foreign-song-a";
        String subjectB = "setlist-foreign-song-b";
        UUID bandA = createOwnedBand(subjectA, "Band A");
        UUID bandB = createOwnedBand(subjectB, "Band B");
        String foreignSong = createSong(subjectB, bandB, "Foreign", "B", CHORDPRO);

        ResponseEntity<String> response = createSetlistRaw(
                subjectA,
                bandA,
                createBody("Nope", List.of(foreignSong)));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countSetlists(bandA)).isEqualTo(0);
    }

    @Test
    void nonexistentSongCannotBeAdded() {
        String subject = "setlist-missing-song";
        UUID bandId = createOwnedBand(subject, "Missing Song Band");

        ResponseEntity<String> response = createSetlistRaw(
                subject,
                bandId,
                createBody("Nope", List.of(UUID.randomUUID().toString())));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countSetlists(bandId)).isEqualTo(0);
    }

    @Test
    void createStartsAtVersionZeroAndUpdateIncrementsVersion() {
        String subject = "setlist-version";
        UUID bandId = createOwnedBand(subject, "Version Band");
        String songId = createSong(subject, bandId, "Song", "A", CHORDPRO);

        Map<String, Object> created = createSetlist(subject, bandId, "  Gig  ", List.of(songId)).getBody();
        assertThat(created).containsEntry("name", "Gig");
        assertThat(created).containsEntry("version", 0);

        Map<String, Object> updated = updateSetlist(
                subject,
                bandId,
                created.get("id").toString(),
                "Gig v2",
                List.of(songId, songId),
                0).getBody();
        assertThat(updated).containsEntry("version", 1);
        assertThat(songIds(updated)).containsExactly(songId, songId);
    }

    @Test
    void updateWithUnchangedNameStillIncrementsVersion() {
        String subject = "setlist-reorder-version";
        UUID bandId = createOwnedBand(subject, "Reorder Band");
        String first = createSong(subject, bandId, "First", "A", CHORDPRO);
        String second = createSong(subject, bandId, "Second", "B", CHORDPRO);
        Map<String, Object> created = createSetlist(subject, bandId, "Gig", List.of(first, second)).getBody();

        Map<String, Object> updated = updateSetlist(
                subject,
                bandId,
                created.get("id").toString(),
                "Gig",
                List.of(second, first),
                0).getBody();

        assertThat(updated).containsEntry("name", "Gig");
        assertThat(updated).containsEntry("version", 1);
        assertThat(songIds(updated)).containsExactly(second, first);
        assertThat(getSetlist(subject, bandId, created.get("id").toString()).getBody())
                .containsEntry("version", 1);
    }

    @Test
    void staleUpdateReturns409AndLeavesServerStateUnchanged() {
        String subject = "setlist-stale-update";
        UUID bandId = createOwnedBand(subject, "Lock Band");
        String songId = createSong(subject, bandId, "Song", "A", CHORDPRO);
        Map<String, Object> created = createSetlist(subject, bandId, "Original", List.of(songId)).getBody();
        String setlistId = created.get("id").toString();

        ResponseEntity<Map<String, Object>> winner = updateSetlist(
                subject,
                bandId,
                setlistId,
                "Winner",
                List.of(songId),
                0);
        assertThat(winner.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(winner.getBody()).containsEntry("version", 1);

        ResponseEntity<String> stale = updateSetlistRaw(
                subject,
                bandId,
                setlistId,
                updateBody("Stale", List.of(songId), 0));
        assertThat(stale.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(stale.getBody()).contains("stale version");

        Map<String, Object> reloaded = getSetlist(subject, bandId, setlistId).getBody();
        assertThat(reloaded).containsEntry("name", "Winner");
        assertThat(reloaded).containsEntry("version", 1);
    }

    @Test
    void staleDeleteReturns409ThenCurrentVersionDeletes() {
        String subject = "setlist-stale-delete";
        UUID bandId = createOwnedBand(subject, "Delete Lock Band");
        Map<String, Object> created = createSetlist(subject, bandId, "Doomed", List.of()).getBody();
        String setlistId = created.get("id").toString();

        ResponseEntity<Map<String, Object>> updated = updateSetlist(
                subject,
                bandId,
                setlistId,
                "Doomed v2",
                List.of(),
                0);
        assertThat(updated.getBody()).containsEntry("version", 1);

        ResponseEntity<String> stale = deleteSetlist(subject, bandId, setlistId, 0);
        assertThat(stale.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(getSetlist(subject, bandId, setlistId).getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<String> deleted = deleteSetlist(subject, bandId, setlistId, 1);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getSetlist(subject, bandId, setlistId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void missingUpdateAndDeleteReturn404() {
        String subject = "setlist-missing";
        UUID bandId = createOwnedBand(subject, "Missing Band");
        String missingId = UUID.randomUUID().toString();

        assertThat(getSetlist(subject, bandId, missingId).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(updateSetlistRaw(subject, bandId, missingId, updateBody("Nope", List.of(), 0)).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(deleteSetlist(subject, bandId, missingId, 0).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(countSetlists(bandId)).isEqualTo(0);
    }

    @Test
    void concurrentUpdatesWithSameVersionYieldOneSuccessAndOneConflict() throws Exception {
        String subject = "setlist-concurrent-update";
        UUID bandId = createOwnedBand(subject, "Concurrent Band");
        Map<String, Object> created = createSetlist(subject, bandId, "Race", List.of()).getBody();
        String setlistId = created.get("id").toString();

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<ResponseEntity<String>> responses = new CopyOnWriteArrayList<>();
        List<Future<?>> futures = new ArrayList<>();
        try {
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(updateSetlistRaw(subject, bandId, setlistId, updateBody("First", List.of(), 0)));
                return null;
            }));
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(updateSetlistRaw(subject, bandId, setlistId, updateBody("Second", List.of(), 0)));
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

        Map<String, Object> stored = getSetlist(subject, bandId, setlistId).getBody();
        assertThat(stored).containsEntry("version", 1);
        assertThat(stored.get("name")).isIn("First", "Second");
    }

    @Test
    void deletingSongRemovesMatchingEntriesButKeepsSetlistAndUnrelatedEntries() {
        String subject = "setlist-song-delete";
        UUID bandId = createOwnedBand(subject, "Cascade Band");
        String keep = createSong(subject, bandId, "Keep", "A", CHORDPRO);
        String remove = createSong(subject, bandId, "Remove", "B", CHORDPRO);
        String other = createSong(subject, bandId, "Other", "C", CHORDPRO);

        Map<String, Object> affected = createSetlist(
                subject,
                bandId,
                "Affected",
                List.of(remove, keep, remove)).getBody();
        Map<String, Object> unrelated = createSetlist(
                subject,
                bandId,
                "Unrelated",
                List.of(other, keep)).getBody();

        ResponseEntity<String> deleted = deleteSong(subject, bandId, remove, 0);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        Map<String, Object> reloadedAffected = getSetlist(subject, bandId, affected.get("id").toString()).getBody();
        assertThat(reloadedAffected).containsEntry("name", "Affected");
        assertThat(songIds(reloadedAffected)).containsExactly(keep);

        Map<String, Object> reloadedUnrelated = getSetlist(subject, bandId, unrelated.get("id").toString()).getBody();
        assertThat(reloadedUnrelated).containsEntry("name", "Unrelated");
        assertThat(songIds(reloadedUnrelated)).containsExactly(other, keep);

        assertThat(countEntriesForSong(UUID.fromString(remove))).isEqualTo(0);
        assertThat(countSetlists(bandId)).isEqualTo(2);
    }

    @Test
    void deletingSetlistRemovesItsEntries() {
        String subject = "setlist-delete-entries";
        UUID bandId = createOwnedBand(subject, "Delete Entries Band");
        String songId = createSong(subject, bandId, "Song", "A", CHORDPRO);
        Map<String, Object> created = createSetlist(subject, bandId, "Doomed", List.of(songId, songId)).getBody();
        UUID setlistId = UUID.fromString(created.get("id").toString());
        assertThat(countEntries(setlistId)).isEqualTo(2);

        ResponseEntity<String> deleted = deleteSetlist(subject, bandId, setlistId.toString(), 0);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(countEntries(setlistId)).isEqualTo(0);
        assertThat(countSetlists(bandId)).isEqualTo(0);
    }

    @Test
    void listOrdersSetlistsByNameThenId() {
        String subject = "setlist-list-order";
        UUID bandId = createOwnedBand(subject, "Order Band");
        createSetlist(subject, bandId, "Zulu", List.of());
        createSetlist(subject, bandId, "Alpha", List.of());
        createSetlist(subject, bandId, "Alpha", List.of());

        List<UUID> expected = jdbcTemplate.query(
                "SELECT id FROM setlists WHERE band_id = ? ORDER BY name, id",
                (rs, rowNum) -> rs.getObject("id", UUID.class),
                bandId);
        List<Map<String, Object>> list = listSetlists(subject, bandId).getBody();
        assertThat(list.stream().map(setlist -> UUID.fromString(setlist.get("id").toString())).toList())
                .containsExactlyElementsOf(expected);
        assertThat(list).extracting(setlist -> setlist.get("name")).containsExactly("Alpha", "Alpha", "Zulu");
    }

    @Test
    void blankAndOverlongNamesReturn400() {
        String subject = "setlist-validation";
        UUID bandId = createOwnedBand(subject, "Validation Band");

        assertThat(createSetlistRaw(subject, bandId, createBody("   ", List.of())).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(createSetlistRaw(subject, bandId, createBody("x".repeat(201), List.of())).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(countSetlists(bandId)).isEqualTo(0);
    }

    @Test
    void updateWithoutVersionReturns400() {
        String subject = "setlist-update-no-version";
        UUID bandId = createOwnedBand(subject, "Version Band");
        Map<String, Object> created = createSetlist(subject, bandId, "Needs Version", List.of()).getBody();

        ResponseEntity<String> response = updateSetlistRaw(
                subject,
                bandId,
                created.get("id").toString(),
                "{\"name\":\"Changed\",\"songIds\":[]}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(getSetlist(subject, bandId, created.get("id").toString()).getBody())
                .containsEntry("name", "Needs Version")
                .containsEntry("version", 0);
    }

    @Test
    void setlistWithoutBandIsRejectedByForeignKey() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO setlists (id, band_id, name, version)
                VALUES (?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                UUID.randomUUID(),
                "Orphan",
                0))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private RoleActor actorWithRole(MembershipRole role, String suffix) {
        String ownerSubject = "setlist-owner-" + suffix;
        UUID bandId = createOwnedBand(ownerSubject, "Role Band " + suffix);
        if (role == MembershipRole.OWNER) {
            return new RoleActor(ownerSubject, ownerSubject, bandId);
        }
        String actorSubject = "setlist-actor-" + suffix;
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

    private String createSong(String subject, UUID bandId, String title, String artist, String content) {
        Map<String, Object> song = restTemplate.exchange(
                "/api/bands/" + bandId + "/songs",
                HttpMethod.POST,
                jsonEntity(subject, songBody(title, artist, content)),
                OBJECT).getBody();
        assertThat(song).isNotNull();
        return song.get("id").toString();
    }

    private ResponseEntity<String> deleteSong(String subject, UUID bandId, String songId, int version) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId + "?version=" + version,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<Map<String, Object>> createSetlist(
            String subject,
            UUID bandId,
            String name,
            List<String> songIds) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists",
                HttpMethod.POST,
                jsonEntity(subject, createBody(name, songIds)),
                OBJECT);
    }

    private ResponseEntity<String> createSetlistRaw(String subject, UUID bandId, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists",
                HttpMethod.POST,
                new HttpEntity<>(json, headers),
                String.class);
    }

    private ResponseEntity<List<Map<String, Object>>> listSetlists(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists",
                HttpMethod.GET,
                authenticated(subject),
                OBJECT_LIST);
    }

    private ResponseEntity<String> listSetlistsRaw(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists",
                HttpMethod.GET,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<Map<String, Object>> getSetlist(String subject, UUID bandId, String setlistId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists/" + setlistId,
                HttpMethod.GET,
                authenticated(subject),
                OBJECT);
    }

    private ResponseEntity<Map<String, Object>> updateSetlist(
            String subject,
            UUID bandId,
            String setlistId,
            String name,
            List<String> songIds,
            int version) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists/" + setlistId,
                HttpMethod.PUT,
                jsonEntity(subject, updateBody(name, songIds, version)),
                OBJECT);
    }

    private ResponseEntity<String> updateSetlistRaw(String subject, UUID bandId, String setlistId, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists/" + setlistId,
                HttpMethod.PUT,
                new HttpEntity<>(json, headers),
                String.class);
    }

    private ResponseEntity<String> deleteSetlist(String subject, UUID bandId, String setlistId, int version) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/setlists/" + setlistId + "?version=" + version,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private Integer countSetlists(UUID bandId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM setlists WHERE band_id = ?",
                Integer.class,
                bandId);
    }

    private Integer countEntries(UUID setlistId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM setlist_entries WHERE setlist_id = ?",
                Integer.class,
                setlistId);
    }

    private Integer countEntriesForSong(UUID songId) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM setlist_entries WHERE song_id = ?",
                Integer.class,
                songId);
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

    @SuppressWarnings("unchecked")
    private static List<String> songIds(Map<String, Object> body) {
        assertThat(body).isNotNull();
        return ((List<Object>) body.get("songIds")).stream().map(Object::toString).toList();
    }

    private static String createBody(String name, List<String> songIds) {
        return "{\"name\":" + quote(name) + ",\"songIds\":" + jsonArray(songIds) + "}";
    }

    private static String updateBody(String name, List<String> songIds, int version) {
        return "{\"name\":" + quote(name)
                + ",\"songIds\":" + jsonArray(songIds)
                + ",\"version\":" + version + "}";
    }

    private static String songBody(String title, String artist, String content) {
        return "{\"title\":" + quote(title)
                + ",\"artist\":" + quote(artist)
                + ",\"content\":" + quote(content) + "}";
    }

    private static String jsonArray(List<String> values) {
        return values.stream().map(SetlistEndpointTests::quote).collect(Collectors.joining(",", "[", "]"));
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    private record RoleActor(String subject, String ownerSubject, UUID bandId) {
    }
}
