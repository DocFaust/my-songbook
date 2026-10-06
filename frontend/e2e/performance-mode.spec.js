import { expect, test } from '@playwright/test';
import { newUserContext } from './support/auth.js';
import { api, currentUserId, waitForSong } from './support/snapshot.js';
import { ownerUser } from './support/users.js';

const stamp = Date.now().toString(36);

async function openLoggedIn(page) {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await expect(page.getByText(ownerUser.username, { exact: true })).toBeVisible();
}

async function waitForServiceWorker(page) {
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker?.controller))).toBe(true);
}

async function openSong(page, title) {
    await page.getByRole('button', { name: new RegExp(title) }).click();
}

async function selectBand(page, band) {
    const box = page.getByRole('combobox', { name: 'Aktive Band' });
    if ((await box.innerText()).includes(band.name)) {
        return;
    }
    await page.evaluate((id) => window.localStorage.setItem('mysongbook.activeBandId', id), band.id);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
    await expect(box).toContainText(band.name);
}

test('nutzt den Performance Mode offline und synchronisiert die Notiz beim Verlassen', async ({ browser }) => {
    const owner = await newUserContext(browser, ownerUser);
    const bandName = `Performance ${stamp}`;
    const songTitle = `Auftritt ${stamp}`;
    const setName = `Set ${stamp}`;
    const offlineNote = `Capo offline ${stamp}`;
    try {
        await openLoggedIn(owner.page);
        const band = await api(owner.page, '/api/bands', { method: 'POST', data: { name: bandName } });
        const song = await api(owner.page, `/api/bands/${band.id}/songs`, {
            method: 'POST',
            data: { title: songTitle, artist: 'Live', content: `{title: ${songTitle}}\n[G]Tonight` },
        });
        await api(owner.page, `/api/bands/${band.id}/setlists`, {
            method: 'POST',
            data: { name: setName, songIds: [song.id, song.id] },
        });
        await api(owner.page, `/api/bands/${band.id}/songs/${song.id}/note`, {
            method: 'PUT',
            data: { text: `Capo vorher ${stamp}`, expectAbsent: true },
        });

        await owner.page.reload();
        await expect(owner.page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
        const userId = await currentUserId(owner.page);
        await waitForSong(owner.page, userId, band.id, song.id);
        await waitForServiceWorker(owner.page);
        await selectBand(owner.page, band);

        await owner.page.getByRole('switch', { name: 'Performance Mode einschalten' }).click();
        await expect(owner.page.getByRole('switch', { name: 'Performance Mode ausschalten' })).toBeChecked();

        await owner.context.setOffline(true);
        await owner.page.reload();
        await expect(owner.page.getByRole('status').filter({ hasText: 'Performance Mode' })).toBeVisible();
        await expect(owner.page.getByRole('combobox', { name: 'Aktive Band' })).toContainText(bandName);

        await owner.page.getByRole('link', { name: 'Sets' }).click();
        await owner.page.getByText(`${setName} (2)`).click();
        await expect(owner.page.getByText(songTitle).first()).toBeVisible();
        await expect(owner.page.getByRole('button', { name: 'Setlist speichern' })).toBeDisabled();

        await owner.page.getByRole('link', { name: 'Editor' }).click();
        await openSong(owner.page, songTitle);
        await expect(owner.page.getByLabel('Meine Notiz')).toHaveValue(`Capo vorher ${stamp}`);
        await expect(owner.page.getByRole('button', { name: 'Speichern', exact: true })).toBeDisabled();
        await expect(owner.page.getByRole('alert').filter({ hasText: 'Im Performance Mode nicht verfügbar.' })).toBeVisible();

        await owner.page.getByLabel('Meine Notiz').fill(offlineNote);
        await owner.page.getByRole('button', { name: 'Notiz speichern' }).click();
        await expect(owner.page.getByText('Lokal geändert')).toBeVisible();

        await owner.page.reload();
        await openSong(owner.page, songTitle);
        await expect(owner.page.getByLabel('Meine Notiz')).toHaveValue(offlineNote);

        await owner.context.setOffline(false);
        await expect(owner.page.getByRole('switch', { name: 'Performance Mode ausschalten' })).toBeChecked();

        await owner.page.getByRole('switch', { name: 'Performance Mode ausschalten' }).click();
        await expect.poll(async () => {
            const note = await api(owner.page, `/api/bands/${band.id}/songs/${song.id}/note`);
            return note.text;
        }).toBe(offlineNote);
        await expect(owner.page.getByRole('status').filter({ hasText: 'Online' })).toBeVisible();
    } finally {
        await owner.context.setOffline(false).catch(() => {});
        await owner.context.close();
    }
});

test('zeigt einen Notizkonflikt, wenn dieselbe Notiz online geändert wurde', async ({ browser }) => {
    const first = await newUserContext(browser, ownerUser);
    const second = await newUserContext(browser, ownerUser);
    const bandName = `Konflikt ${stamp}`;
    const songTitle = `Konflikt-Song ${stamp}`;
    const offlineNote = `Offline ${stamp}`;
    const onlineNote = `Online ${stamp}`;
    try {
        await openLoggedIn(first.page);
        const band = await api(first.page, '/api/bands', { method: 'POST', data: { name: bandName } });
        const song = await api(first.page, `/api/bands/${band.id}/songs`, {
            method: 'POST',
            data: { title: songTitle, artist: '', content: `{title: ${songTitle}}` },
        });
        await api(first.page, `/api/bands/${band.id}/songs/${song.id}/note`, {
            method: 'PUT',
            data: { text: `Basis ${stamp}`, expectAbsent: true },
        });
        await first.page.reload();
        const userId = await currentUserId(first.page);
        await waitForSong(first.page, userId, band.id, song.id);
        await waitForServiceWorker(first.page);
        await selectBand(first.page, band);

        await first.page.getByRole('switch', { name: 'Performance Mode einschalten' }).click();
        await expect(first.page.getByRole('switch', { name: 'Performance Mode ausschalten' })).toBeChecked();
        await first.context.setOffline(true);
        await first.page.reload();
        await first.page.getByRole('link', { name: 'Editor' }).click();
        await openSong(first.page, songTitle);
        await first.page.getByLabel('Meine Notiz').fill(offlineNote);
        await first.page.getByRole('button', { name: 'Notiz speichern' }).click();
        await expect(first.page.getByText('Lokal geändert')).toBeVisible();

        await openLoggedIn(second.page);
        const current = await api(second.page, `/api/bands/${band.id}/songs/${song.id}/note`);
        await api(second.page, `/api/bands/${band.id}/songs/${song.id}/note`, {
            method: 'PUT',
            data: { text: onlineNote, expectedVersion: current.version },
        });

        await first.context.setOffline(false);
        await expect(first.page.getByRole('switch', { name: 'Performance Mode ausschalten' })).toBeChecked();
        await first.page.getByRole('switch', { name: 'Performance Mode ausschalten' }).click();
        await first.page.getByRole('button', { name: 'Entscheidungen öffnen' }).click();
        await expect(first.page.getByText('Notiz wurde an anderer Stelle geändert.')).toBeVisible();
        await expect(first.page.getByLabel('Meine Offline-Notiz')).toHaveValue(offlineNote);
        await expect(first.page.getByLabel('Aktuelle Online-Notiz')).toHaveValue(onlineNote);

        await first.page.getByRole('button', { name: 'Meine Version verwenden' }).click();
        await expect.poll(async () => {
            const note = await api(second.page, `/api/bands/${band.id}/songs/${song.id}/note`);
            return note.text;
        }).toBe(offlineNote);
    } finally {
        await first.context.setOffline(false).catch(() => {});
        await first.context.close();
        await second.context.close();
    }
});
