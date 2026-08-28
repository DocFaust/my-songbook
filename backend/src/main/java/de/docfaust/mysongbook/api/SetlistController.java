package de.docfaust.mysongbook.api;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.setlist.Setlist;
import de.docfaust.mysongbook.setlist.SetlistService;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bands/{bandId}/setlists")
public class SetlistController {

    private final UserService userService;
    private final SetlistService setlistService;

    public SetlistController(UserService userService, SetlistService setlistService) {
        this.userService = userService;
        this.setlistService = setlistService;
    }

    @GetMapping
    public List<Setlist> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bandId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return setlistService.list(user, bandId);
    }

    @GetMapping("/{setlistId}")
    public Setlist get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID setlistId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return setlistService.get(user, bandId, setlistId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Setlist create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @RequestBody CreateSetlistRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return setlistService.create(user, bandId, request.name(), request.songIds());
    }

    @PutMapping("/{setlistId}")
    public Setlist update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID setlistId,
            @RequestBody UpdateSetlistRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return setlistService.update(
                user,
                bandId,
                setlistId,
                request.name(),
                request.songIds(),
                request.version());
    }

    @DeleteMapping("/{setlistId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID setlistId,
            @RequestParam int version) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        setlistService.delete(user, bandId, setlistId, version);
    }
}
