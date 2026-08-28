package de.docfaust.mysongbook.band;

import java.util.List;
import java.util.UUID;

import de.docfaust.mysongbook.user.User;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BandService {

    static final int MAX_NAME_LENGTH = 100;

    private final BandRepository bandRepository;
    private final MembershipRepository membershipRepository;

    public BandService(BandRepository bandRepository, MembershipRepository membershipRepository) {
        this.bandRepository = bandRepository;
        this.membershipRepository = membershipRepository;
    }

    @Transactional
    public UserBand create(User user, String rawName) {
        String name = normalizeName(rawName);
        Band band = new Band(UUID.randomUUID(), name);
        bandRepository.insert(band);
        membershipRepository.insert(new Membership(band.id(), user.id(), MembershipRole.OWNER));
        return new UserBand(band.id(), band.name(), MembershipRole.OWNER);
    }

    public List<UserBand> listFor(User user) {
        return bandRepository.findByUserId(user.id());
    }

    static String normalizeName(String rawName) {
        if (rawName == null) {
            throw new IllegalArgumentException("Band name must not be blank");
        }
        String name = rawName.trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Band name must not be blank");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new IllegalArgumentException("Band name is too long");
        }
        return name;
    }
}
