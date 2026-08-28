package de.docfaust.mysongbook.api;

import java.util.List;

import de.docfaust.mysongbook.band.BandService;
import de.docfaust.mysongbook.band.UserBand;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bands")
public class BandController {

    private final UserService userService;
    private final BandService bandService;

    public BandController(UserService userService, BandService bandService) {
        this.userService = userService;
        this.bandService = bandService;
    }

    @GetMapping
    public List<UserBand> list(@AuthenticationPrincipal Jwt jwt) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return bandService.listFor(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserBand create(
            @AuthenticationPrincipal Jwt jwt,
            @RequestBody CreateBandRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return bandService.create(user, request.name());
    }
}
