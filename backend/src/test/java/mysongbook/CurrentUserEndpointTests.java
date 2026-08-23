package mysongbook;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import({ PostgresTestcontainersConfiguration.class, TestJwtDecoderConfiguration.class })
class CurrentUserEndpointTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void unauthenticatedRequestReturns401() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/me", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void validAuthenticatedIdentityCreatesUser() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("keycloak-subject-1");
        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/me",
                HttpMethod.GET,
                request,
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("id");

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                "keycloak-subject-1");
        assertThat(count).isEqualTo(1);
    }

    @Test
    void repeatedRequestWithSameSubjectReusesUser() {
        String subject = "keycloak-subject-reuse";
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        HttpEntity<Void> request = new HttpEntity<>(headers);

        ResponseEntity<String> firstResponse = restTemplate.exchange(
                "/api/me",
                HttpMethod.GET,
                request,
                String.class);
        assertThat(firstResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        String firstId = jdbcTemplate.queryForObject(
                "SELECT id::text FROM users WHERE external_subject = ?",
                String.class,
                subject);

        ResponseEntity<String> secondResponse = restTemplate.exchange(
                "/api/me",
                HttpMethod.GET,
                request,
                String.class);
        assertThat(secondResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(secondResponse.getBody()).contains(firstId);

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                subject);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void differentExternalSubjectsCreateDifferentUsers() {
        HttpHeaders headersA = new HttpHeaders();
        headersA.setBearerAuth("subject-a");
        HttpEntity<Void> requestA = new HttpEntity<>(headersA);

        HttpHeaders headersB = new HttpHeaders();
        headersB.setBearerAuth("subject-b");
        HttpEntity<Void> requestB = new HttpEntity<>(headersB);

        ResponseEntity<String> responseA = restTemplate.exchange(
                "/api/me",
                HttpMethod.GET,
                requestA,
                String.class);
        ResponseEntity<String> responseB = restTemplate.exchange(
                "/api/me",
                HttpMethod.GET,
                requestB,
                String.class);

        assertThat(responseA.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(responseB.getStatusCode()).isEqualTo(HttpStatus.OK);

        Integer subjectA = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                "subject-a");
        Integer subjectB = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                "subject-b");
        assertThat(subjectA).isEqualTo(1);
        assertThat(subjectB).isEqualTo(1);
    }

    @Test
    void preflightFromAllowedOriginReceivesCorsHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin("http://localhost:5173");
        headers.setAccessControlRequestMethod(HttpMethod.GET);
        headers.add(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/me",
                HttpMethod.OPTIONS,
                new HttpEntity<>(headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getAccessControlAllowOrigin())
                .isEqualTo("http://localhost:5173");
        String allowHeaders = String.join(",", response.getHeaders().getAccessControlAllowHeaders())
                .toLowerCase();
        assertThat(allowHeaders).contains("authorization");
        assertThat(allowHeaders).contains("content-type");
        assertThat(response.getHeaders().getAccessControlAllowMethods())
                .contains(HttpMethod.GET);
    }

    @Test
    void concurrentCreationForSameSubjectYieldsOneUser() throws Exception {
        String subject = "keycloak-subject-concurrent";
        int attempts = 12;
        ExecutorService executor = Executors.newFixedThreadPool(attempts);
        CountDownLatch start = new CountDownLatch(1);
        List<ResponseEntity<String>> responses = new CopyOnWriteArrayList<>();
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < attempts; i++) {
                futures.add(executor.submit(() -> {
                    start.await();
                    HttpHeaders headers = new HttpHeaders();
                    headers.setBearerAuth(subject);
                    responses.add(restTemplate.exchange(
                            "/api/me",
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            String.class));
                    return null;
                }));
            }

            start.countDown();
            for (Future<?> future : futures) {
                future.get(15, TimeUnit.SECONDS);
            }
        } finally {
            executor.shutdownNow();
        }

        assertThat(responses).hasSize(attempts);
        assertThat(responses).allSatisfy(response ->
                assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK));

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE external_subject = ?",
                Integer.class,
                subject);
        assertThat(count).isEqualTo(1);

        Set<String> ids = responses.stream()
                .map(ResponseEntity::getBody)
                .collect(Collectors.toSet());
        assertThat(ids).hasSize(1);
    }
}
