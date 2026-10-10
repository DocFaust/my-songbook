import { expect, test } from '@playwright/test';
import { loginViaKeycloak, logout } from './support/auth.js';
import { ownerUser } from './support/users.js';

test.use({ storageState: { cookies: [], origins: [] } });

test('öffnet die Anwendung, meldet sich bei Keycloak an und wieder ab', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/editor$/);
    await expect(page.getByRole('heading', { name: 'SongManager' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Editor' })).toHaveCount(0);

    await loginViaKeycloak(page, ownerUser);
    await expect(page.getByRole('link', { name: 'SongManager' })).toBeVisible();

    await logout(page);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editor' })).toHaveCount(0);
});
