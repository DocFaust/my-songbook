package de.docfaust.mysongbook.user;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByExternalSubject(String externalSubject);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
            INSERT INTO users (id, external_subject) VALUES (:id, :externalSubject)
            ON CONFLICT (external_subject) DO NOTHING
            """, nativeQuery = true)
    void insertIgnoringConflict(@Param("id") UUID id, @Param("externalSubject") String externalSubject);
}
