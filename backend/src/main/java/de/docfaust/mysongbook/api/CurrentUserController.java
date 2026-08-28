package de.docfaust.mysongbook.api;

import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CurrentUserController {

    private final UserService userService;

    public CurrentUserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/api/me")
    public CurrentUserResponse currentUser(@AuthenticationPrincipal Jwt jwt) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return new CurrentUserResponse(user.id());
    }
}
