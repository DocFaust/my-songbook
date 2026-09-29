import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

const authDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.auth');

export const contextOptions = {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    locale: 'en-US',
    viewport: { width: 1600, height: 900 },
};

function storageStatePath(user) {
    return path.join(authDir, `${user.key}.json`);
}

function sessionStoragePath(user) {
    return path.join(authDir, `${user.key}.session.json`);
}

async function assertLoggedIn(page, user) {
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await expect(page.getByText(user.username, { exact: true })).toBeVisible();
}

export async function loginViaKeycloak(page, user) {
    if (!page.url().startsWith(contextOptions.baseURL)) {
        await page.goto('/');
    }
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await completeKeycloakForm(page, user);
    await assertLoggedIn(page, user);
}

export async function completeKeycloakForm(page, user) {
    await page.waitForURL(/\/realms\/my-songbook\//);
    await page.getByRole('textbox', { name: /username/i }).fill(user.username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url) => url.origin === new URL(contextOptions.baseURL).origin);
    await assertLoggedIn(page, user);
}

export async function logout(page) {
    await page.getByRole('button', { name: 'Abmelden' }).click();
    const loggedOut = page.getByRole('button', { name: 'Anmelden' });
    const confirmLogout = page.locator('#kc-logout');
    await expect(loggedOut.or(confirmLogout)).toBeVisible();
    if (await confirmLogout.isVisible()) {
        await confirmLogout.click();
    }
    await expect(loggedOut).toBeVisible();
}

export async function saveAuthState(page, user) {
    fs.mkdirSync(authDir, { recursive: true });
    await page.context().storageState({ path: storageStatePath(user) });
    const session = await page.evaluate(() => JSON.stringify(window.sessionStorage));
    fs.writeFileSync(sessionStoragePath(user), session);
}

// One case (timeout 120s) plus the silent-renew lead (60s) plus a buffer.
// Setup writes the OIDC session once. Keycloak access tokens then expire
// after five minutes, and a session that is already expired on load is not
// renewed. Later cases would miss Abmelden and drop the stored band.
const minAccessTokenLifetimeSeconds = 200;

function epochSeconds() {
    return Math.floor(Date.now() / 1000);
}

function oidcSessionEntry(session) {
    const storageKey = Object.keys(session).find((key) => key.startsWith('oidc.user:'));
    if (!storageKey) {
        return null;
    }
    return {
        storageKey,
        user: JSON.parse(session[storageKey]),
    };
}

function clientFromStorageKey(storageKey) {
    const remainder = storageKey.slice('oidc.user:'.length);
    const splitAt = remainder.lastIndexOf(':');
    if (splitAt <= 0) {
        return null;
    }
    return {
        authority: remainder.slice(0, splitAt),
        clientId: remainder.slice(splitAt + 1),
    };
}

async function ensureFreshAuthState(user) {
    const sessionPath = sessionStoragePath(user);
    const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    const entry = oidcSessionEntry(session);
    if (!entry) {
        throw new Error(`No OIDC session stored for ${user.username}`);
    }

    const expiresAt = entry.user?.expires_at;
    if (typeof expiresAt === 'number' && expiresAt - epochSeconds() > minAccessTokenLifetimeSeconds) {
        return;
    }
    if (!entry.user?.refresh_token) {
        throw new Error(`OIDC session for ${user.username} cannot be refreshed`);
    }

    const client = clientFromStorageKey(entry.storageKey);
    if (!client?.clientId) {
        throw new Error(`OIDC session for ${user.username} has no client id`);
    }

    const response = await fetch(`${client.authority}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: client.clientId,
            refresh_token: entry.user.refresh_token,
        }),
    });
    if (!response.ok) {
        throw new Error(
            `OIDC token refresh failed for ${user.username}: ${response.status} ${await response.text()}`
        );
    }

    const tokens = await response.json();
    if (typeof tokens.access_token !== 'string' || typeof tokens.expires_in !== 'number') {
        throw new Error(`OIDC token refresh for ${user.username} returned no access token`);
    }

    entry.user.access_token = tokens.access_token;
    entry.user.expires_at = epochSeconds() + tokens.expires_in;
    if (typeof tokens.refresh_token === 'string') {
        entry.user.refresh_token = tokens.refresh_token;
    }
    if (typeof tokens.id_token === 'string') {
        entry.user.id_token = tokens.id_token;
    }
    session[entry.storageKey] = JSON.stringify(entry.user);
    fs.writeFileSync(sessionPath, JSON.stringify(session));
}

export async function newUserContext(browser, user) {
    await ensureFreshAuthState(user);
    const context = await browser.newContext({
        ...contextOptions,
        storageState: storageStatePath(user),
    });
    const session = fs.readFileSync(sessionStoragePath(user), 'utf8');
    await context.addInitScript((serialized) => {
        const entries = JSON.parse(serialized);
        for (const [key, value] of Object.entries(entries)) {
            window.sessionStorage.setItem(key, value);
        }
    }, session);
    const page = await context.newPage();
    return { context, page };
}
