package de.docfaust.mysongbook.band;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.api.ForbiddenOperationException;
import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.note.PersonalSongNoteRepository;
import de.docfaust.mysongbook.user.User;

import jakarta.persistence.EntityManager;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MembershipService {

    private final BandAccessService bandAccessService;
    private final BandRepository bandRepository;
    private final MembershipRepository membershipRepository;
    private final PersonalSongNoteRepository personalSongNoteRepository;
    private final EntityManager entityManager;

    public MembershipService(
            BandAccessService bandAccessService,
            BandRepository bandRepository,
            MembershipRepository membershipRepository,
            PersonalSongNoteRepository personalSongNoteRepository,
            EntityManager entityManager) {
        this.bandAccessService = bandAccessService;
        this.bandRepository = bandRepository;
        this.membershipRepository = membershipRepository;
        this.personalSongNoteRepository = personalSongNoteRepository;
        this.entityManager = entityManager;
    }

    public List<BandMember> list(User user, UUID bandId) {
        bandAccessService.requireMembership(bandId, user.id());
        return membershipRepository.findByBandIdOrderByUserIdAsc(bandId).stream()
                .map(MembershipService::toMember)
                .toList();
    }

    @Transactional
    public OwnershipTransfer transferOwnership(User actor, UUID bandId, UUID targetUserId) {
        bandAccessService.requireAnyRole(bandId, actor.id(), MembershipRole.OWNER);
        if (targetUserId == null) {
            throw new IllegalArgumentException("Target member is required");
        }
        lockBand(bandId);
        MembershipEntity currentOwner = reloadAuthorizedActor(bandId, actor.id(), MembershipRole.OWNER);
        if (actor.id().equals(targetUserId)) {
            throw new IllegalArgumentException("Ownership cannot be transferred to yourself");
        }
        MembershipEntity target = membershipInBand(bandId, targetUserId);
        currentOwner.setRole(MembershipRole.ADMIN);
        target.setRole(MembershipRole.OWNER);
        membershipRepository.save(currentOwner);
        membershipRepository.save(target);
        return new OwnershipTransfer(toMember(target), toMember(currentOwner));
    }

    @Transactional
    public void leave(User actor, UUID bandId) {
        bandAccessService.requireMembership(bandId, actor.id());
        lockBand(bandId);
        MembershipEntity membership = membershipInBand(bandId, actor.id());
        if (membership.getRole() == MembershipRole.OWNER) {
            throw new IllegalArgumentException("OWNER cannot leave the band");
        }
        deletePersonalNotes(bandId, actor.id());
        membershipRepository.delete(membership);
    }

    @Transactional
    public BandMember updateRole(User actor, UUID bandId, UUID userId, String rawRole) {
        bandAccessService.requireAnyRole(bandId, actor.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        lockBand(bandId);
        reloadAuthorizedActor(bandId, actor.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        MembershipRole requested = parseAssignableRole(rawRole);
        MembershipEntity membership = membershipInBand(bandId, userId);
        if (membership.getRole() == MembershipRole.OWNER) {
            throw new IllegalArgumentException("OWNER role cannot be changed");
        }
        membership.setRole(requested);
        membershipRepository.save(membership);
        return toMember(membership);
    }

    @Transactional
    public void remove(User actor, UUID bandId, UUID userId) {
        bandAccessService.requireAnyRole(bandId, actor.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        if (actor.id().equals(userId)) {
            throw new IllegalArgumentException("Cannot remove yourself");
        }
        lockBand(bandId);
        reloadAuthorizedActor(bandId, actor.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        MembershipEntity membership = membershipInBand(bandId, userId);
        if (membership.getRole() == MembershipRole.OWNER) {
            throw new IllegalArgumentException("OWNER cannot be removed");
        }
        deletePersonalNotes(bandId, userId);
        membershipRepository.delete(membership);
    }

    private void deletePersonalNotes(UUID bandId, UUID userId) {
        personalSongNoteRepository.deleteByUserIdAndBandId(userId, bandId);
    }

    private MembershipEntity reloadAuthorizedActor(UUID bandId, UUID actorId, MembershipRole... allowedRoles) {
        MembershipEntity actor = membershipInBand(bandId, actorId);
        for (MembershipRole allowed : allowedRoles) {
            if (actor.getRole() == allowed) {
                return actor;
            }
        }
        throw new ForbiddenOperationException();
    }

    /**
     * Serializes membership writes of one band. The row lock is held until the
     * surrounding transaction commits, so a transfer cannot commit zero or two
     * owners. The persistence context is cleared because an earlier read in this
     * transaction may be stale after waiting for the lock.
     */
    private void lockBand(UUID bandId) {
        if (bandRepository.findByIdForUpdate(bandId).isEmpty()) {
            throw new ResourceNotFoundException();
        }
        entityManager.clear();
    }

    private MembershipEntity membershipInBand(UUID bandId, UUID userId) {
        return membershipRepository.findByBandIdAndUserId(bandId, userId)
                .orElseThrow(ResourceNotFoundException::new);
    }

    private static BandMember toMember(MembershipEntity membership) {
        return new BandMember(
                membership.getUserId(),
                membership.getUserId().toString(),
                membership.getRole());
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
