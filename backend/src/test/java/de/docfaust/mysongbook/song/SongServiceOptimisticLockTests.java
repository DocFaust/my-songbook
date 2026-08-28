package de.docfaust.mysongbook.song;

import java.util.Optional;
import java.util.UUID;

import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.Membership;
import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.user.User;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SongServiceOptimisticLockTests {

    @Mock
    private SongRepository songRepository;
    @Mock
    private BandAccessService bandAccessService;
    @InjectMocks
    private SongService songService;

    private User user;
    private UUID bandId;
    private UUID songId;
    private SongEntity entity;

    @BeforeEach
    void setUp() {
        user = new User(UUID.randomUUID(), "ol-user");
        bandId = UUID.randomUUID();
        songId = UUID.randomUUID();
        entity = new SongEntity(songId, bandId, "Original", "A", "{title: Original}", 0);
        when(bandAccessService.requireAnyRole(any(), any(), any(MembershipRole[].class)))
                .thenReturn(new Membership(bandId, user.id(), MembershipRole.OWNER));
        when(songRepository.findByBandIdAndId(bandId, songId)).thenReturn(Optional.of(entity));
    }

    @Test
    void updateRejectsStaleExpectedVersionWithoutWriting() {
        SongEntity newer = new SongEntity(songId, bandId, "Already newer", "A", "{title: Original}", 1);
        when(songRepository.findByBandIdAndId(bandId, songId)).thenReturn(Optional.of(newer));

        assertThatThrownBy(() -> songService.update(
                user,
                bandId,
                songId,
                "Stale",
                "B",
                "{title: Stale}",
                0))
                .isInstanceOf(StaleSongVersionException.class);
    }

    @Test
    void deleteRejectsStaleExpectedVersionWithoutDeleting() {
        SongEntity newer = new SongEntity(songId, bandId, "Original", "A", "{title: Original}", 1);
        when(songRepository.findByBandIdAndId(bandId, songId)).thenReturn(Optional.of(newer));

        assertThatThrownBy(() -> songService.delete(user, bandId, songId, 0))
                .isInstanceOf(StaleSongVersionException.class);
    }

    @Test
    void updateTranslatesOptimisticLockingFailureToStaleVersion() {
        when(songRepository.saveAndFlush(entity))
                .thenThrow(new OptimisticLockingFailureException("concurrent update"));

        assertThatThrownBy(() -> songService.update(
                user,
                bandId,
                songId,
                "Updated",
                "B",
                "{title: Updated}",
                0))
                .isInstanceOf(StaleSongVersionException.class);
    }

    @Test
    void deleteTranslatesOptimisticLockingFailureToStaleVersion() {
        doThrow(new OptimisticLockingFailureException("concurrent delete"))
                .when(songRepository)
                .flush();

        assertThatThrownBy(() -> songService.delete(user, bandId, songId, 0))
                .isInstanceOf(StaleSongVersionException.class);
    }
}
