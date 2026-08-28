package de.docfaust.mysongbook.band;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BandRepository extends JpaRepository<BandEntity, UUID> {

    @Query("""
            SELECT new de.docfaust.mysongbook.band.UserBand(b.id, b.name, m.role)
            FROM MembershipEntity m, BandEntity b
            WHERE b.id = m.bandId AND m.userId = :userId
            ORDER BY b.name ASC, b.id ASC
            """)
    List<UserBand> findByUserId(@Param("userId") UUID userId);
}
