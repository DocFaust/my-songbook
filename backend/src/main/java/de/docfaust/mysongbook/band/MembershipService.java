package de.docfaust.mysongbook.band;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.user.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MembershipService {

    private final BandAccessService bandAccessService;
    private final MembershipRepository membershipRepository;

    public MembershipService(BandAccessService bandAccessService, MembershipRepository membershipRepository) {
        this.bandAccessService = bandAccessService;
        this.membershipRepository = membershipRepository;
    }

    public List<BandMember> list(User user, UUID bandId) {
        bandAccessService.requireMembership(bandId, user.id());
        return membershipRepository.findByBandIdOrderByUserIdAsc(bandId).stream()
                .map(membership -> new BandMember(
                        membership.getUserId(),
                        membership.getUserId().toString(),
                        membership.getRole()))
                .toList();
    }

    @Transactional
    public BandMember updateRole(User actor, UUID bandId, UUID userId, String rawRole) {
        bandAccessService.requireAnyRole(bandId, actor.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        MembershipRole requested = parseAssignableRole(rawRole);
        MembershipEntity membership = membershipInBand(bandId, userId);
        if (membership.getRole() == MembershipRole.OWNER) {
            throw new IllegalArgumentException("OWNER role cannot be changed");
        }
        membership.setRole(requested);
        membershipRepository.save(membership);
        return new BandMember(membership.getUserId(), membership.getUserId().toString(), membership.getRole());
    }

    @Transactional
    public void remove(User actor, UUID bandId, UUID userId) {
        bandAccessService.requireAnyRole(bandId, actor.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        if (actor.id().equals(userId)) {
            throw new IllegalArgumentException("Cannot remove yourself");
        }
        MembershipEntity membership = membershipInBand(bandId, userId);
        if (membership.getRole() == MembershipRole.OWNER) {
            throw new IllegalArgumentException("OWNER cannot be removed");
        }
        membershipRepository.delete(membership);
    }

    private MembershipEntity membershipInBand(UUID bandId, UUID userId) {
        return membershipRepository.findByBandIdAndUserId(bandId, userId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    static MembershipRole parseAssignableRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            throw new IllegalArgumentException("Invalid role");
        }
        MembershipRole role;
        try {
            role = MembershipRole.valueOf(rawRole.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid role");
        }
        if (role == MembershipRole.OWNER) {
            throw new IllegalArgumentException("OWNER role cannot be assigned");
        }
        return role;
    }
}
