package de.docfaust.mysongbook.band;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BandRepository extends JpaRepository<BandEntity, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM BandEntity b WHERE b.id = :id")
    Optional<BandEntity> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
            SELECT new de.docfaust.mysongbook.band.UserBand(b.id, b.name, m.role)
            FROM MembershipEntity m, BandEntity b
            WHERE b.id = m.bandId AND m.userId = :userId
            ORDER BY b.name ASC, b.id ASC
            """)
    List<UserBand> findByUserId(@Param("userId") UUID userId);
}
