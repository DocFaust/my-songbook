package de.docfaust.mysongbook.setlist;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SetlistRepository extends JpaRepository<SetlistEntity, UUID> {

    List<SetlistEntity> findByBandIdOrderByNameAscIdAsc(UUID bandId);

    Optional<SetlistEntity> findByBandIdAndId(UUID bandId, UUID id);
}
