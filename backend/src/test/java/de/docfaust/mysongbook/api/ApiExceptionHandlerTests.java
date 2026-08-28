package de.docfaust.mysongbook.api;

import java.util.Map;

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
}
