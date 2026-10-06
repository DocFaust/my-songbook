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
class PersonalSongNoteEndpointTests {

    private static final ParameterizedTypeReference<Map<String, Object>> OBJECT =
            new ParameterizedTypeReference<>() {
            };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST =
            new ParameterizedTypeReference<>() {
            };
    private static final String CHORDPRO = "{title: Wonderwall}\n{artist: Oasis}\n\n[Em7]Today";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void unauthenticatedNoteAccessReturns401() {
        String path = "/api/bands/" + UUID.randomUUID() + "/songs/" + UUID.randomUUID() + "/note";
        assertThat(restTemplate.getForEntity(path, String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(restTemplate.exchange(path, HttpMethod.PUT, new HttpEntity<>("{\"text\":\"x\"}"), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(restTemplate.exchange(path, HttpMethod.DELETE, new HttpEntity<>(new HttpHeaders()), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(restTemplate.getForEntity("/api/bands/" + UUID.randomUUID() + "/notes", String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void bulkReadReturnsOnlyTheCurrentUsersNotes(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "bulk-own-" + role.name().toLowerCase());
        String songId = songId(createSong(actor.ownerSubject(), actor.bandId(), "Bulk song", CHORDPRO));
        String otherSubject = "note-bulk-other-" + role.name().toLowerCase();
        addMember(actor.bandId(), otherSubject, MembershipRole.MEMBER);
        putNote(actor.subject(), actor.bandId(), songId, "eigene-" + role);
        putNote(otherSubject, actor.bandId(), songId, "fremd-" + role);

        ResponseEntity<List<Map<String, Object>>> response = listNotes(actor.subject(), actor.bandId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsExactly(Map.of(
                "songId", songId,
                "text", "eigene-" + role,
                "version", 0));
        assertThat(response.getBody().toString()).doesNotContain("fremd-" + role);
    }

    @Test
    void bulkReadOmitsSongsWithoutAStoredNote() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "bulk-empty");
        String withNote = songId(createSong(member.ownerSubject(), member.bandId(), "With note", CHORDPRO));
        String second = songId(createSong(member.ownerSubject(), member.bandId(), "Second", CHORDPRO));
        songId(createSong(member.ownerSubject(), member.bandId(), "Without", "{title: Without}"));
        putNote(member.subject(), member.bandId(), withNote, "Capo 2, letzter Refrain leiser");
        putNote(member.subject(), member.bandId(), second, "Intro zweimal");

        ResponseEntity<List<Map<String, Object>>> response = listNotes(member.subject(), member.bandId());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsExactlyInAnyOrder(
                Map.of("songId", withNote, "text", "Capo 2, letzter Refrain leiser", "version", 0),
                Map.of("songId", second, "text", "Intro zweimal", "version", 0));
    }

    @Test
    void bulkReadHidesNotesFromAnotherUserAndAnotherBand() {
        RoleActor userA = actorWithRole(MembershipRole.MEMBER, "bulk-privacy");
        addMember(userA.bandId(), "note-bulk-privacy-b", MembershipRole.ADMIN);
        String sharedSong = songId(createSong(userA.ownerSubject(), userA.bandId(), "Shared", CHORDPRO));
        putNote(userA.subject(), userA.bandId(), sharedSong, "alpha-private");
        putNote("note-bulk-privacy-b", userA.bandId(), sharedSong, "beta-private");

        UUID bandB = createOwnedBand("note-bulk-band-b", "Bulk Band B");
        String foreignSong = songId(createSong("note-bulk-band-b", bandB, "Foreign", "{title: Foreign}"));
        putNote("note-bulk-band-b", bandB, foreignSong, "band-b-private");

        ResponseEntity<String> sameBand = listNotesRaw(userA.subject(), userA.bandId());
        ResponseEntity<String> otherBand = listNotesRaw(userA.subject(), bandB);

        assertThat(sameBand.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(sameBand.getBody()).contains("alpha-private");
        assertThat(sameBand.getBody()).doesNotContain("beta-private");
        assertThat(sameBand.getBody()).doesNotContain("band-b-private");
        assertThat(otherBand.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(otherBand.getBody()).doesNotContain("band-b-private");
        assertThat(otherBand.getBody()).doesNotContain("alpha-private");
    }

    @Test
    void bulkReadDoesNotLeakNotesWithoutMembershipOrForAnUnknownBand() {
        RoleActor member = actorWithRole(MembershipRole.GUEST, "bulk-hidden");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Hidden", CHORDPRO));
        putNote(member.subject(), member.bandId(), songId, "geheim-bulk");
        restTemplate.exchange("/api/me", HttpMethod.GET, authenticated("note-bulk-stranger"), String.class);

        ResponseEntity<String> stranger = listNotesRaw("note-bulk-stranger", member.bandId());
        ResponseEntity<String> unknownBand = listNotesRaw(member.subject(), UUID.randomUUID());
        String withForeignUser = "/api/bands/" + member.bandId() + "/notes?userId=" + userId("note-bulk-stranger");
        ResponseEntity<String> ignoredUserId = restTemplate.exchange(
                withForeignUser,
                HttpMethod.GET,
                authenticated(member.subject()),
                String.class);

        assertThat(stranger.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(unknownBand.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(stranger.getBody()).doesNotContain("geheim-bulk");
        assertThat(unknownBand.getBody()).doesNotContain("geheim-bulk");
        assertThat(ignoredUserId.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(ignoredUserId.getBody()).contains("geheim-bulk");
        assertThat(ignoredUserId.getBody()).doesNotContain(userId("note-bulk-stranger").toString());
    }

    @Test
    void songNoteReadAndWriteStayIndependentOfTheBulkRead() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "bulk-unchanged");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Stable", CHORDPRO));

        assertThat(getNote(member.subject(), member.bandId(), songId).getBody()).containsEntry("text", "");
        assertThat(listNotes(member.subject(), member.bandId()).getBody()).isEmpty();

        assertThat(putNote(member.subject(), member.bandId(), songId, "erster Text").getBody())
                .containsEntry("text", "erster Text");
        assertThat(getNote(member.subject(), member.bandId(), songId).getBody()).containsEntry("text", "erster Text");
        assertThat(listNotes(member.subject(), member.bandId()).getBody())
                .containsExactly(Map.of("songId", songId, "text", "erster Text", "version", 0));

        assertThat(putNote(member.subject(), member.bandId(), songId, "zweiter Text").getBody())
                .containsEntry("text", "zweiter Text");
        assertThat(deleteNote(member.subject(), member.bandId(), songId).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getNote(member.subject(), member.bandId(), songId).getBody()).containsEntry("text", "");
        assertThat(listNotes(member.subject(), member.bandId()).getBody()).isEmpty();
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
    }

    @Test
    void memberWithoutNoteReadsEmptyText() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "empty");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Empty", CHORDPRO));

        ResponseEntity<Map<String, Object>> response = getNote(member.subject(), member.bandId(), songId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
                .containsEntry("text", "")
                .containsEntry("version", null);
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void everyRoleCanSaveItsOwnNote(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "save-" + role.name().toLowerCase());
        String songId = songId(createSong(actor.ownerSubject(), actor.bandId(), "Role song", CHORDPRO));

        ResponseEntity<Map<String, Object>> saved = putNote(
                actor.subject(),
                actor.bandId(),
                songId,
                "Hinweis von " + role);

        assertThat(saved.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(saved.getBody())
                .containsEntry("text", "Hinweis von " + role)
                .containsEntry("version", 0);
        assertThat(getNote(actor.subject(), actor.bandId(), songId).getBody())
                .containsEntry("text", "Hinweis von " + role);
        assertThat(countNotes(userId(actor.subject()), UUID.fromString(songId))).isEqualTo(1);
    }

    @Test
    void savingAgainUpdatesTheSameNote() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "update");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Update", CHORDPRO));
        putNote(member.subject(), member.bandId(), songId, "erster Text");

        ResponseEntity<Map<String, Object>> updated = putNote(
                member.subject(),
                member.bandId(),
                songId,
                "zweiter Text");

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("text", "zweiter Text");
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isEqualTo(1);
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("zweiter Text");
    }

    @Test
    void deleteRemovesOnlyTheCurrentUsersNote() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "delete");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Delete", CHORDPRO));
        putNote(member.subject(), member.bandId(), songId, "weg damit");
        putNote(member.ownerSubject(), member.bandId(), songId, "bleibt");

        ResponseEntity<String> deleted = deleteNote(member.subject(), member.bandId(), songId);

        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(getNote(member.subject(), member.bandId(), songId).getBody()).containsEntry("text", "");
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
        assertThat(noteText(userId(member.ownerSubject()), UUID.fromString(songId))).isEqualTo("bleibt");
        assertThat(deleteNote(member.subject(), member.bandId(), songId).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void blankTextIsNotStored() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "blank");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Blank", CHORDPRO));
        putNote(member.subject(), member.bandId(), songId, "vorher");

        ResponseEntity<Map<String, Object>> cleared = putNote(member.subject(), member.bandId(), songId, "  \n  ");

        assertThat(cleared.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(cleared.getBody()).containsEntry("text", "");
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
        assertThat(putNote(member.subject(), member.bandId(), songId, null).getBody()).containsEntry("text", "");
    }

    @Test
    void databaseAllowsAtMostOneNotePerUserAndSong() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "unique");
        UUID songUuid = UUID.fromString(songId(createSong(member.ownerSubject(), member.bandId(), "Unique", CHORDPRO)));
        putNote(member.subject(), member.bandId(), songUuid.toString(), "eine Notiz");

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO personal_song_notes (id, user_id, song_id, text)
                VALUES (?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                userId(member.subject()),
                songUuid,
                "zweite Notiz"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(countNotes(userId(member.subject()), songUuid)).isEqualTo(1);
    }

    @Test
    void databaseRejectsBlankNoteText() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "check");
        UUID songUuid = UUID.fromString(songId(createSong(member.ownerSubject(), member.bandId(), "Check", CHORDPRO)));

        assertThatThrownBy(() -> jdbcTemplate.update(
                """
                INSERT INTO personal_song_notes (id, user_id, song_id, text)
                VALUES (?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                userId(member.subject()),
                songUuid,
                "   "))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void notesStayPrivateBetweenMembersOfTheSameBand() {
        RoleActor userA = actorWithRole(MembershipRole.MEMBER, "privacy-a");
        addMember(userA.bandId(), "note-privacy-b", MembershipRole.MEMBER);
        String songId = songId(createSong(userA.ownerSubject(), userA.bandId(), "Shared song", CHORDPRO));

        putNote(userA.subject(), userA.bandId(), songId, "alpha-private-note");

        ResponseEntity<Map<String, Object>> readByB = getNote("note-privacy-b", userA.bandId(), songId);
        assertThat(readByB.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(readByB.getBody())
                .containsEntry("text", "")
                .containsEntry("version", null);
        assertThat(readByB.getBody().toString()).doesNotContain("alpha-private-note");

        putNote("note-privacy-b", userA.bandId(), songId, "beta-private-note");
        assertThat(getNote(userA.subject(), userA.bandId(), songId).getBody())
                .containsEntry("text", "alpha-private-note");
        assertThat(getNote("note-privacy-b", userA.bandId(), songId).getBody())
                .containsEntry("text", "beta-private-note");

        putNote("note-privacy-b", userA.bandId(), songId, "beta-changed");
        assertThat(noteText(userId(userA.subject()), UUID.fromString(songId))).isEqualTo("alpha-private-note");
        assertThat(noteText(userId("note-privacy-b"), UUID.fromString(songId))).isEqualTo("beta-changed");

        deleteNote("note-privacy-b", userA.bandId(), songId);
        assertThat(noteText(userId(userA.subject()), UUID.fromString(songId))).isEqualTo("alpha-private-note");
        assertThat(countNotes(userId("note-privacy-b"), UUID.fromString(songId))).isZero();
    }

    @Test
    void apiDoesNotAcceptAnotherUsersId() {
        RoleActor userA = actorWithRole(MembershipRole.MEMBER, "no-user-id");
        addMember(userA.bandId(), "note-other-user", MembershipRole.GUEST);
        String songId = songId(createSong(userA.ownerSubject(), userA.bandId(), "No user id", CHORDPRO));
        putNote("note-other-user", userA.bandId(), songId, "fremd-bleibt");
        UUID otherUserId = userId("note-other-user");

        String addressed = "/api/bands/" + userA.bandId() + "/songs/" + songId + "/note/" + otherUserId;
        ResponseEntity<String> byPath = restTemplate.exchange(
                addressed,
                HttpMethod.GET,
                authenticated(userA.subject()),
                String.class);
        assertThat(byPath.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(byPath.getBody()).doesNotContain("fremd-bleibt");

        String json = "{\"text\":\"ueberschrieben\",\"userId\":\"" + otherUserId + "\"}";
        ResponseEntity<Map<String, Object>> byBody = restTemplate.exchange(
                notePath(userA.bandId(), songId),
                HttpMethod.PUT,
                jsonEntity(userA.subject(), json),
                OBJECT);
        assertThat(byBody.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(byBody.getBody()).containsEntry("text", "ueberschrieben");
        assertThat(noteText(otherUserId, UUID.fromString(songId))).isEqualTo("fremd-bleibt");
        assertThat(noteText(userId(userA.subject()), UUID.fromString(songId))).isEqualTo("ueberschrieben");
    }

    @Test
    void nonMemberCannotReadOrWriteNotes() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "tenant-member");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Hidden", CHORDPRO));
        putNote(member.subject(), member.bandId(), songId, "geheim-note");
        restTemplate.exchange("/api/me", HttpMethod.GET, authenticated("note-stranger"), String.class);

        ResponseEntity<String> read = getNoteRaw("note-stranger", member.bandId(), songId);
        ResponseEntity<String> write = putNoteRaw("note-stranger", member.bandId(), songId, "{\"text\":\"leak\"}");

        assertThat(read.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(write.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(read.getBody()).doesNotContain("geheim-note");
        assertThat(write.getBody()).doesNotContain("geheim-note");
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("geheim-note");
        assertThat(countNotes(userId("note-stranger"), UUID.fromString(songId))).isZero();
    }

    @Test
    void songOfAnotherBandCannotBeAddressedThroughTheCurrentBand() {
        RoleActor bandA = actorWithRole(MembershipRole.MEMBER, "band-a");
        UUID bandB = createOwnedBand("note-band-b-owner", "Note Band B");
        String songB = songId(createSong("note-band-b-owner", bandB, "Foreign song", "{title: Foreign}"));
        putNote("note-band-b-owner", bandB, songB, "band-b-private");

        ResponseEntity<String> read = getNoteRaw(bandA.subject(), bandA.bandId(), songB);
        ResponseEntity<String> write = putNoteRaw(bandA.subject(), bandA.bandId(), songB, "{\"text\":\"hijack\"}");
        ResponseEntity<String> deleted = deleteNote(bandA.subject(), bandA.bandId(), songB);

        assertThat(read.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(write.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(read.getBody()).doesNotContain("band-b-private");
        assertThat(noteText(userId("note-band-b-owner"), UUID.fromString(songB))).isEqualTo("band-b-private");
        assertThat(getSong(bandA.subject(), bandA.bandId(), songB).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void songChangesDoNotIncludeOrOverwriteTheNote() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "separate");
        Map<String, Object> created = createSong(member.ownerSubject(), member.bandId(), "Song", CHORDPRO).getBody();
        String songId = created.get("id").toString();
        putNote(member.subject(), member.bandId(), songId, "capo 2");

        ResponseEntity<Map<String, Object>> updated = updateSong(
                member.subject(),
                member.bandId(),
                songId,
                "Song",
                "",
                "{title: Neu}",
                0);

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("content", "{title: Neu}");
        assertThat(updated.getBody()).doesNotContainKey("text");
        assertThat(updated.getBody().toString()).doesNotContain("capo 2");
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("capo 2");
    }

    @Test
    void deletingASongRemovesEveryNoteOfThatSong() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "song-delete");
        addMember(member.bandId(), "note-song-delete-guest", MembershipRole.GUEST);
        String removedSong = songId(createSong(member.ownerSubject(), member.bandId(), "Remove", CHORDPRO));
        String keptSong = songId(createSong(member.ownerSubject(), member.bandId(), "Keep", "{title: Keep}"));
        putNote(member.subject(), member.bandId(), removedSong, "member-on-removed");
        putNote("note-song-delete-guest", member.bandId(), removedSong, "guest-on-removed");
        putNote(member.subject(), member.bandId(), keptSong, "member-on-kept");

        ResponseEntity<String> deleted = deleteSong(member.ownerSubject(), member.bandId(), removedSong, 0);

        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(countNotesForSong(UUID.fromString(removedSong))).isZero();
        assertThat(noteText(userId(member.subject()), UUID.fromString(keptSong))).isEqualTo("member-on-kept");
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "ADMIN", "MEMBER", "GUEST" })
    void leavingDeletesNotesOfThatBandOnly(MembershipRole role) {
        String subject = "note-leave-" + role.name().toLowerCase();
        UUID homeBand = createOwnedBand(subject, "Home " + role);
        String homeSong = songId(createSong(subject, homeBand, "Home song", CHORDPRO));
        putNote(subject, homeBand, homeSong, "home-note-" + role);

        String owner = "note-leave-owner-" + role.name().toLowerCase();
        UUID bandId = createOwnedBand(owner, "Leave band " + role);
        addMember(bandId, subject, role);
        String bandSong = songId(createSong(owner, bandId, "Band song", CHORDPRO));
        putNote(subject, bandId, bandSong, "band-note-" + role);
        putNote(owner, bandId, bandSong, "owner-stays-" + role);

        ResponseEntity<String> response = leave(subject, bandId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(countNotes(userId(subject), UUID.fromString(bandSong))).isZero();
        assertThat(noteText(userId(subject), UUID.fromString(homeSong))).isEqualTo("home-note-" + role);
        assertThat(noteText(userId(owner), UUID.fromString(bandSong))).isEqualTo("owner-stays-" + role);
        assertThat(membershipRole(bandId, subject)).isNull();
        assertThat(membershipRole(homeBand, subject)).isEqualTo("OWNER");
    }

    @Test
    void ownerLeaveDoesNotDeleteNotes() {
        String owner = "note-owner-leave";
        UUID bandId = createOwnedBand(owner, "Owner stays");
        String songId = songId(createSong(owner, bandId, "Owner song", CHORDPRO));
        putNote(owner, bandId, songId, "owner-note");

        ResponseEntity<String> response = leave(owner, bandId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(noteText(userId(owner), UUID.fromString(songId))).isEqualTo("owner-note");
        assertThat(membershipRole(bandId, owner)).isEqualTo("OWNER");
    }

    @ParameterizedTest
    @EnumSource(value = MembershipRole.class, names = { "OWNER", "ADMIN" })
    void removingAMemberDeletesThatBandsNotesOnly(MembershipRole actorRole) {
        String owner = "note-remove-owner-" + actorRole.name().toLowerCase();
        UUID bandId = createOwnedBand(owner, "Remove band " + actorRole);
        String actor = actorRole == MembershipRole.OWNER
                ? owner
                : "note-remove-actor-" + actorRole.name().toLowerCase();
        if (actorRole != MembershipRole.OWNER) {
            addMember(bandId, actor, actorRole);
        }
        String target = "note-remove-target-" + actorRole.name().toLowerCase();
        addMember(bandId, target, MembershipRole.MEMBER);
        UUID homeBand = createOwnedBand(target, "Target home " + actorRole);
        String bandSong = songId(createSong(owner, bandId, "Band song", CHORDPRO));
        String homeSong = songId(createSong(target, homeBand, "Home song", "{title: Home}"));
        putNote(target, bandId, bandSong, "band-note");
        putNote(target, homeBand, homeSong, "home-note");
        putNote(owner, bandId, bandSong, "owner-note");

        ResponseEntity<String> response = removeMember(actor, bandId, userId(target));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(countNotes(userId(target), UUID.fromString(bandSong))).isZero();
        assertThat(noteText(userId(target), UUID.fromString(homeSong))).isEqualTo("home-note");
        assertThat(noteText(userId(owner), UUID.fromString(bandSong))).isEqualTo("owner-note");
        assertThat(membershipRole(bandId, target)).isNull();
        assertThat(membershipRole(homeBand, target)).isEqualTo("OWNER");
    }

    @Test
    void ownershipTransferKeepsNotes() {
        String owner = "note-transfer-owner";
        UUID bandId = createOwnedBand(owner, "Transfer band");
        addMember(bandId, "note-transfer-member", MembershipRole.MEMBER);
        String songId = songId(createSong(owner, bandId, "Transfer song", CHORDPRO));
        putNote(owner, bandId, songId, "owner-note");
        putNote("note-transfer-member", bandId, songId, "member-note");

        ResponseEntity<Map<String, Object>> transferred = restTemplate.exchange(
                "/api/bands/" + bandId + "/ownership-transfer",
                HttpMethod.POST,
                jsonEntity(owner, "{\"userId\":\"" + userId("note-transfer-member") + "\"}"),
                OBJECT);

        assertThat(transferred.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(noteText(userId(owner), UUID.fromString(songId))).isEqualTo("owner-note");
        assertThat(noteText(userId("note-transfer-member"), UUID.fromString(songId))).isEqualTo("member-note");
        assertThat(membershipRole(bandId, owner)).isEqualTo("ADMIN");
        assertThat(membershipRole(bandId, "note-transfer-member")).isEqualTo("OWNER");
    }

    @Test
    void readingAStoredNoteIncludesItsVersion() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-read");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Version", CHORDPRO));

        assertThat(getNote(member.subject(), member.bandId(), songId).getBody()).containsEntry("version", null);

        ResponseEntity<Map<String, Object>> created = putNoteVersion(
                member.subject(), member.bandId(), songId, "Capo 2", null, true);

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(created.getBody()).containsEntry("text", "Capo 2").containsEntry("version", 0);
        assertThat(listNotes(member.subject(), member.bandId()).getBody())
                .containsExactly(Map.of("songId", songId, "text", "Capo 2", "version", 0));
    }

    @Test
    void updateWithTheCurrentVersionSucceedsAndIncrementsIt() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-update");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Update version", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "alt", null, true);

        ResponseEntity<Map<String, Object>> updated = putNoteVersion(
                member.subject(), member.bandId(), songId, "neu", 0, false);

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("text", "neu").containsEntry("version", 1);
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("neu");
    }

    @Test
    void staleUpdateReturns409AndLeavesTheNoteUnchanged() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-stale");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Stale", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "aktuell", null, true);
        putNoteVersion(member.subject(), member.bandId(), songId, "zwischenstand", 0, false);

        ResponseEntity<Map<String, Object>> stale = putNoteVersion(
                member.subject(), member.bandId(), songId, "veraltet", 0, false);

        assertThat(stale.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(stale.getBody()).containsEntry("error", "stale version");
        assertThat(stale.getBody()).containsEntry("code", "changed");
        assertThat(stale.getBody()).containsEntry("text", "zwischenstand");
        assertThat(stale.getBody()).containsEntry("version", 1);
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("zwischenstand");
    }

    @Test
    void deleteWithTheCurrentVersionRemovesTheNote() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-delete");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Delete version", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "weg", null, true);

        ResponseEntity<String> deleted = deleteNoteVersion(member.subject(), member.bandId(), songId, 0);

        assertThat(deleted.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
    }

    @Test
    void staleDeleteReturns409AndKeepsTheNote() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-stale-delete");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Stale delete", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "bleibt", null, true);
        putNoteVersion(member.subject(), member.bandId(), songId, "geaendert", 0, false);

        ResponseEntity<Map<String, Object>> stale = deleteNoteVersionObject(
                member.subject(), member.bandId(), songId, 0);

        assertThat(stale.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(stale.getBody()).containsEntry("code", "changed");
        assertThat(stale.getBody()).containsEntry("text", "geaendert");
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("geaendert");
        assertThat(deleteNoteVersion(member.subject(), member.bandId(), songId, 1).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void conditionalUpdateOfADeletedNoteConflicts() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-gone");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Gone", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "weg", null, true);
        deleteNoteVersion(member.subject(), member.bandId(), songId, 0);

        ResponseEntity<Map<String, Object>> conflict = putNoteVersion(
                member.subject(), member.bandId(), songId, "wieder", 0, false);

        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(conflict.getBody()).containsEntry("code", "deleted");
        assertThat(conflict.getBody()).doesNotContainKey("text");
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
    }

    @Test
    void creatingANoteThatAlreadyExistsConflicts() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-created");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Created", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "server", null, true);

        ResponseEntity<Map<String, Object>> conflict = putNoteVersion(
                member.subject(), member.bandId(), songId, "lokal neu", null, true);

        assertThat(conflict.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(conflict.getBody()).containsEntry("code", "created");
        assertThat(conflict.getBody()).containsEntry("text", "server");
        assertThat(conflict.getBody()).containsEntry("version", 0);
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isEqualTo("server");
    }

    @Test
    void conditionalUpdateOfADeletedSongReportsTheSong() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-song-gone");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Song gone", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "lokal", null, true);
        assertThat(deleteSong(member.ownerSubject(), member.bandId(), songId, 0).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<String> response = putNoteRaw(
                member.subject(),
                member.bandId(),
                songId,
                "{\"text\":\"bleibt lokal\",\"expectedVersion\":0}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"code\":\"song\"");
        assertThat(response.getBody()).doesNotContain("bleibt lokal");
    }

    @Test
    void conditionalUpdateWithoutMembershipReportsMembership() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-membership");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Membership", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "privat", null, true);
        assertThat(removeMember(member.ownerSubject(), member.bandId(), userId(member.subject())).getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<String> response = putNoteRaw(
                member.subject(),
                member.bandId(),
                songId,
                "{\"text\":\"nach verlassen\",\"expectedVersion\":0}");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).contains("\"code\":\"membership\"");
        assertThat(response.getBody()).doesNotContain("nach verlassen");
        assertThat(countNotes(userId(member.subject()), UUID.fromString(songId))).isZero();
    }

    @ParameterizedTest
    @EnumSource(MembershipRole.class)
    void everyRoleCanUpdateOnlyItsOwnNoteWithTheCurrentVersion(MembershipRole role) {
        RoleActor actor = actorWithRole(role, "version-role-" + role.name().toLowerCase());
        String songId = songId(createSong(actor.ownerSubject(), actor.bandId(), "Role version", CHORDPRO));
        boolean sameUser = actor.subject().equals(actor.ownerSubject());
        if (!sameUser) {
            putNote(actor.ownerSubject(), actor.bandId(), songId, "fremd");
        }
        putNoteVersion(actor.subject(), actor.bandId(), songId, "eigen", null, true);

        ResponseEntity<Map<String, Object>> updated = putNoteVersion(
                actor.subject(), actor.bandId(), songId, "eigen-neu", 0, false);

        assertThat(updated.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(updated.getBody()).containsEntry("text", "eigen-neu");
        assertThat(noteText(userId(actor.subject()), UUID.fromString(songId))).isEqualTo("eigen-neu");
        if (!sameUser) {
            assertThat(noteText(userId(actor.ownerSubject()), UUID.fromString(songId))).isEqualTo("fremd");
        }
    }

    @Test
    void conditionalUpdateCannotAddressAnotherBandOrUser() {
        RoleActor userA = actorWithRole(MembershipRole.MEMBER, "version-cross");
        addMember(userA.bandId(), "note-version-cross-b", MembershipRole.MEMBER);
        String songId = songId(createSong(userA.ownerSubject(), userA.bandId(), "Cross", CHORDPRO));
        putNoteVersion("note-version-cross-b", userA.bandId(), songId, "beta", null, true);
        UUID bandB = createOwnedBand("note-version-cross-owner", "Cross Band B");
        String foreignSong = songId(createSong("note-version-cross-owner", bandB, "Foreign", "{title: Foreign}"));
        putNoteVersion("note-version-cross-owner", bandB, foreignSong, "geheim", null, true);

        ResponseEntity<String> otherUser = putNoteRaw(
                userA.subject(),
                userA.bandId(),
                songId,
                "{\"text\":\"uebernommen\",\"expectedVersion\":0,\"userId\":\"" + userId("note-version-cross-b") + "\"}");
        ResponseEntity<String> otherBand = putNoteRaw(
                userA.subject(),
                userA.bandId(),
                foreignSong,
                "{\"text\":\"hijack\",\"expectedVersion\":0}");

        assertThat(otherUser.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(noteText(userId("note-version-cross-b"), UUID.fromString(songId))).isEqualTo("beta");
        assertThat(otherBand.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(otherBand.getBody()).contains("\"code\":\"song\"");
        assertThat(noteText(userId("note-version-cross-owner"), UUID.fromString(foreignSong))).isEqualTo("geheim");
    }

    @Test
    void concurrentConditionalUpdatesYieldOneSuccessAndOneConflict() throws Exception {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "version-race");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Race", CHORDPRO));
        putNoteVersion(member.subject(), member.bandId(), songId, "basis", null, true);

        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        List<ResponseEntity<String>> responses = new CopyOnWriteArrayList<>();
        List<Future<?>> futures = new ArrayList<>();
        try {
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(putNoteRaw(
                        member.subject(),
                        member.bandId(),
                        songId,
                        "{\"text\":\"eins\",\"expectedVersion\":0}"));
                return null;
            }));
            futures.add(executor.submit(() -> {
                start.await();
                responses.add(putNoteRaw(
                        member.subject(),
                        member.bandId(),
                        songId,
                        "{\"text\":\"zwei\",\"expectedVersion\":0}"));
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
        assertThat(noteText(userId(member.subject()), UUID.fromString(songId))).isIn("eins", "zwei");
        assertThat(getNote(member.subject(), member.bandId(), songId).getBody()).containsEntry("version", 1);
    }

    private RoleActor actorWithRole(MembershipRole role, String suffix) {
        String ownerSubject = "note-owner-" + suffix;
        UUID bandId = createOwnedBand(ownerSubject, "Note Band " + suffix);
        if (role == MembershipRole.OWNER) {
            return new RoleActor(ownerSubject, ownerSubject, bandId);
        }
        String actorSubject = "note-actor-" + suffix;
        addMember(bandId, actorSubject, role);
        return new RoleActor(actorSubject, ownerSubject, bandId);
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
        restTemplate.exchange("/api/me", HttpMethod.GET, authenticated(subject), String.class);
        jdbcTemplate.update(
                "INSERT INTO memberships (band_id, user_id, role) VALUES (?, ?, ?)",
                bandId,
                userId(subject),
                role.name());
    }

    private ResponseEntity<Map<String, Object>> createSong(String subject, UUID bandId, String title, String content) {
        String json = "{\"title\":" + quote(title) + ",\"artist\":\"\",\"content\":" + quote(content) + "}";
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs",
                HttpMethod.POST,
                jsonEntity(subject, json),
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
        String json = "{\"title\":" + quote(title)
                + ",\"artist\":" + quote(artist)
                + ",\"content\":" + quote(content)
                + ",\"version\":" + version + "}";
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId,
                HttpMethod.PUT,
                jsonEntity(subject, json),
                OBJECT);
    }

    private ResponseEntity<Map<String, Object>> getSong(String subject, UUID bandId, String songId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId,
                HttpMethod.GET,
                authenticated(subject),
                OBJECT);
    }

    private ResponseEntity<String> deleteSong(String subject, UUID bandId, String songId, int version) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/songs/" + songId + "?version=" + version,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<List<Map<String, Object>>> listNotes(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/notes",
                HttpMethod.GET,
                authenticated(subject),
                LIST);
    }

    private ResponseEntity<String> listNotesRaw(String subject, UUID bandId) {
        return restTemplate.exchange(
                "/api/bands/" + bandId + "/notes",
                HttpMethod.GET,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<Map<String, Object>> getNote(String subject, UUID bandId, String songId) {
        return restTemplate.exchange(notePath(bandId, songId), HttpMethod.GET, authenticated(subject), OBJECT);
    }

    private ResponseEntity<String> getNoteRaw(String subject, UUID bandId, String songId) {
        return restTemplate.exchange(notePath(bandId, songId), HttpMethod.GET, authenticated(subject), String.class);
    }

    private ResponseEntity<Map<String, Object>> putNote(String subject, UUID bandId, String songId, String text) {
        String json = text == null ? "{\"text\":null}" : "{\"text\":" + quote(text) + "}";
        return restTemplate.exchange(notePath(bandId, songId), HttpMethod.PUT, jsonEntity(subject, json), OBJECT);
    }

    private ResponseEntity<String> putNoteRaw(String subject, UUID bandId, String songId, String json) {
        return restTemplate.exchange(
                notePath(bandId, songId),
                HttpMethod.PUT,
                jsonEntity(subject, json),
                String.class);
    }

    private ResponseEntity<String> deleteNote(String subject, UUID bandId, String songId) {
        return restTemplate.exchange(notePath(bandId, songId), HttpMethod.DELETE, authenticated(subject), String.class);
    }

    private ResponseEntity<Map<String, Object>> putNoteVersion(
            String subject,
            UUID bandId,
            String songId,
            String text,
            Integer expectedVersion,
            boolean expectAbsent) {
        StringBuilder json = new StringBuilder();
        json.append("{\"text\":").append(text == null ? "null" : quote(text));
        if (expectedVersion != null) {
            json.append(",\"expectedVersion\":").append(expectedVersion);
        }
        if (expectAbsent) {
            json.append(",\"expectAbsent\":true");
        }
        json.append('}');
        return restTemplate.exchange(notePath(bandId, songId), HttpMethod.PUT, jsonEntity(subject, json.toString()), OBJECT);
    }

    private ResponseEntity<String> deleteNoteVersion(String subject, UUID bandId, String songId, int version) {
        return restTemplate.exchange(
                notePath(bandId, songId) + "?version=" + version,
                HttpMethod.DELETE,
                authenticated(subject),
                String.class);
    }

    private ResponseEntity<Map<String, Object>> deleteNoteVersionObject(
            String subject,
            UUID bandId,
            String songId,
            int version) {
        return restTemplate.exchange(
                notePath(bandId, songId) + "?version=" + version,
                HttpMethod.DELETE,
                authenticated(subject),
                OBJECT);
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

    private static String notePath(UUID bandId, String songId) {
        return "/api/bands/" + bandId + "/songs/" + songId + "/note";
    }

    private static String songId(ResponseEntity<Map<String, Object>> created) {
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        return created.getBody().get("id").toString();
    }

    private Integer countNotes(UUID userUuid, UUID songUuid) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM personal_song_notes WHERE user_id = ? AND song_id = ?",
                Integer.class,
                userUuid,
                songUuid);
    }

    private Integer countNotesForSong(UUID songUuid) {
        return jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM personal_song_notes WHERE song_id = ?",
                Integer.class,
                songUuid);
    }

    private String noteText(UUID userUuid, UUID songUuid) {
        return jdbcTemplate.queryForObject(
                "SELECT text FROM personal_song_notes WHERE user_id = ? AND song_id = ?",
                String.class,
                userUuid,
                songUuid);
    }

    private String membershipRole(UUID bandId, String subject) {
        return jdbcTemplate.query(
                """
                SELECT role FROM memberships
                WHERE band_id = ? AND user_id = ?
                """,
                (rs, rowNum) -> rs.getString("role"),
                bandId,
                userId(subject))
                .stream()
                .findFirst()
                .orElse(null);
    }

    private UUID userId(String subject) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE external_subject = ?",
                UUID.class,
                subject);
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

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    private record RoleActor(String subject, String ownerSubject, UUID bandId) {
    }
}
