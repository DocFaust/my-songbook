package de.docfaust.mysongbook.api;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.invitation.CreatedInvitation;
import de.docfaust.mysongbook.invitation.InvitationService;
import de.docfaust.mysongbook.invitation.InvitationView;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bands/{bandId}/invitations")
public class BandInvitationController {

    private final UserService userService;
    private final InvitationService invitationService;
    private final String frontendOrigin;

    public BandInvitationController(
            UserService userService,
            InvitationService invitationService,
            @Value("${FRONTEND_ORIGIN:http://localhost:5173}") String frontendOrigin) {
        this.userService = userService;
        this.invitationService = invitationService;
        this.frontendOrigin = firstOrigin(frontendOrigin);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CreatedInvitationResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        CreatedInvitation created = invitationService.create(user, bandId);
        return new CreatedInvitationResponse(
                created.id(),
                created.bandId(),
                created.token(),
                created.expiresAt(),
                frontendOrigin + "/invite/" + created.token());
    }

    @GetMapping
    public List<InvitationView> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bandId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return invitationService.list(user, bandId);
    }

    @DeleteMapping("/{invitationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void revoke(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID invitationId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        invitationService.revoke(user, bandId, invitationId);
    }

    static String firstOrigin(String frontendOrigin) {
        String first = frontendOrigin.split(",")[0].trim();
        if (first.endsWith("/")) {
            return first.substring(0, first.length() - 1);
        }
        return first;
    }
}
