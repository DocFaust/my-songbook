-- Band tenant and Membership (Step 4).
-- Band creation always inserts exactly one OWNER membership in the same transaction.

CREATE TABLE bands (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    CONSTRAINT chk_bands_name_not_blank CHECK (btrim(name) <> '')
);

CREATE TABLE memberships (
    band_id UUID NOT NULL REFERENCES bands (id),
    user_id UUID NOT NULL REFERENCES users (id),
    role TEXT NOT NULL,
    PRIMARY KEY (band_id, user_id),
    CONSTRAINT chk_memberships_role CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'GUEST'))
);

CREATE INDEX idx_memberships_user_id ON memberships (user_id);
