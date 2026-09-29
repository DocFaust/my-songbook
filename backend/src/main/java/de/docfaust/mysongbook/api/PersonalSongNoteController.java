package de.docfaust.mysongbook.api;

import java.util.UUID;

import de.docfaust.mysongbook.note.PersonalSongNote;
import de.docfaust.mysongbook.note.PersonalSongNoteService;
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
@RequestMapping("/api/bands/{bandId}/songs/{songId}/note")
public class PersonalSongNoteController {

    private final UserService userService;
    private final PersonalSongNoteService noteService;

    public PersonalSongNoteController(UserService userService, PersonalSongNoteService noteService) {
        this.userService = userService;
        this.noteService = noteService;
    }

    @GetMapping
    public PersonalSongNote get(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID songId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return noteService.get(user, bandId, songId);
    }

    @PutMapping
    public PersonalSongNote save(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID songId,
            @RequestBody SavePersonalSongNoteRequest request) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        return noteService.save(user, bandId, songId, request.text());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID bandId,
            @PathVariable UUID songId) {
        User user = userService.findOrCreateByExternalSubject(jwt.getSubject());
        noteService.delete(user, bandId, songId);
    }
}
