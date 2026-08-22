package mysongbook;

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
}
