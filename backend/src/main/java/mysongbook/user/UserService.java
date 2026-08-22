package mysongbook.user;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public User findOrCreateByExternalSubject(String externalSubject) {
        return userRepository.findByExternalSubject(externalSubject)
                .orElseGet(() -> userRepository.insert(UUID.randomUUID(), externalSubject));
    }
}
