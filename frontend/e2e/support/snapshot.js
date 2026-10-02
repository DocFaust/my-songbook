import { expect } from '@playwright/test';

const DB_NAME = 'mysongbook-offline-snapshot';

async function accessToken(page) {
    const token = await page.evaluate(() => {
        const stores = [sessionStorage, localStorage];
        for (const store of stores) {
            const key = Object.keys(store).find((name) => name.startsWith('oidc.user:'));
            if (!key) {
                continue;
            }
            const stored = JSON.parse(store.getItem(key));
            if (stored?.access_token) {
                return stored.access_token;
            }
        }
        return null;
    });
    expect(token).toBeTruthy();
    return token;
}

export async function api(page, path, { method = 'GET', data } = {}) {
    const token = await accessToken(page);
    const response = await page.request.fetch(path, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        data,
    });
    const text = await response.text();
    let body = null;
    if (text) {
        body = JSON.parse(text);
    }
    if (!response.ok()) {
        throw new Error(`${method} ${path} -> ${response.status()} ${text}`);
    }
    return body;
}

export async function currentUserId(page) {
    const user = await api(page, '/api/me');
    expect(user.id).toBeTruthy();
    return user.id;
}

export async function readBandSnapshot(page, userId, bandId) {
    return page.evaluate(async ({ userId, bandId, dbName }) => {
        const databases = await indexedDB.databases();
        if (!databases.some((entry) => entry.name === dbName)) {
            return null;
        }
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
        try {
            const tx = db.transaction(['bands', 'songs', 'setlists', 'notes', 'meta'], 'readonly');
            const done = (query) => new Promise((resolve, reject) => {
                query.onsuccess = () => resolve(query.result ?? null);
                query.onerror = () => reject(query.error);
            });
            const range = [userId, bandId];
            const bandQuery = tx.objectStore('bands').get(range);
            const songsQuery = tx.objectStore('songs').index('byUserBand').getAll(range);
            const setlistsQuery = tx.objectStore('setlists').index('byUserBand').getAll(range);
            const notesQuery = tx.objectStore('notes').index('byUserBand').getAll(range);
            const metaQuery = tx.objectStore('meta').get(range);
            const [band, songs, setlists, notes, meta] = await Promise.all([
                done(bandQuery),
                done(songsQuery),
                done(setlistsQuery),
                done(notesQuery),
                done(metaQuery),
            ]);
            return { band, songs, setlists, notes, meta };
        } finally {
            db.close();
        }
    }, { userId, bandId, dbName: DB_NAME });
}

export async function waitForSong(page, userId, bandId, songId) {
    let snapshot = null;
    await expect.poll(async () => {
        snapshot = await readBandSnapshot(page, userId, bandId);
        return snapshot?.songs?.some((song) => song.songId === songId) ?? false;
    }, { timeout: 45_000 }).toBe(true);
    return snapshot;
}
