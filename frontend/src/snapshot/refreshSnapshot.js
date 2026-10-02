import { apiRequest } from '../api/apiClient.js';
import { listPersonalSongNotes } from '../api/personalSongNotesApi.js';
import { listSetlists } from '../api/setlistsApi.js';
import { listSongs } from '../api/songsApi.js';
import { deleteBandSnapshot, listCachedBandIds, replaceBandSnapshot } from './snapshotDb.js';
import { buildBandSnapshot } from './snapshotModel.js';

export const defaultSnapshotClients = {
    currentUser({ token }) {
        return apiRequest({ path: '/api/me', token });
    },
    listBands({ token }) {
        return apiRequest({ path: '/api/bands', token });
    },
    listSongs,
    listSetlists,
    listNotes: listPersonalSongNotes,
};

let refreshQueue = Promise.resolve();

export function refreshOfflineSnapshot({
    token,
    clients = defaultSnapshotClients,
    clock = () => new Date().toISOString(),
} = {}) {
    const run = refreshQueue.then(() => refreshNow({ token, clients, clock }));
    refreshQueue = run.then(() => undefined, () => undefined);
    return run;
}

async function refreshNow({ token, clients, clock }) {
    const user = await clients.currentUser({ token });
    const userId = user?.id;
    if (typeof userId !== 'string' || userId.length === 0) {
        throw new Error('Die interne User-ID fehlt.');
    }

    const bands = await clients.listBands({ token });
    if (!Array.isArray(bands)) {
        throw new Error('Die Bandliste ist ungültig.');
    }

    const failures = [];
    for (const band of bands) {
        try {
            await refreshBand({ token, userId, band, clients, clock });
        } catch (error) {
            failures.push({ bandId: band?.id ?? null, error });
            console.error('Offline-Snapshot für eine Band wurde nicht ersetzt.', band?.id, error);
        }
    }

    await removeEndedMemberships(userId, bands);
    return { userId, failures };
}

async function refreshBand({ token, userId, band, clients, clock }) {
    const bandId = band?.id;
    const [songs, setlists, notes] = await Promise.all([
        clients.listSongs({ token, bandId }),
        clients.listSetlists({ token, bandId }),
        clients.listNotes({ token, bandId }),
    ]);
    await replaceBandSnapshot(buildBandSnapshot({
        userId,
        band,
        songs,
        setlists,
        notes,
        refreshedAt: clock(),
    }));
}

async function removeEndedMemberships(userId, bands) {
    const accessible = new Set(
        bands
            .map((band) => band?.id)
            .filter((bandId) => typeof bandId === 'string' && bandId.length > 0),
    );
    let cachedIds;
    try {
        cachedIds = await listCachedBandIds(userId);
    } catch (error) {
        console.error('Gespeicherte Bands konnten nicht gelesen werden.', error);
        return;
    }

    for (const bandId of cachedIds) {
        if (accessible.has(bandId)) {
            continue;
        }
        try {
            await deleteBandSnapshot(userId, bandId);
        } catch (error) {
            console.error('Veralteter Band-Snapshot konnte nicht entfernt werden.', bandId, error);
        }
    }
}
