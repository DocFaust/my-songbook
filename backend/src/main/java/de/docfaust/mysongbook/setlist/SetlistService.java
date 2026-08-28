package de.docfaust.mysongbook.setlist;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.song.SongEntity;
import de.docfaust.mysongbook.song.SongRepository;
import de.docfaust.mysongbook.user.User;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SetlistService {

    static final int MAX_NAME_LENGTH = 200;
    static final int INITIAL_VERSION = 0;

    private final SetlistRepository setlistRepository;
    private final SetlistEntryRepository setlistEntryRepository;
    private final SongRepository songRepository;
    private final BandAccessService bandAccessService;
    private final EntityManager entityManager;

    public SetlistService(
            SetlistRepository setlistRepository,
            SetlistEntryRepository setlistEntryRepository,
            SongRepository songRepository,
            BandAccessService bandAccessService,
            EntityManager entityManager) {
        this.setlistRepository = setlistRepository;
        this.setlistEntryRepository = setlistEntryRepository;
        this.songRepository = songRepository;
        this.bandAccessService = bandAccessService;
        this.entityManager = entityManager;
    }

    public List<Setlist> list(User user, UUID bandId) {
        bandAccessService.requireMembership(bandId, user.id());
        List<SetlistEntity> setlists = setlistRepository.findByBandIdOrderByNameAscIdAsc(bandId);
        if (setlists.isEmpty()) {
            return List.of();
        }
        List<UUID> setlistIds = setlists.stream().map(SetlistEntity::getId).toList();
        Map<UUID, List<UUID>> songIdsBySetlist = new LinkedHashMap<>();
        for (SetlistEntity setlist : setlists) {
            songIdsBySetlist.put(setlist.getId(), new ArrayList<>());
        }
        for (SetlistEntryEntity entry : setlistEntryRepository.findBySetlistIdInOrderBySetlistIdAscPositionAsc(setlistIds)) {
            songIdsBySetlist.get(entry.getSetlistId()).add(entry.getSongId());
        }
        return setlists.stream()
                .map(setlist -> setlist.toDomain(songIdsBySetlist.get(setlist.getId())))
                .toList();
    }

    public Setlist get(User user, UUID bandId, UUID setlistId) {
        bandAccessService.requireMembership(bandId, user.id());
        return toDomain(requireSetlist(bandId, setlistId));
    }

    @Transactional
    public Setlist create(User user, UUID bandId, String rawName, List<UUID> rawSongIds) {
        bandAccessService.requireAnyRole(
                bandId,
                user.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN,
                MembershipRole.MEMBER);
        List<UUID> songIds = validatedSongIds(bandId, rawSongIds);
        SetlistEntity entity = new SetlistEntity(
                UUID.randomUUID(),
                bandId,
                normalizeName(rawName),
                INITIAL_VERSION);
        setlistRepository.saveAndFlush(entity);
        persistEntries(entity.getId(), songIds);
        return entity.toDomain(songIds);
    }

    @Transactional
    public Setlist update(
            User user,
            UUID bandId,
            UUID setlistId,
            String rawName,
            List<UUID> rawSongIds,
            Integer expectedVersion) {
        bandAccessService.requireAnyRole(
                bandId,
                user.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN,
                MembershipRole.MEMBER);
        requireExpectedVersion(expectedVersion);
        SetlistEntity entity = requireSetlist(bandId, setlistId);
        if (entity.getVersion() != expectedVersion) {
            throw new StaleSetlistVersionException();
        }
        List<UUID> songIds = validatedSongIds(bandId, rawSongIds);
        setlistEntryRepository.deleteBySetlistId(entity.getId());
        setlistEntryRepository.flush();
        persistEntries(entity.getId(), songIds);
        String name = normalizeName(rawName);
        boolean nameChanged = !entity.getName().equals(name);
        entity.setName(name);
        if (!nameChanged) {
            entityManager.lock(entity, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
        }
        try {
            setlistRepository.saveAndFlush(entity);
        } catch (OptimisticLockingFailureException exception) {
            throw new StaleSetlistVersionException();
        }
        Setlist updated = entity.toDomain(songIds);
        if (!nameChanged) {
            return new Setlist(
                    updated.id(),
                    updated.bandId(),
                    updated.name(),
                    updated.songIds(),
                    updated.version() + 1);
        }
        return updated;
    }

    @Transactional
    public void delete(User user, UUID bandId, UUID setlistId, int expectedVersion) {
        bandAccessService.requireAnyRole(
                bandId,
                user.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN);
        requireExpectedVersion(expectedVersion);
        SetlistEntity entity = requireSetlist(bandId, setlistId);
        if (entity.getVersion() != expectedVersion) {
            throw new StaleSetlistVersionException();
        }
        try {
            setlistRepository.delete(entity);
            setlistRepository.flush();
        } catch (OptimisticLockingFailureException exception) {
            throw new StaleSetlistVersionException();
        }
    }

    private SetlistEntity requireSetlist(UUID bandId, UUID setlistId) {
        return setlistRepository.findByBandIdAndId(bandId, setlistId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    private Setlist toDomain(SetlistEntity entity) {
        List<UUID> songIds = setlistEntryRepository.findBySetlistIdOrderByPositionAsc(entity.getId()).stream()
                .map(SetlistEntryEntity::getSongId)
                .toList();
        return entity.toDomain(songIds);
    }

    private void persistEntries(UUID setlistId, List<UUID> songIds) {
        List<SetlistEntryEntity> entries = new ArrayList<>(songIds.size());
        for (int position = 0; position < songIds.size(); position++) {
            entries.add(new SetlistEntryEntity(UUID.randomUUID(), setlistId, songIds.get(position), position));
        }
        setlistEntryRepository.saveAll(entries);
    }

    private List<UUID> validatedSongIds(UUID bandId, List<UUID> rawSongIds) {
        List<UUID> songIds = requireSongIds(rawSongIds);
        if (songIds.isEmpty()) {
            return songIds;
        }
        Set<UUID> distinctIds = new LinkedHashSet<>(songIds);
        List<SongEntity> found = songRepository.findByBandIdAndIdIn(bandId, distinctIds);
        if (found.size() != distinctIds.size()) {
            throw new ResourceNotFoundException();
        }
        return songIds;
    }

    static List<UUID> requireSongIds(List<UUID> rawSongIds) {
        if (rawSongIds == null) {
            return List.of();
        }
        for (UUID songId : rawSongIds) {
            if (songId == null) {
                throw new IllegalArgumentException("Setlist song id must not be null");
            }
        }
        return List.copyOf(rawSongIds);
    }

    static String normalizeName(String rawName) {
        if (rawName == null) {
            throw new IllegalArgumentException("Setlist name must not be blank");
        }
        String name = rawName.trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Setlist name must not be blank");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Setlist name is too long");
        }
        return name;
    }

    static void requireExpectedVersion(Integer expectedVersion) {
        if (expectedVersion == null) {
            throw new IllegalArgumentException("Setlist version is required");
        }
        if (expectedVersion < 0) {
            throw new IllegalArgumentException("Setlist version is invalid");
        }
    }
}
