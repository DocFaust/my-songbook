package de.docfaust.mysongbook.api;

import java.util.LinkedHashMap;
import java.util.Map;

import de.docfaust.mysongbook.note.NoteConflictException;
import de.docfaust.mysongbook.note.NoteUnavailableException;
import de.docfaust.mysongbook.setlist.StaleSetlistVersionException;
import de.docfaust.mysongbook.song.StaleSongVersionException;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Map<String, String>> forbidden(ForbiddenOperationException exception) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(ResourceNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(NoteUnavailableException.class)
    public ResponseEntity<Map<String, String>> noteUnavailable(NoteUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", exception.getMessage(),
                "code", exception.getCode()));
    }

    @ExceptionHandler(NoteConflictException.class)
    public ResponseEntity<Map<String, Object>> noteConflict(NoteConflictException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", exception.getMessage());
        body.put("code", exception.getCode());
        if (exception.getText() != null) {
            body.put("text", exception.getText());
        }
        if (exception.getVersion() != null) {
            body.put("version", exception.getVersion());
        }
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler({
            StaleSongVersionException.class,
            StaleSetlistVersionException.class,
            ConflictException.class
    })
    public ResponseEntity<Map<String, String>> conflict(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(InvitationExpiredException.class)
    public ResponseEntity<Map<String, String>> gone(InvitationExpiredException exception) {
        return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, String>> optimisticLock(OptimisticLockingFailureException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "stale version"));
    }
}
