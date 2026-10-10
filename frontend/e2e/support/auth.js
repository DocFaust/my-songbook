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
    const account = page.getByRole('button', { name: `Konto von ${user.username}` });
    await expect(account).toBeVisible();
    await account.click();
    await expect(page.getByText(user.username, { exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Abmelden' })).toBeVisible();
    await page.keyboard.press('Escape');
}

export async function loginViaKeycloak(page, user) {
    if (!page.url().startsWith(contextOptions.baseURL)) {
        await page.goto('/');
    }
    await page.getByRole('banner').getByRole('button', { name: 'Anmelden' }).click();
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
    await page.getByRole('button', { name: /^Konto von / }).click();
    await page.getByRole('menuitem', { name: 'Abmelden' }).click();
    const loggedOut = page.getByRole('banner').getByRole('button', { name: 'Anmelden' });
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

export async function newUserContext(browser, user) {
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
