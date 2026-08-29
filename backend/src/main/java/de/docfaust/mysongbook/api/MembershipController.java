package de.docfaust.mysongbook.api;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.band.BandMember;
import de.docfaust.mysongbook.band.MembershipService;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bands/{bandId}/members")
public class MembershipController {

    private final UserService userService;
    private final MembershipService membershipService;

    public MembershipController(UserService userService, MembershipService membershipService) {
        this.userService = userService;
        this.membershipService = membershipService;
    }

    @GetMapping
    public List<BandMember> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bandId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return membershipService.list(user, bandId);
    }

    @PutMapping("/{userId}/role")
    public BandMember updateRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID userId,
            @RequestBody UpdateMemberRoleRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return membershipService.updateRole(user, bandId, userId, request.role());
    }

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID userId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        membershipService.remove(user, bandId, userId);
    }
}
