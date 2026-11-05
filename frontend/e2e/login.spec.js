import { expect, test } from '@playwright/test';
import { loginViaKeycloak, logout } from './support/auth.js';
import { ownerUser } from './support/users.js';

test.use({ storageState: { cookies: [], origins: [] } });

test('öffnet die Anwendung, meldet sich bei Keycloak an und wieder ab', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/repertoire$/);
    await expect(page.getByRole('heading', { name: 'SongManager' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Repertoire' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Home' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Editor' })).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('button', { name: '+ Song' })).toHaveCount(0);

    await loginViaKeycloak(page, ownerUser);
    await expect(page.getByRole('link', { name: 'SongManager' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Setlists' })).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: 'Setlists' })).toHaveCount(0);
    const songAction = page.getByRole('button', { name: '+ Song' });
    const noBand = page.getByText(/Keine Band ausgewählt/i);
    await expect(songAction.or(noBand)).toBeVisible();
    if (await songAction.isVisible()) {
        await songAction.click();
        await expect(page.getByRole('menuitem', { name: 'Neuer Song' })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: 'Song importieren' })).toBeVisible();
        await page.keyboard.press('Escape');
    }

    await logout(page);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Anmelden' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Editor' })).toHaveCount(0);
});
