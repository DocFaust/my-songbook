import { expect, test } from '@playwright/test';
import { loginViaKeycloak, logout } from './support/auth.js';
import { ownerUser } from './support/users.js';

test.use({ storageState: { cookies: [], origins: [] } });

test('öffnet die Anwendung, meldet sich bei Keycloak an und wieder ab', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Willkommen im SongManager' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editor' })).toHaveCount(0);

    await loginViaKeycloak(page, ownerUser);
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

    await logout(page);
    await expect(page.getByRole('heading', { name: 'Willkommen im SongManager' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editor' })).toHaveCount(0);
});
