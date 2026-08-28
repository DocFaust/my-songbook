package de.docfaust.mysongbook.band;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class BandRepository {

    private final JdbcTemplate jdbcTemplate;

    public BandRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(Band band) {
        jdbcTemplate.update(
                "INSERT INTO bands (id, name) VALUES (?, ?)",
                band.id(),
                band.name());
    }

    public List<UserBand> findByUserId(UUID userId) {
        return jdbcTemplate.query(
                """
                SELECT b.id, b.name, m.role
                FROM memberships m
                INNER JOIN bands b ON b.id = m.band_id
                WHERE m.user_id = ?
                ORDER BY b.name, b.id
                """,
                (rs, rowNum) -> new UserBand(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        MembershipRole.valueOf(rs.getString("role"))),
                userId);
    }
}
