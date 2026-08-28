package de.docfaust.mysongbook.setlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.Membership;
import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.song.SongRepository;
import de.docfaust.mysongbook.user.User;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SetlistServiceOptimisticLockTests {

    @Mock
    private SetlistRepository setlistRepository;
    @Mock
    private SetlistEntryRepository setlistEntryRepository;
    @Mock
    private SongRepository songRepository;
    @Mock
    private BandAccessService bandAccessService;
    @Mock
    private EntityManager entityManager;
    @InjectMocks
    private SetlistService setlistService;

    private User user;
    private UUID bandId;
    private UUID setlistId;
    private SetlistEntity entity;

    @BeforeEach
    void setUp() {
        user = new User(UUID.randomUUID(), "setlist-ol-user");
        bandId = UUID.randomUUID();
        setlistId = UUID.randomUUID();
        entity = new SetlistEntity(setlistId, bandId, "Original", 0);
        when(bandAccessService.requireAnyRole(any(), any(), any(MembershipRole[].class)))
                .thenReturn(new Membership(bandId, user.id(), MembershipRole.OWNER));
        when(setlistRepository.findByBandIdAndId(bandId, setlistId)).thenReturn(Optional.of(entity));
    }

    @Test
    void updateRejectsStaleExpectedVersionWithoutWriting() {
        SetlistEntity newer = new SetlistEntity(setlistId, bandId, "Already newer", 1);
        when(setlistRepository.findByBandIdAndId(bandId, setlistId)).thenReturn(Optional.of(newer));

        assertThatThrownBy(() -> setlistService.update(user, bandId, setlistId, "Stale", List.of(), 0))
                .isInstanceOf(StaleSetlistVersionException.class);
        verify(setlistEntryRepository, never()).deleteBySetlistId(any());
        verify(setlistRepository, never()).saveAndFlush(any());
    }

    @Test
    void deleteRejectsStaleExpectedVersionWithoutDeleting() {
        SetlistEntity newer = new SetlistEntity(setlistId, bandId, "Original", 1);
        when(setlistRepository.findByBandIdAndId(bandId, setlistId)).thenReturn(Optional.of(newer));

        assertThatThrownBy(() -> setlistService.delete(user, bandId, setlistId, 0))
                .isInstanceOf(StaleSetlistVersionException.class);
        verify(setlistRepository, never()).delete(any());
    }

    @Test
    void updateTranslatesOptimisticLockingFailureToStaleVersion() {
        when(setlistRepository.saveAndFlush(entity))
                .thenThrow(new OptimisticLockingFailureException("concurrent update"));

        assertThatThrownBy(() -> setlistService.update(user, bandId, setlistId, "Updated", List.of(), 0))
                .isInstanceOf(StaleSetlistVersionException.class);
        verify(entityManager, never()).lock(any(), any(LockModeType.class));
    }

    @Test
    void updateWithUnchangedNameForcesVersionIncrement() {
        when(setlistRepository.saveAndFlush(entity)).thenReturn(entity);

        setlistService.update(user, bandId, setlistId, "Original", List.of(), 0);

        verify(entityManager).lock(entity, LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        verify(setlistRepository).saveAndFlush(entity);
    }

    @Test
    void deleteTranslatesOptimisticLockingFailureToStaleVersion() {
        doThrow(new OptimisticLockingFailureException("concurrent delete"))
                .when(setlistRepository)
                .flush();

        assertThatThrownBy(() -> setlistService.delete(user, bandId, setlistId, 0))
                .isInstanceOf(StaleSetlistVersionException.class);
    }
}
