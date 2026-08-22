package mysongbook.user;

import java.util.UUID;

public record User(UUID id, String externalSubject) {
}
