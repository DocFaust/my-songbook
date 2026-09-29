import { test } from '@playwright/test';
import { loginViaKeycloak, saveAuthState } from './support/auth.js';
import { memberUser, ownerUser } from './support/users.js';

test('meldet local-dev über die Keycloak-Oberfläche an', async ({ page }) => {
    await loginViaKeycloak(page, ownerUser);
    await saveAuthState(page, ownerUser);
});

test('meldet user1 über die Keycloak-Oberfläche an', async ({ page }) => {
    await loginViaKeycloak(page, memberUser);
    await saveAuthState(page, memberUser);
});
