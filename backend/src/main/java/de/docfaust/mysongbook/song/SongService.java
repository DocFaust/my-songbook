package de.docfaust.mysongbook.song;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.user.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SongService {

    static final int MAX_TITLE_LENGTH = 200;
    static final int MAX_ARTIST_LENGTH = 200;
    static final int INITIAL_VERSION = 0;

    private final SongRepository songRepository;
    private final BandAccessService bandAccessService;

    public SongService(SongRepository songRepository, BandAccessService bandAccessService) {
        this.songRepository = songRepository;
        this.bandAccessService = bandAccessService;
    }

    public List<Song> list(User user, UUID bandId) {
        bandAccessService.requireMembership(bandId, user.id());
        return songRepository.findByBandId(bandId);
    }

    public Song get(User user, UUID bandId, UUID songId) {
        bandAccessService.requireMembership(bandId, user.id());
        return songRepository.findByBandIdAndId(bandId, songId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    @Transactional
    public Song create(User user, UUID bandId, String rawTitle, String rawArtist, String rawContent) {
        bandAccessService.requireAnyRole(
                bandId,
                user.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN,
                MembershipRole.MEMBER);
        Song song = new Song(
                UUID.randomUUID(),
                bandId,
                normalizeTitle(rawTitle),
                normalizeArtist(rawArtist),
                requireContent(rawContent),
                INITIAL_VERSION);
        songRepository.insert(song);
        return song;
    }

    @Transactional
    public Song update(
            User user,
            UUID bandId,
            UUID songId,
            String rawTitle,
            String rawArtist,
            String rawContent,
            Integer expectedVersion) {
        bandAccessService.requireAnyRole(
                bandId,
                user.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN,
                MembershipRole.MEMBER);
        requireExpectedVersion(expectedVersion);
        if (songRepository.findByBandIdAndId(bandId, songId).isEmpty()) {
            throw new ResourceNotFoundException();
        }
        return songRepository.updateIfVersionMatches(
                bandId,
                songId,
                normalizeTitle(rawTitle),
                normalizeArtist(rawArtist),
                requireContent(rawContent),
                expectedVersion)
                .orElseThrow(() -> conflictOrNotFound(bandId, songId));
    }

    @Transactional
    public void delete(User user, UUID bandId, UUID songId, int expectedVersion) {
        bandAccessService.requireAnyRole(
                bandId,
                user.id(),
                MembershipRole.OWNER,
                MembershipRole.ADMIN);
        requireExpectedVersion(expectedVersion);
        if (songRepository.findByBandIdAndId(bandId, songId).isEmpty()) {
            throw new ResourceNotFoundException();
        }
        int deleted = songRepository.deleteIfVersionMatches(bandId, songId, expectedVersion);
        if (deleted == 0) {
            throw conflictOrNotFound(bandId, songId);
        }
    }

    private RuntimeException conflictOrNotFound(UUID bandId, UUID songId) {
        if (songRepository.findByBandIdAndId(bandId, songId).isEmpty()) {
            return new ResourceNotFoundException();
        }
        return new StaleSongVersionException();
    }

    static String normalizeTitle(String rawTitle) {
        if (rawTitle == null) {
            throw new IllegalArgumentException("Song title must not be blank");
        }
        String title = rawTitle.trim();
        if (title.isEmpty()) {
            throw new IllegalArgumentException("Song title must not be blank");
        }
        if (title.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("Song title is too long");
        }
        return title;
    }

    static String normalizeArtist(String rawArtist) {
        String artist = rawArtist == null ? "" : rawArtist.trim();
        if (artist.length() > MAX_ARTIST_LENGTH) {
            throw new IllegalArgumentException("Song artist is too long");
        }
        return artist;
    }

    static String requireContent(String rawContent) {
        if (rawContent == null || rawContent.isBlank()) {
            throw new IllegalArgumentException("Song content must not be blank");
        }
        return rawContent;
    }

    static void requireExpectedVersion(Integer expectedVersion) {
        if (expectedVersion == null) {
            throw new IllegalArgumentException("Song version is required");
        }
        if (expectedVersion < 0) {
            throw new IllegalArgumentException("Song version is invalid");
        }
    }
}
