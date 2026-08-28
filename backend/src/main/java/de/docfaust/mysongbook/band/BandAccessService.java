package de.docfaust.mysongbook.band;

import java.util.UUID;

import de.docfaust.mysongbook.api.ForbiddenOperationException;
import de.docfaust.mysongbook.api.ResourceNotFoundException;

import org.springframework.stereotype.Service;

@Service
public class BandAccessService {

    private final MembershipRepository membershipRepository;

    public BandAccessService(MembershipRepository membershipRepository) {
        this.membershipRepository = membershipRepository;
    }

    public Membership requireMembership(UUID bandId, UUID userId) {
        return membershipRepository.findByBandIdAndUserId(bandId, userId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    public Membership requireAnyRole(UUID bandId, UUID userId, MembershipRole... allowedRoles) {
        Membership membership = requireMembership(bandId, userId);
        for (MembershipRole allowed : allowedRoles) {
            if (membership.role() == allowed) {
                return membership;
            }
        }
        throw new ForbiddenOperationException();
    }
}
