import { expect, test } from '@playwright/test';
import { newUserContext } from './support/auth.js';
import { api, currentUserId, readBandSnapshot, waitForSong } from './support/snapshot.js';
import { memberUser, ownerUser } from './support/users.js';

const stamp = Date.now().toString(36);

async function openLoggedIn(page, user) {
    await page.goto('/');
    await expect(page.getByRole('button', { name: `Konto von ${user.username}` })).toBeVisible();
}

test('speichert einen user-isolierten Snapshot nach dem Login', async ({ browser }) => {
    const owner = await newUserContext(browser, ownerUser);
    const member = await newUserContext(browser, memberUser);
    const bandName = `Snapshot ${stamp}`;
    const ownerNote = `Owner-Notiz ${stamp}`;
    const memberNote = `Member-Notiz ${stamp}`;
    try {
        await openLoggedIn(owner.page, ownerUser);
        const band = await api(owner.page, '/api/bands', { method: 'POST', data: { name: bandName } });
        const first = await api(owner.page, `/api/bands/${band.id}/songs`, {
            method: 'POST',
            data: { title: `Erster ${stamp}`, artist: 'A', content: `{title: Erster ${stamp}}` },
        });
        const second = await api(owner.page, `/api/bands/${band.id}/songs`, {
            method: 'POST',
            data: { title: `Zweiter ${stamp}`, artist: 'B', content: `{title: Zweiter ${stamp}}` },
        });
        const setlist = await api(owner.page, `/api/bands/${band.id}/setlists`, {
            method: 'POST',
            data: {
                name: `Set ${stamp}`,
                songIds: [first.id, second.id, first.id],
            },
        });
        await api(owner.page, `/api/bands/${band.id}/songs/${first.id}/note`, {
            method: 'PUT',
            data: { text: ownerNote },
        });

        const invitation = await api(owner.page, `/api/bands/${band.id}/invitations`, { method: 'POST' });
        await openLoggedIn(member.page, memberUser);
        await api(member.page, `/api/invitations/${invitation.token}/accept`, { method: 'POST' });
        await api(member.page, `/api/bands/${band.id}/songs/${second.id}/note`, {
            method: 'PUT',
            data: { text: memberNote },
        });

        await owner.page.reload();
        await member.page.reload();
        await expect(owner.page.getByRole('button', { name: /^Konto von / })).toBeVisible();
        await expect(member.page.getByRole('button', { name: /^Konto von / })).toBeVisible();

        const ownerId = await currentUserId(owner.page);
        const memberId = await currentUserId(member.page);
        expect(ownerId).not.toBe(memberId);

        const ownerSnapshot = await waitForSong(owner.page, ownerId, band.id, first.id);
        const memberSnapshot = await waitForSong(member.page, memberId, band.id, first.id);

        expect(ownerSnapshot.band).toMatchObject({ userId: ownerId, bandId: band.id, name: bandName });
        expect(ownerSnapshot.songs.map((song) => song.songId)).toEqual(expect.arrayContaining([first.id, second.id]));
        expect(ownerSnapshot.songs.find((song) => song.songId === first.id).content).toContain(`Erster ${stamp}`);
        expect(ownerSnapshot.setlists).toEqual([
            expect.objectContaining({
                setlistId: setlist.id,
                name: `Set ${stamp}`,
                songIds: [first.id, second.id, first.id],
            }),
        ]);
        expect(ownerSnapshot.notes).toEqual([
            expect.objectContaining({ userId: ownerId, songId: first.id, text: ownerNote }),
        ]);
        expect(JSON.stringify(ownerSnapshot)).not.toContain(memberNote);

        expect(memberSnapshot.band.userId).toBe(memberId);
        expect(memberSnapshot.notes).toEqual([
            expect.objectContaining({ userId: memberId, songId: second.id, text: memberNote }),
        ]);
        expect(JSON.stringify(memberSnapshot)).not.toContain(ownerNote);
        expect(memberSnapshot.meta.userId).toBe(memberId);
        expect(memberSnapshot.meta.bandId).toBe(band.id);
        expect(memberSnapshot.meta.refreshedAt).toBeTruthy();
    } finally {
        await owner.context.close();
        await member.context.close();
    }
});

test('entfernt den Band-Snapshot, nachdem die Mitgliedschaft endet', async ({ browser }) => {
    const owner = await newUserContext(browser, ownerUser);
    const member = await newUserContext(browser, memberUser);
    const bandName = `Snapshot Leave ${stamp}`;
    try {
        await openLoggedIn(owner.page, ownerUser);
        const band = await api(owner.page, '/api/bands', { method: 'POST', data: { name: bandName } });
        const song = await api(owner.page, `/api/bands/${band.id}/songs`, {
            method: 'POST',
            data: { title: `Leave ${stamp}`, artist: '', content: '{title: Leave}' },
        });
        await api(owner.page, `/api/bands/${band.id}/songs/${song.id}/note`, {
            method: 'PUT',
            data: { text: `bleibt beim Owner ${stamp}` },
        });
        const invitation = await api(owner.page, `/api/bands/${band.id}/invitations`, { method: 'POST' });

        await openLoggedIn(member.page, memberUser);
        await api(member.page, `/api/invitations/${invitation.token}/accept`, { method: 'POST' });
        await member.page.reload();
        const memberId = await currentUserId(member.page);
        await waitForSong(member.page, memberId, band.id, song.id);

        await api(member.page, `/api/bands/${band.id}/members/me`, { method: 'DELETE' });
        await member.page.reload();
        await expect(member.page.getByRole('button', { name: /^Konto von / })).toBeVisible();
        await expect.poll(async () => {
            const snapshot = await readBandSnapshot(member.page, memberId, band.id);
            return snapshot?.band ?? null;
        }, { timeout: 45_000 }).toBeNull();

        await owner.page.reload();
        const ownerId = await currentUserId(owner.page);
        const ownerSnapshot = await waitForSong(owner.page, ownerId, band.id, song.id);
        expect(ownerSnapshot.notes[0].text).toBe(`bleibt beim Owner ${stamp}`);
        expect(ownerSnapshot.band.userId).toBe(ownerId);
    } finally {
        await owner.context.close();
        await member.context.close();
    }
});
