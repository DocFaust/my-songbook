// Local Compose / Keycloak development users only. Not for production.
// Defaults match keycloak/realm-my-songbook.json and keycloak/set-local-user-password.sh.

function envOrDefault(name, fallback) {
    const value = process.env[name];
    if (value && value.trim()) {
        return value;
    }
    return fallback;
}

export const ownerUser = {
    key: 'local-dev',
    username: envOrDefault('E2E_OWNER_USERNAME', 'local-dev'),
    password: envOrDefault(
        'E2E_OWNER_PASSWORD',
        envOrDefault('LOCAL_KEYCLOAK_TEST_PASSWORD', 'local-dev')
    ),
};

export const memberUser = {
    key: 'user1',
    username: envOrDefault('E2E_MEMBER_USERNAME', 'user1'),
    password: envOrDefault('E2E_MEMBER_PASSWORD', 'test1234'),
};
