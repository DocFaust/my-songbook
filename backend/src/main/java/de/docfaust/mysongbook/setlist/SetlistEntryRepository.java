package de.docfaust.mysongbook.setlist;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SetlistEntryRepository extends JpaRepository<SetlistEntryEntity, UUID> {

    List<SetlistEntryEntity> findBySetlistIdOrderByPositionAsc(UUID setlistId);

    List<SetlistEntryEntity> findBySetlistIdInOrderBySetlistIdAscPositionAsc(Collection<UUID> setlistIds);

    void deleteBySetlistId(UUID setlistId);
}
