import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Local Compose / Keycloak development users only. Not for production.
// Passwords come from the environment or the existing realm import.
// local-dev has no password in the realm; Compose sets it to the username.

function envOrDefault(name, fallback) {
    const value = process.env[name];
    if (value && value.trim()) {
        return value;
    }
    return fallback;
}

function passwordFromRealm(username) {
    const realmPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../../keycloak/realm-my-songbook.json'
    );
    const realm = JSON.parse(fs.readFileSync(realmPath, 'utf8'));
    const user = realm.users.find((entry) => entry.username === username);
    const credential = user?.credentials?.find((item) => item.type === 'password');
    if (!credential?.value) {
        throw new Error(`No local realm password for ${username}`);
    }
    return credential.value;
}

const ownerUsername = envOrDefault('E2E_OWNER_USERNAME', 'local-dev');

export const ownerUser = {
    key: 'local-dev',
    username: ownerUsername,
    password: envOrDefault(
        'E2E_OWNER_PASSWORD',
        envOrDefault('LOCAL_KEYCLOAK_TEST_PASSWORD', ownerUsername)
    ),
};

function memberPassword() {
    const fromEnv = process.env.E2E_MEMBER_PASSWORD;
    if (fromEnv && fromEnv.trim()) {
        return fromEnv;
    }
    return passwordFromRealm('user1');
}

export const memberUser = {
    key: 'user1',
    username: envOrDefault('E2E_MEMBER_USERNAME', 'user1'),
    password: memberPassword(),
};
