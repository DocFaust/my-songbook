package de.docfaust.mysongbook;

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
    }

    @Test
    void memberWithoutNoteReadsEmptyText() {
        RoleActor member = actorWithRole(MembershipRole.MEMBER, "empty");
        String songId = songId(createSong(member.ownerSubject(), member.bandId(), "Empty", CHORDPRO));

        ResponseEntity<Map<String, Object>> response = getNote(member.subject(), member.bandId(), songId);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsExactly(Map.entry("text", ""));
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
        assertThat(saved.getBody()).containsExactly(Map.entry("text", "Hinweis von " + role));
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
        assertThat(readByB.getBody()).containsExactly(Map.entry("text", ""));
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
