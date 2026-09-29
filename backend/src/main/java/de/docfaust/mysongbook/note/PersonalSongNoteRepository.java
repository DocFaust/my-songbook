package de.docfaust.mysongbook.note;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PersonalSongNoteRepository extends JpaRepository<PersonalSongNoteEntity, UUID> {

    Optional<PersonalSongNoteEntity> findByUserIdAndSongId(UUID userId, UUID songId);

    @Modifying(flushAutomatically = true)
    @Query("""
            DELETE FROM PersonalSongNoteEntity note
            WHERE note.userId = :userId
              AND note.songId IN (
                  SELECT song.id FROM SongEntity song WHERE song.bandId = :bandId
              )
            """)
    int deleteByUserIdAndBandId(@Param("userId") UUID userId, @Param("bandId") UUID bandId);
}
