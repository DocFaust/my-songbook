-- Global My Songbook User identity (Step 3).
-- Maps external Identity Provider subject to an internal application User.

CREATE TABLE users (
    id UUID PRIMARY KEY,
    external_subject TEXT NOT NULL,
    CONSTRAINT uk_users_external_subject UNIQUE (external_subject)
);
