package de.docfaust.mysongbook.api;

import java.util.Map;

import de.docfaust.mysongbook.setlist.StaleSetlistVersionException;
import de.docfaust.mysongbook.song.StaleSongVersionException;

import org.junit.jupiter.api.Test;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import static org.assertj.core.api.Assertions.assertThat;

class ApiExceptionHandlerTests {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void optimisticLockingFailureReturnsHttp409StaleVersion() {
        ResponseEntity<Map<String, String>> response = handler.optimisticLock(
                new OptimisticLockingFailureException("concurrent update"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("error", "stale version");
    }

    @Test
    void objectOptimisticLockingFailureReturnsHttp409StaleVersion() {
        ResponseEntity<Map<String, String>> response = handler.optimisticLock(
                new ObjectOptimisticLockingFailureException("Song", "song-id"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("error", "stale version");
    }

    @Test
    void staleSongAndSetlistVersionExceptionsReturnHttp409() {
        ResponseEntity<Map<String, String>> song = handler.conflict(new StaleSongVersionException());
        ResponseEntity<Map<String, String>> setlist = handler.conflict(new StaleSetlistVersionException());

        assertThat(song.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(song.getBody()).containsEntry("error", "stale version");
        assertThat(setlist.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(setlist.getBody()).containsEntry("error", "stale version");
    }

    @Test
    void conflictExceptionReturnsHttp409WithMessage() {
        ResponseEntity<Map<String, String>> response = handler.conflict(
                new ConflictException("Invitation already accepted"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).containsEntry("error", "Invitation already accepted");
    }

    @Test
    void invitationExpiredReturnsHttp410() {
        ResponseEntity<Map<String, String>> response = handler.gone(new InvitationExpiredException());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(response.getBody()).containsEntry("error", "Invitation expired");
    }
}
