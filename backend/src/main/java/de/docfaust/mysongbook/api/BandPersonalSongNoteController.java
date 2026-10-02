package de.docfaust.mysongbook.api;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.note.BandPersonalSongNote;
import de.docfaust.mysongbook.note.PersonalSongNoteService;
import de.docfaust.mysongbook.user.User;
import de.docfaust.mysongbook.user.UserService;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bands/{bandId}/notes")
public class BandPersonalSongNoteController {

    private final UserService userService;
    private final PersonalSongNoteService noteService;

    public BandPersonalSongNoteController(UserService userService, PersonalSongNoteService noteService) {
        this.userService = userService;
        this.noteService = noteService;
    }

    @GetMapping
    public List<BandPersonalSongNote> list(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return noteService.listForBand(user, bandId);
    }
}
