package mysongbook.api;

import java.util.List;
import java.util.UUID;

import mysongbook.song.Song;
import mysongbook.song.SongService;
import mysongbook.user.User;
import mysongbook.user.UserService;

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
@RequestMapping("/api/bands/{bandId}/songs")
public class SongController {

    private final UserService userService;
    private final SongService songService;

    public SongController(UserService userService, SongService songService) {
        this.userService = userService;
        this.songService = songService;
    }

    @GetMapping
    public List<Song> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID bandId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return songService.list(user, bandId);
    }

    @GetMapping("/{songId}")
    public Song get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID songId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return songService.get(user, bandId, songId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Song create(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @RequestBody CreateSongRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return songService.create(user, bandId, request.title(), request.artist(), request.content());
    }

    @PutMapping("/{songId}")
    public Song update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID songId,
            @RequestBody UpdateSongRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return songService.update(
                user,
                bandId,
                songId,
                request.title(),
                request.artist(),
                request.content(),
                request.version());
    }

    @DeleteMapping("/{songId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID songId,
            @RequestParam int version) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        songService.delete(user, bandId, songId, version);
    }
}
