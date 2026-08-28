package de.docfaust.mysongbook.song;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SongRepository extends JpaRepository<SongEntity, UUID> {

    List<SongEntity> findByBandIdOrderByTitleAscIdAsc(UUID bandId);

    Optional<SongEntity> findByBandIdAndId(UUID bandId, UUID songId);

    List<SongEntity> findByBandIdAndIdIn(UUID bandId, Collection<UUID> ids);
}
