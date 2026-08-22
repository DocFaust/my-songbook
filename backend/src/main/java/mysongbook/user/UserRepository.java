package mysongbook.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<User> findByExternalSubject(String externalSubject) {
        return jdbcTemplate.query(
                "SELECT id, external_subject FROM users WHERE external_subject = ?",
                (rs, rowNum) -> new User(
                        rs.getObject("id", UUID.class),
                        rs.getString("external_subject")),
                externalSubject)
                .stream()
                .findFirst();
    }

    public User insert(UUID id, String externalSubject) {
        jdbcTemplate.update(
                "INSERT INTO users (id, external_subject) VALUES (?, ?)",
                id,
                externalSubject);
        return new User(id, externalSubject);
    }
}
