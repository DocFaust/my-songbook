package de.docfaust.mysongbook.api;

import de.docfaust.mysongbook.invitation.AcceptedInvitation;
import de.docfaust.mysongbook.invitation.InvitationService;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invitations")
public class InvitationAcceptanceController {

    private final UserService userService;
    private final InvitationService invitationService;

    public InvitationAcceptanceController(UserService userService, InvitationService invitationService) {
        this.userService = userService;
        this.invitationService = invitationService;
    }

    @PostMapping("/{token}/accept")
    public AcceptedInvitationResponse accept(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String token) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        AcceptedInvitation accepted = invitationService.accept(user, token);
        return new AcceptedInvitationResponse(accepted.bandId(), accepted.bandName(), accepted.role());
    }
}
