package de.docfaust.mysongbook.note;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.BandRepository;
import de.docfaust.mysongbook.song.SongRepository;
import de.docfaust.mysongbook.user.User;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
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
        requireNoteTarget(user, bandId, songId);
        return noteRepository.findByUserIdAndSongId(user.id(), songId)
                .map(PersonalSongNoteEntity::toDomain)
                .orElseGet(PersonalSongNote::empty);
    }

    @Transactional(readOnly = true)
    public List<BandPersonalSongNote> listForBand(User user, UUID bandId) {
        requireMembership(user, bandId);
        return noteRepository.findByUserIdAndBandId(user.id(), bandId).stream()
                .map(entity -> new BandPersonalSongNote(entity.getSongId(), entity.getText(), entity.getVersion()))
                .toList();
    }

    @Transactional
    public PersonalSongNote save(
            User user,
            UUID bandId,
            UUID songId,
            String rawText,
            Integer expectedVersion,
            boolean expectAbsent) {
        // Same band-row lock as membership end, so this insert cannot commit
        // after that user's notes for the band were already deleted.
        lockBand(bandId);
        requireNoteTarget(user, bandId, songId);
        if (expectAbsent && expectedVersion != null) {
            throw new IllegalArgumentException("Note version is invalid");
        }
        String text = storedText(rawText);
        Optional<PersonalSongNoteEntity> existing = noteRepository.findByUserIdAndSongId(user.id(), songId);
        if (expectAbsent || expectedVersion != null) {
            return saveConditional(user, songId, text, expectedVersion, expectAbsent, existing);
        }
        return saveUnconditional(user, songId, text, existing);
    }

    @Transactional
    public void delete(User user, UUID bandId, UUID songId, Integer expectedVersion) {
        lockBand(bandId);
        requireNoteTarget(user, bandId, songId);
        Optional<PersonalSongNoteEntity> existing = noteRepository.findByUserIdAndSongId(user.id(), songId);
        if (expectedVersion == null) {
            existing.ifPresent(noteRepository::delete);
            return;
        }
        requireVersion(expectedVersion);
        if (existing.isEmpty()) {
            throw new NoteConflictException("deleted", null, null);
        }
        PersonalSongNoteEntity entity = existing.get();
        if (entity.getVersion() != expectedVersion) {
            throw conflict("changed", entity);
        }
        deleteLocked(entity);
    }

    private PersonalSongNote saveConditional(
            User user,
            UUID songId,
            String text,
            Integer expectedVersion,
            boolean expectAbsent,
            Optional<PersonalSongNoteEntity> existing) {
        if (expectAbsent) {
            if (existing.isPresent()) {
                throw conflict("created", existing.get());
            }
            if (text == null) {
                return PersonalSongNote.empty();
            }
            return insertNote(user, songId, text);
        }
        requireVersion(expectedVersion);
        if (existing.isEmpty()) {
            throw new NoteConflictException("deleted", null, null);
        }
        PersonalSongNoteEntity entity = existing.get();
        if (entity.getVersion() != expectedVersion) {
            throw conflict("changed", entity);
        }
        if (text == null) {
            deleteLocked(entity);
            return PersonalSongNote.empty();
        }
        entity.setText(text);
        saveLocked(entity);
        return entity.toDomain();
    }

    private PersonalSongNote saveUnconditional(
            User user,
            UUID songId,
            String text,
            Optional<PersonalSongNoteEntity> existing) {
        if (text == null) {
            existing.ifPresent(noteRepository::delete);
            return PersonalSongNote.empty();
        }
        if (existing.isPresent()) {
            PersonalSongNoteEntity entity = existing.get();
            entity.setText(text);
            saveLocked(entity);
            return entity.toDomain();
        }
        return insertNote(user, songId, text);
    }

    private PersonalSongNote insertNote(User user, UUID songId, String text) {
        PersonalSongNoteEntity created = new PersonalSongNoteEntity(
                UUID.randomUUID(),
                user.id(),
                songId,
                text);
        try {
            saveLocked(created);
        } catch (DataIntegrityViolationException exception) {
            throw new NoteConflictException("created", null, null);
        }
        return created.toDomain();
    }

    private void saveLocked(PersonalSongNoteEntity entity) {
        try {
            noteRepository.saveAndFlush(entity);
        } catch (OptimisticLockingFailureException exception) {
            throw new NoteConflictException("changed", null, null);
        }
    }

    private void deleteLocked(PersonalSongNoteEntity entity) {
        try {
            noteRepository.delete(entity);
            noteRepository.flush();
        } catch (OptimisticLockingFailureException exception) {
            throw new NoteConflictException("changed", null, null);
        }
    }

    private static NoteConflictException conflict(String code, PersonalSongNoteEntity entity) {
        return new NoteConflictException(code, entity.getText(), entity.getVersion());
    }

    private static void requireVersion(Integer expectedVersion) {
        if (expectedVersion == null || expectedVersion < 0) {
            throw new IllegalArgumentException("Note version is invalid");
        }
    }

    private void lockBand(UUID bandId) {
        if (bandRepository.findByIdForUpdate(bandId).isEmpty()) {
            throw new NoteUnavailableException("membership");
        }
    }

    private void requireMembership(User user, UUID bandId) {
        try {
            bandAccessService.requireMembership(bandId, user.id());
        } catch (ResourceNotFoundException exception) {
            throw new NoteUnavailableException("membership");
        }
    }

    private void requireNoteTarget(User user, UUID bandId, UUID songId) {
        requireMembership(user, bandId);
        if (songRepository.findByBandIdAndId(bandId, songId).isEmpty()) {
            throw new NoteUnavailableException("song");
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
