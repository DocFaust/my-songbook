package de.docfaust.mysongbook.band;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MembershipRepository extends JpaRepository<MembershipEntity, MembershipId> {

    Optional<MembershipEntity> findByBandIdAndUserId(UUID bandId, UUID userId);
}
