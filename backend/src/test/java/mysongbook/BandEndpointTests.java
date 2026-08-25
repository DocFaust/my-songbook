package mysongbook;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import mysongbook.band.MembershipRepository;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import({ PostgresTestcontainersConfiguration.class, TestJwtDecoderConfiguration.class })
class BandEndpointTests {

    private static final ParameterizedTypeReference<Map<String, Object>> BAND =
            new ParameterizedTypeReference<>() {
            };
    private static final ParameterizedTypeReference<List<Map<String, Object>>> BAND_LIST =
            new ParameterizedTypeReference<>() {
            };

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoSpyBean
    private MembershipRepository membershipRepository;

    @AfterEach
    void resetMembershipRepository() {
        Mockito.reset(membershipRepository);
    }

    @Test
    void unauthenticatedCreateReturns401() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands",
                HttpMethod.POST,
                new HttpEntity<>("{\"name\":\"Alpspitzbuam\"}", headers),
                String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unauthenticatedListReturns401() {
        ResponseEntity<String> response = restTemplate.getForEntity("/api/bands", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void authenticatedUserCanCreateBandWithOwnerMembership() {
        String subject = "band-create-owner";
        ResponseEntity<Map<String, Object>> response = createBand(subject, "Alpspitzbuam");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Map<String, Object> body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.get("name")).isEqualTo("Alpspitzbuam");
        assertThat(body.get("role")).isEqualTo("OWNER");
        UUID bandId = UUID.fromString(body.get("id").toString());

        Integer bandCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bands WHERE id = ?",
                Integer.class,
                bandId);
        assertThat(bandCount).isEqualTo(1);

        List<Map<String, Object>> memberships = jdbcTemplate.queryForList(
                """
                SELECT m.user_id, m.role
                FROM memberships m
                WHERE m.band_id = ?
                """,
                bandId);
        assertThat(memberships).hasSize(1);
        assertThat(memberships.get(0).get("role")).isEqualTo("OWNER");
        assertThat(memberships.get(0).get("user_id")).isEqualTo(userId(subject));
    }

    @Test
    void createTrimsBandName() {
        ResponseEntity<Map<String, Object>> response = createBand("band-trim-name", "  Alpspitzbuam  ");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).containsEntry("name", "Alpspitzbuam");
    }

    @Test
    void blankBandNameReturns400() {
        String subject = "band-blank-name";
        ResponseEntity<String> response = createBandRaw(subject, "{\"name\":\"   \"}");
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        Integer memberships = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM memberships m
                JOIN users u ON u.id = m.user_id
                WHERE u.external_subject = ?
                """,
                Integer.class,
                subject);
        assertThat(memberships).isEqualTo(0);
    }

    @Test
    void sameUserCanCreateMultipleBandsEachWithOwnOwnerMembership() {
        String subject = "band-multiple-owner";
        ResponseEntity<Map<String, Object>> first = createBand(subject, "Band One");
        ResponseEntity<Map<String, Object>> second = createBand(subject, "Band Two");

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(first.getBody().get("id")).isNotEqualTo(second.getBody().get("id"));

        Integer memberships = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM memberships m
                JOIN users u ON u.id = m.user_id
                WHERE u.external_subject = ? AND m.role = 'OWNER'
                """,
                Integer.class,
                subject);
        assertThat(memberships).isEqualTo(2);
    }

    @Test
    void listReturnsOnlyCurrentUsersBands() {
        String subjectA = "band-list-user-a";
        String subjectB = "band-list-user-b";
        Map<String, Object> bandA = createBand(subjectA, "User A Band").getBody();
        Map<String, Object> bandB = createBand(subjectB, "User B Band").getBody();
        assertThat(bandA).isNotNull();
        assertThat(bandB).isNotNull();

        List<Map<String, Object>> listA = listBands(subjectA).getBody();
        List<Map<String, Object>> listB = listBands(subjectB).getBody();

        assertThat(listA).extracting(band -> band.get("id")).containsExactly(bandA.get("id"));
        assertThat(listA).extracting(band -> band.get("name")).containsExactly("User A Band");
        assertThat(listA).extracting(band -> band.get("role")).containsExactly("OWNER");

        assertThat(listB).extracting(band -> band.get("id")).containsExactly(bandB.get("id"));
        assertThat(listB).extracting(band -> band.get("name")).containsExactly("User B Band");
    }

    @Test
    void userWithoutMembershipReceivesEmptyListThenCanCreateBand() {
        String subject = "band-no-membership";
        authenticate(subject);

        ResponseEntity<List<Map<String, Object>>> empty = listBands(subject);
        assertThat(empty.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(empty.getBody()).isEmpty();

        ResponseEntity<Map<String, Object>> created = createBand(subject, "First Band");
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).containsEntry("role", "OWNER");

        ResponseEntity<List<Map<String, Object>>> afterCreate = listBands(subject);
        assertThat(afterCreate.getBody()).hasSize(1);
        assertThat(afterCreate.getBody().get(0).get("name")).isEqualTo("First Band");
    }

    @Test
    void knowingAnotherBandsIdDoesNotGrantAccess() {
        String subjectA = "band-isolation-a";
        String subjectB = "band-isolation-b";
        Map<String, Object> bandA = createBand(subjectA, "Private A").getBody();
        createBand(subjectB, "Private B");
        String foreignId = bandA.get("id").toString();

        ResponseEntity<String> asStranger = restTemplate.exchange(
                "/api/bands/" + foreignId,
                HttpMethod.GET,
                authenticated(subjectB),
                String.class);
        ResponseEntity<String> asOwner = restTemplate.exchange(
                "/api/bands/" + foreignId,
                HttpMethod.GET,
                authenticated(subjectA),
                String.class);

        assertThat(asStranger.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(asOwner.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(listBands(subjectB).getBody())
                .extracting(band -> band.get("id").toString())
                .doesNotContain(foreignId);
    }

    @Test
    void duplicateMembershipForSameUserAndBandIsRejected() {
        String subject = "band-duplicate-membership";
        Map<String, Object> created = createBand(subject, "Unique Membership").getBody();
        UUID bandId = UUID.fromString(created.get("id").toString());
        UUID userId = userId(subject);

        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO memberships (band_id, user_id, role) VALUES (?, ?, ?)",
                bandId,
                userId,
                "MEMBER"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void createBandIsAtomicWhenMembershipInsertFails() {
        String subject = "band-atomic-rollback";
        authenticate(subject);
        doThrow(new RuntimeException("membership insert failed"))
                .when(membershipRepository)
                .insert(any());

        ResponseEntity<String> response = createBandRaw(subject, "{\"name\":\"Rollback Band\"}");
        assertThat(response.getStatusCode().is5xxServerError()).isTrue();

        Integer bands = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM bands WHERE name = ?",
                Integer.class,
                "Rollback Band");
        assertThat(bands).isEqualTo(0);

        Integer memberships = jdbcTemplate.queryForObject(
                """
                SELECT COUNT(*) FROM memberships m
                JOIN users u ON u.id = m.user_id
                WHERE u.external_subject = ?
                """,
                Integer.class,
                subject);
        assertThat(memberships).isEqualTo(0);
    }

    @Test
    void preflightPostFromAllowedOriginReceivesCorsHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin("http://localhost:5173");
        headers.setAccessControlRequestMethod(HttpMethod.POST);
        headers.add(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization, Content-Type");

        ResponseEntity<String> response = restTemplate.exchange(
                "/api/bands",
                HttpMethod.OPTIONS,
                new HttpEntity<>(headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getAccessControlAllowOrigin())
                .isEqualTo("http://localhost:5173");
        assertThat(response.getHeaders().getAccessControlAllowMethods())
                .contains(HttpMethod.POST);
    }

    private ResponseEntity<Map<String, Object>> createBand(String subject, String name) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands",
                HttpMethod.POST,
                new HttpEntity<>("{\"name\":\"" + name + "\"}", headers),
                BAND);
    }

    private ResponseEntity<String> createBandRaw(String subject, String json) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return restTemplate.exchange(
                "/api/bands",
                HttpMethod.POST,
                new HttpEntity<>(json, headers),
                String.class);
    }

    private ResponseEntity<List<Map<String, Object>>> listBands(String subject) {
        return restTemplate.exchange(
                "/api/bands",
                HttpMethod.GET,
                authenticated(subject),
                BAND_LIST);
    }

    private void authenticate(String subject) {
        restTemplate.exchange(
                "/api/me",
                HttpMethod.GET,
                authenticated(subject),
                String.class);
    }

    private HttpEntity<Void> authenticated(String subject) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(subject);
        return new HttpEntity<>(headers);
    }

    private UUID userId(String subject) {
        return jdbcTemplate.queryForObject(
                "SELECT id FROM users WHERE external_subject = ?",
                UUID.class,
                subject);
    }
}
