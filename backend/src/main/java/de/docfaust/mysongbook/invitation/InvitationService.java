package de.docfaust.mysongbook.invitation;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.api.ConflictException;
import de.docfaust.mysongbook.api.InvitationExpiredException;
import de.docfaust.mysongbook.api.ResourceNotFoundException;
import de.docfaust.mysongbook.band.BandAccessService;
import de.docfaust.mysongbook.band.BandEntity;
import de.docfaust.mysongbook.band.BandRepository;
import de.docfaust.mysongbook.band.MembershipEntity;
import de.docfaust.mysongbook.band.MembershipRepository;
import de.docfaust.mysongbook.band.MembershipRole;
import de.docfaust.mysongbook.user.User;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvitationService {

    public static final Duration VALIDITY = Duration.ofDays(14);

    private final BandAccessService bandAccessService;
    private final BandRepository bandRepository;
    private final BandInvitationRepository invitationRepository;
    private final MembershipRepository membershipRepository;

    public InvitationService(
            BandAccessService bandAccessService,
            BandRepository bandRepository,
            BandInvitationRepository invitationRepository,
            MembershipRepository membershipRepository) {
        this.bandAccessService = bandAccessService;
        this.bandRepository = bandRepository;
        this.invitationRepository = invitationRepository;
        this.membershipRepository = membershipRepository;
    }

    @Transactional
    public CreatedInvitation create(User user, UUID bandId) {
        bandAccessService.requireAnyRole(bandId, user.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        Instant createdAt = Instant.now();
        Instant expiresAt = createdAt.plus(VALIDITY);
        String rawToken = InvitationTokens.generateRawToken();
        BandInvitationEntity invitation = new BandInvitationEntity(
                UUID.randomUUID(),
                bandId,
                InvitationTokens.hash(rawToken),
                createdAt,
                expiresAt,
                user.id());
        invitationRepository.save(invitation);
        return new CreatedInvitation(invitation.getId(), bandId, rawToken, expiresAt);
    }

    public List<InvitationView> list(User user, UUID bandId) {
        bandAccessService.requireAnyRole(bandId, user.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        Instant now = Instant.now();
        return invitationRepository.findByBandIdOrderByCreatedAtDesc(bandId).stream()
                .map(invitation -> new InvitationView(
                        invitation.getId(),
                        invitation.getCreatedAt(),
                        invitation.getExpiresAt(),
                        invitation.statusAt(now)))
                .toList();
    }

    @Transactional
    public void revoke(User user, UUID bandId, UUID invitationId) {
        bandAccessService.requireAnyRole(bandId, user.id(), MembershipRole.OWNER, MembershipRole.ADMIN);
        BandInvitationEntity invitation = invitationRepository.findByBandIdAndId(bandId, invitationId)
                .orElseThrow(ResourceNotFoundException::new);
        if (invitation.getAcceptedAt() != null) {
            throw new ConflictException("Invitation already accepted");
        }
        invitationRepository.delete(invitation);
    }

    @Transactional
    public AcceptedInvitation accept(User user, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new ResourceNotFoundException();
        }
        BandInvitationEntity invitation = invitationRepository
                .findByTokenHashForUpdate(InvitationTokens.hash(rawToken))
                .orElseThrow(ResourceNotFoundException::new);
        Instant now = Instant.now();
        if (invitation.getAcceptedAt() != null) {
            return alreadyAccepted(user, invitation);
        }
        if (!invitation.getExpiresAt().isAfter(now)) {
            throw new InvitationExpiredException();
        }

        MembershipRole role = existingRoleOrGuest(invitation.getBandId(), user.id());
        invitation.markAccepted(now, user.id());
        invitationRepository.save(invitation);
        return acceptedResponse(invitation.getBandId(), role);
    }

    private AcceptedInvitation alreadyAccepted(User user, BandInvitationEntity invitation) {
        if (user.id().equals(invitation.getAcceptedBy())) {
            return membershipRepository.findByBandIdAndUserId(invitation.getBandId(), user.id())
                    .map(membership -> acceptedResponse(invitation.getBandId(), membership.getRole()))
                    .orElseThrow(() -> new ConflictException("Invitation already accepted"));
        }
        throw new ConflictException("Invitation already accepted");
    }

    private MembershipRole existingRoleOrGuest(UUID bandId, UUID userId) {
        return membershipRepository.findByBandIdAndUserId(bandId, userId)
                .map(MembershipEntity::getRole)
                .orElseGet(() -> createGuestMembership(bandId, userId));
    }

    private MembershipRole createGuestMembership(UUID bandId, UUID userId) {
        try {
            membershipRepository.saveAndFlush(new MembershipEntity(bandId, userId, MembershipRole.GUEST));
            return MembershipRole.GUEST;
        } catch (DataIntegrityViolationException exception) {
            return membershipRepository.findByBandIdAndUserId(bandId, userId)
                    .map(MembershipEntity::getRole)
                    .orElseThrow(() -> exception);
        }
    }

    private AcceptedInvitation acceptedResponse(UUID bandId, MembershipRole role) {
        BandEntity band = bandRepository.findById(bandId).orElseThrow(ResourceNotFoundException::new);
        return new AcceptedInvitation(band.getId(), band.getName(), role);
    }
}
