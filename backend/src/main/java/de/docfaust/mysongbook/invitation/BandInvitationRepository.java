package de.docfaust.mysongbook.invitation;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BandInvitationRepository extends JpaRepository<BandInvitationEntity, UUID> {

    Optional<BandInvitationEntity> findByBandIdAndId(UUID bandId, UUID id);

    List<BandInvitationEntity> findByBandIdOrderByCreatedAtDesc(UUID bandId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM BandInvitationEntity i WHERE i.tokenHash = :tokenHash")
    Optional<BandInvitationEntity> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
}
