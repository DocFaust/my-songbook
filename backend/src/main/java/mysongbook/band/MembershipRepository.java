package mysongbook.band;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class MembershipRepository {

    private final JdbcTemplate jdbcTemplate;

    public MembershipRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(Membership membership) {
        jdbcTemplate.update(
                "INSERT INTO memberships (band_id, user_id, role) VALUES (?, ?, ?)",
                membership.bandId(),
                membership.userId(),
                membership.role().name());
    }

    public Optional<Membership> findByBandIdAndUserId(UUID bandId, UUID userId) {
        return jdbcTemplate.query(
                """
                SELECT band_id, user_id, role
                FROM memberships
                WHERE band_id = ? AND user_id = ?
                """,
                (rs, rowNum) -> new Membership(
                        rs.getObject("band_id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        MembershipRole.valueOf(rs.getString("role"))),
                bandId,
                userId)
                .stream()
                .findFirst();
    }
}
