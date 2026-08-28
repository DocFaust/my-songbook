package de.docfaust.mysongbook;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.api.ForbiddenOperationException;
import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.BandEntity;
import de.docfaust.mysongbook.band.BandRepository;
import de.docfaust.mysongbook.band.BandService;
import de.docfaust.mysongbook.band.Membership;
import de.docfaust.mysongbook.band.MembershipEntity;
import de.docfaust.mysongbook.band.MembershipId;
import de.docfaust.mysongbook.band.MembershipRepository;
import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.band.UserBand;
import de.docfaust.mysongbook.song.Song;
import de.docfaust.mysongbook.song.SongEntity;
import de.docfaust.mysongbook.song.SongRepository;
import de.docfaust.mysongbook.song.SongService;
import de.docfaust.mysongbook.song.StaleSongVersionException;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserEntity;
import de.docfaust.mysongbook.user.UserRepository;
import de.docfaust.mysongbook.user.UserService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import({ PostgresTestcontainersConfiguration.class, TestJwtDecoderConfiguration.class })
class JpaPersistenceTests {

    private static final String CHORDPRO = "{title: Wonderwall}\n[Em7]Today";

    @Autowired
    private UserService userService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private BandService bandService;
    @Autowired
    private BandRepository bandRepository;
    @Autowired
    private MembershipRepository membershipRepository;
    @Autowired
    private BandAccessService bandAccessService;
    @Autowired
    private SongService songService;
    @Autowired
    private SongRepository songRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private PlatformTransactionManager transactionManager;

    @Test
    void findOrCreatePersistsUserAndMapsToDomain() {
        String subject = "jpa-user-create-" + UUID.randomUUID();
        User created = userService.findOrCreateByExternalSubject(subject);

        UserEntity stored = userRepository.findByExternalSubject(subject).orElseThrow();
        assertThat(stored.getId()).isEqualTo(created.id());
        assertThat(stored.getExternalSubject()).isEqualTo(subject);
        assertThat(stored.toDomain()).isEqualTo(created);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                subject)).isEqualTo(1);
    }

    @Test
    void findOrCreateReusesExistingUserAfterOnConflict() {
        String subject = "jpa-user-reuse-" + UUID.randomUUID();
        User first = userService.findOrCreateByExternalSubject(subject);
        User second = userService.findOrCreateByExternalSubject(subject);

        assertThat(second.id()).isEqualTo(first.id());
        assertThat(second.externalSubject()).isEqualTo(subject);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                subject)).isEqualTo(1);
    }

    @Test
    void insertIgnoringConflictKeepsOriginalUserId() {
        String subject = "jpa-user-conflict-" + UUID.randomUUID();
        UUID originalId = UUID.randomUUID();
        UUID collidingId = UUID.randomUUID();

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            userRepository.insertIgnoringConflict(originalId, subject);
            userRepository.insertIgnoringConflict(collidingId, subject);
        });

        UserEntity stored = userRepository.findByExternalSubject(subject).orElseThrow();
        assertThat(stored.getId()).isEqualTo(originalId);
        assertThat(stored.getId()).isNotEqualTo(collidingId);
        assertThat(stored.toDomain()).isEqualTo(new User(originalId, subject));
    }

    @Test
    void userEntityCanBeSavedAndLoadedThroughJpa() {
        UUID id = UUID.randomUUID();
        String subject = "jpa-user-entity-" + id;
        userRepository.saveAndFlush(new UserEntity(id, subject));

        UserEntity loaded = userRepository.findById(id).orElseThrow();
        assertThat(loaded.getId()).isEqualTo(id);
        assertThat(loaded.getExternalSubject()).isEqualTo(subject);
        assertThat(loaded.toDomain()).isEqualTo(new User(id, subject));
    }

    @Test
    void bandAndMembershipRoundTripMapsToDomain() {
        User user = userService.findOrCreateByExternalSubject("jpa-band-" + UUID.randomUUID());
        UserBand created = bandService.create(user, "  Persistence Band  ");

        BandEntity band = bandRepository.findById(created.id()).orElseThrow();
        assertThat(band.getId()).isEqualTo(created.id());
        assertThat(band.getName()).isEqualTo("Persistence Band");

        MembershipEntity membership = membershipRepository
                .findByBandIdAndUserId(created.id(), user.id())
                .orElseThrow();
        assertThat(membership.getBandId()).isEqualTo(created.id());
        assertThat(membership.getUserId()).isEqualTo(user.id());
        assertThat(membership.getRole()).isEqualTo(MembershipRole.OWNER);
        assertThat(membership.toDomain()).isEqualTo(new Membership(created.id(), user.id(), MembershipRole.OWNER));

        MembershipId id = new MembershipId();
        id.setBandId(created.id());
        id.setUserId(user.id());
        MembershipEntity byId = membershipRepository.findById(id).orElseThrow();
        assertThat(byId.getBandId()).isEqualTo(created.id());
        assertThat(byId.getUserId()).isEqualTo(user.id());
        assertThat(byId.toDomain()).isEqualTo(membership.toDomain());
    }

    @Test
    void songRoundTripIsTenantScopedAndOrdered() {
        User owner = userService.findOrCreateByExternalSubject("jpa-song-a-" + UUID.randomUUID());
        User other = userService.findOrCreateByExternalSubject("jpa-song-b-" + UUID.randomUUID());
        UserBand bandA = bandService.create(owner, "Tenant A");
        UserBand bandB = bandService.create(other, "Tenant B");

        Song zulu = songService.create(owner, bandA.id(), "Zulu", "Artist Z", CHORDPRO);
        songService.create(owner, bandA.id(), "Alpha", "Artist 2", CHORDPRO);
        songService.create(owner, bandA.id(), "Alpha", "Artist 1", CHORDPRO);
        Song foreign = songService.create(other, bandB.id(), "Foreign", "Other", "{title: Foreign}");

        SongEntity stored = songRepository.findByBandIdAndId(bandA.id(), zulu.id()).orElseThrow();
        assertThat(stored.getId()).isEqualTo(zulu.id());
        assertThat(stored.getBandId()).isEqualTo(bandA.id());
        assertThat(stored.getTitle()).isEqualTo("Zulu");
        assertThat(stored.getArtist()).isEqualTo("Artist Z");
        assertThat(stored.getContent()).isEqualTo(CHORDPRO);
        assertThat(stored.getVersion()).isEqualTo(0);
        assertThat(stored.toDomain()).isEqualTo(zulu);

        assertThat(songRepository.findByBandIdAndId(bandB.id(), zulu.id())).isEmpty();
        assertThat(songRepository.findByBandIdAndId(bandA.id(), foreign.id())).isEmpty();

        List<UUID> expectedIds = jdbcTemplate.query(
                "SELECT id FROM songs WHERE band_id = ? ORDER BY title, id",
                (rs, rowNum) -> rs.getObject("id", UUID.class),
                bandA.id());
        List<SongEntity> listed = songRepository.findByBandIdOrderByTitleAscIdAsc(bandA.id());
        assertThat(listed).extracting(SongEntity::getTitle).containsExactly("Alpha", "Alpha", "Zulu");
        assertThat(listed).extracting(SongEntity::getId).containsExactlyElementsOf(expectedIds).doesNotContain(foreign.id());
        assertThat(songService.list(owner, bandA.id())).isEqualTo(listed.stream().map(SongEntity::toDomain).toList());
    }

    @Test
    void staleExpectedVersionOnUpdateAndDeleteDoesNotChangeSong() {
        User owner = userService.findOrCreateByExternalSubject("jpa-stale-" + UUID.randomUUID());
        UserBand band = bandService.create(owner, "Stale Band");
        Song created = songService.create(owner, band.id(), "Original", "A", CHORDPRO);
        Song updated = songService.update(owner, band.id(), created.id(), "Winner", "B", "{title: Winner}", 0);
        assertThat(updated.version()).isEqualTo(1);

        assertThatThrownBy(() -> songService.update(
                owner,
                band.id(),
                created.id(),
                "Stale",
                "C",
                "{title: Stale}",
                0))
                .isInstanceOf(StaleSongVersionException.class);
        assertThat(songService.get(owner, band.id(), created.id()))
                .isEqualTo(updated);

        assertThatThrownBy(() -> songService.delete(owner, band.id(), created.id(), 0))
                .isInstanceOf(StaleSongVersionException.class);
        assertThat(songRepository.findByBandIdAndId(band.id(), created.id())).isPresent();
    }

    @Test
    void flushDetectsConcurrentVersionChangeAgainstPostgreSQL() {
        User owner = userService.findOrCreateByExternalSubject("jpa-flush-ol-" + UUID.randomUUID());
        UserBand band = bandService.create(owner, "Flush Band");
        Song created = songService.create(owner, band.id(), "Race", "A", CHORDPRO);

        SongEntity entity = songRepository.findByBandIdAndId(band.id(), created.id()).orElseThrow();
        entity.setTitle("Local change");
        entity.setArtist("Local");
        entity.setContent("{title: Local}");

        jdbcTemplate.update("UPDATE songs SET version = version + 1 WHERE id = ?", created.id());

        assertThatThrownBy(() -> songRepository.saveAndFlush(entity))
                .isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(songRepository.findByBandIdAndId(band.id(), created.id()).orElseThrow().getTitle())
                .isEqualTo("Race");
    }

    @Test
    void bandAccessMapsMembershipAndEnforcesRoles() {
        User owner = userService.findOrCreateByExternalSubject("jpa-access-owner-" + UUID.randomUUID());
        User guest = userService.findOrCreateByExternalSubject("jpa-access-guest-" + UUID.randomUUID());
        User stranger = userService.findOrCreateByExternalSubject("jpa-access-stranger-" + UUID.randomUUID());
        UserBand band = bandService.create(owner, "Access Band");
        membershipRepository.save(new MembershipEntity(band.id(), guest.id(), MembershipRole.GUEST));

        Membership ownerMembership = bandAccessService.requireMembership(band.id(), owner.id());
        assertThat(ownerMembership).isEqualTo(new Membership(band.id(), owner.id(), MembershipRole.OWNER));
        assertThat(bandAccessService.requireAnyRole(
                band.id(),
                owner.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN)).isEqualTo(ownerMembership);

        Membership guestMembership = bandAccessService.requireMembership(band.id(), guest.id());
        assertThat(guestMembership.role()).isEqualTo(MembershipRole.GUEST);
        assertThatThrownBy(() -> bandAccessService.requireAnyRole(
                band.id(),
                guest.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN))
                .isInstanceOf(ForbiddenOperationException.class);

        assertThatThrownBy(() -> bandAccessService.requireMembership(band.id(), stranger.id()))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
