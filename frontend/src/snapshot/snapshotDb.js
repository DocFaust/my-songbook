import { deleteDB, openDB } from 'idb';

export const SNAPSHOT_DB_NAME = 'mysongbook-offline-snapshot';
export const SNAPSHOT_DB_VERSION = 1;

const BANDS = 'bands';
const SONGS = 'songs';
const SETLISTS = 'setlists';
const NOTES = 'notes';
const META = 'meta';

const STORE_NAMES = [BANDS, SONGS, SETLISTS, NOTES, META];
const USER_BAND_RANGE = (userId, bandId) => IDBKeyRange.only([userId, bandId]);

function createStores(db) {
    for (const name of [...db.objectStoreNames]) {
        db.deleteObjectStore(name);
    }

    const bands = db.createObjectStore(BANDS, { keyPath: ['userId', 'bandId'] });
    bands.createIndex('byUser', 'userId');

    const songs = db.createObjectStore(SONGS, { keyPath: ['userId', 'bandId', 'songId'] });
    songs.createIndex('byUserBand', ['userId', 'bandId']);

    const setlists = db.createObjectStore(SETLISTS, { keyPath: ['userId', 'bandId', 'setlistId'] });
    setlists.createIndex('byUserBand', ['userId', 'bandId']);

    const notes = db.createObjectStore(NOTES, { keyPath: ['userId', 'bandId', 'songId'] });
    notes.createIndex('byUserBand', ['userId', 'bandId']);

    const meta = db.createObjectStore(META, { keyPath: ['userId', 'bandId'] });
    meta.createIndex('byUser', 'userId');
}

let databasePromise = null;

export function openSnapshotDb() {
    if (!databasePromise) {
        databasePromise = openDB(SNAPSHOT_DB_NAME, SNAPSHOT_DB_VERSION, {
            upgrade(db) {
                createStores(db);
            },
        }).catch((error) => {
            databasePromise = null;
            throw error;
        });
    }
    return databasePromise;
}

async function deleteIndexed(tx, storeName, userId, bandId) {
    const store = tx.objectStore(storeName);
    const keys = await store.index('byUserBand').getAllKeys(USER_BAND_RANGE(userId, bandId));
    for (const key of keys) {
        await store.delete(key);
    }
}

async function clearBand(tx, userId, bandId) {
    await tx.objectStore(BANDS).delete([userId, bandId]);
    await tx.objectStore(META).delete([userId, bandId]);
    await deleteIndexed(tx, SONGS, userId, bandId);
    await deleteIndexed(tx, SETLISTS, userId, bandId);
    await deleteIndexed(tx, NOTES, userId, bandId);
}

function abortQuietly(tx) {
    try {
        tx.abort();
    } catch {
        // Die Transaktion ist bereits beendet.
    }
}

async function finish(tx, work) {
    try {
        await work();
        await tx.done;
    } catch (error) {
        abortQuietly(tx);
        await tx.done.catch(() => {});
        throw error;
    }
}

function writeBand(tx, snapshot) {
    const writes = [
        tx.objectStore(BANDS).put(snapshot.band),
        ...snapshot.songs.map((song) => tx.objectStore(SONGS).put(song)),
        ...snapshot.setlists.map((setlist) => tx.objectStore(SETLISTS).put(setlist)),
        ...snapshot.notes.map((note) => tx.objectStore(NOTES).put(note)),
        tx.objectStore(META).put(snapshot.meta),
    ];
    return Promise.all(writes);
}

export async function replaceBandSnapshot(snapshot) {
    const db = await openSnapshotDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    await finish(tx, async () => {
        await clearBand(tx, snapshot.userId, snapshot.bandId);
        await writeBand(tx, snapshot);
    });
}

export async function deleteBandSnapshot(userId, bandId) {
    const db = await openSnapshotDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    await finish(tx, async () => {
        await clearBand(tx, userId, bandId);
    });
}

export async function readBandSnapshot(userId, bandId) {
    const db = await openSnapshotDb();
    const range = USER_BAND_RANGE(userId, bandId);
    const tx = db.transaction(STORE_NAMES, 'readonly');
    const band = await tx.objectStore(BANDS).get([userId, bandId]);
    const songs = await tx.objectStore(SONGS).index('byUserBand').getAll(range);
    const setlists = await tx.objectStore(SETLISTS).index('byUserBand').getAll(range);
    const notes = await tx.objectStore(NOTES).index('byUserBand').getAll(range);
    const meta = await tx.objectStore(META).get([userId, bandId]);
    await tx.done;
    return {
        band: band ?? null,
        songs,
        setlists,
        notes,
        meta: meta ?? null,
    };
}

export async function listCachedBandIds(userId) {
    const db = await openSnapshotDb();
    const tx = db.transaction([BANDS, META], 'readonly');
    const bands = await tx.objectStore(BANDS).index('byUser').getAll(userId);
    const metas = await tx.objectStore(META).index('byUser').getAll(userId);
    await tx.done;
    return [...new Set([
        ...bands.map((band) => band.bandId),
        ...metas.map((meta) => meta.bandId),
    ])];
}

export async function deleteSnapshotDatabase() {
    if (databasePromise) {
        const db = await databasePromise;
        db.close();
        databasePromise = null;
    }
    await deleteDB(SNAPSHOT_DB_NAME);
}
