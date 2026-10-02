package de.docfaust.mysongbook.note;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.BandRepository;
import de.docfaust.mysongbook.song.SongRepository;
import de.docfaust.mysongbook.user.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PersonalSongNoteService {

    private final PersonalSongNoteRepository noteRepository;
    private final SongRepository songRepository;
    private final BandRepository bandRepository;
    private final BandAccessService bandAccessService;

    public PersonalSongNoteService(
            PersonalSongNoteRepository noteRepository,
            SongRepository songRepository,
            BandRepository bandRepository,
            BandAccessService bandAccessService) {
        this.noteRepository = noteRepository;
        this.songRepository = songRepository;
        this.bandRepository = bandRepository;
        this.bandAccessService = bandAccessService;
    }

    @Transactional(readOnly = true)
    public PersonalSongNote get(User user, UUID bandId, UUID songId) {
        requireSongOfMember(user, bandId, songId);
        return noteRepository.findByUserIdAndSongId(user.id(), songId)
                .map(PersonalSongNoteEntity::toDomain)
                .orElseGet(PersonalSongNote::empty);
    }

    @Transactional(readOnly = true)
    public List<BandPersonalSongNote> listForBand(User user, UUID bandId) {
        bandAccessService.requireMembership(bandId, user.id());
        return noteRepository.findByUserIdAndBandId(user.id(), bandId).stream()
                .map(entity -> new BandPersonalSongNote(entity.getSongId(), entity.getText()))
                .toList();
    }

    @Transactional
    public PersonalSongNote save(User user, UUID bandId, UUID songId, String rawText) {
        // Same band-row lock as membership end, so this insert cannot commit
        // after that user's notes for the band were already deleted.
        lockBand(bandId);
        requireSongOfMember(user, bandId, songId);
        String text = storedText(rawText);
        Optional<PersonalSongNoteEntity> existing = noteRepository.findByUserIdAndSongId(user.id(), songId);
        if (text == null) {
            existing.ifPresent(noteRepository::delete);
            return PersonalSongNote.empty();
        }
        if (existing.isPresent()) {
            PersonalSongNoteEntity entity = existing.get();
            entity.setText(text);
            noteRepository.save(entity);
            return entity.toDomain();
        }
        PersonalSongNoteEntity created = new PersonalSongNoteEntity(
                UUID.randomUUID(),
                user.id(),
                songId,
                text);
        noteRepository.save(created);
        return created.toDomain();
    }

    @Transactional
    public void delete(User user, UUID bandId, UUID songId) {
        requireSongOfMember(user, bandId, songId);
        noteRepository.findByUserIdAndSongId(user.id(), songId).ifPresent(noteRepository::delete);
    }

    private void lockBand(UUID bandId) {
        if (bandRepository.findByIdForUpdate(bandId).isEmpty()) {
            throw new ResourceNotFoundException();
        }
    }

    private void requireSongOfMember(User user, UUID bandId, UUID songId) {
        bandAccessService.requireMembership(bandId, user.id());
        if (songRepository.findByBandIdAndId(bandId, songId).isEmpty()) {
            throw new ResourceNotFoundException();
        }
    }

    /**
     * Blank notes are not stored. {@code null} means delete the current note.
     */
    static String storedText(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return null;
        }
        return rawText;
    }
}
