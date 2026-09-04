-- Band invitations (Step 9).
-- Raw invitation tokens are never stored; only a SHA-256 hex hash is persisted.

CREATE TABLE band_invitations (
    id UUID PRIMARY KEY,
    band_id UUID NOT NULL REFERENCES bands (id),
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES users (id),
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users (id),
    CONSTRAINT uq_band_invitations_token_hash UNIQUE (token_hash),
    CONSTRAINT chk_band_invitations_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_band_invitations_band_id ON band_invitations (band_id);
