import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBandSnapshot } from '../snapshotModel.js';
import {
    deleteSnapshotDatabase,
    getPendingNoteChange,
    openSnapshotDb,
    putPendingNoteChange,
    readBandSnapshot,
    replaceBandSnapshot,
} from '../snapshotDb.js';
import { SNAPSHOT_DB_NAME } from '../snapshotDb.js';
import { openDB } from 'idb';

function payload(title = 'Wonderwall') {
    return {
        userId: 'user-a',
        band: { id: 'band-a', name: 'Band A', role: 'OWNER' },
        songs: [
            {
                id: 'song-1',
                bandId: 'band-a',
                title,
                artist: 'Oasis',
                content: `{title: ${title}}\n[Em7]Today`,
                version: 4,
            },
            {
                id: 'song-2',
                bandId: 'band-a',
                title: 'Zweiter Song',
                artist: '',
                content: '{title: Zweiter Song}',
                version: 0,
            },
        ],
        setlists: [
            {
                id: 'set-1',
                bandId: 'band-a',
                name: 'Abend',
                songIds: ['song-1', 'song-2', 'song-1'],
                version: 2,
            },
        ],
        notes: [
            { songId: 'song-1', text: 'Capo 2', version: 0, userId: 'someone-else', token: 'secret' },
        ],
        refreshedAt: '2026-10-02T12:00:00.000Z',
    };
}

describe('snapshotDb', () => {
    beforeEach(async () => {
        await deleteSnapshotDatabase();
    });

    it('speichert Songs, Setlist-Reihenfolge, Duplikate und die eigene Notiz', async () => {
        const snapshot = buildBandSnapshot(payload());
        await replaceBandSnapshot(snapshot);

        const stored = await readBandSnapshot('user-a', 'band-a');

        expect(stored.band).toEqual({ userId: 'user-a', bandId: 'band-a', name: 'Band A', role: 'OWNER' });
        expect(stored.songs).toEqual([
            expect.objectContaining({
                userId: 'user-a',
                bandId: 'band-a',
                songId: 'song-1',
                title: 'Wonderwall',
                artist: 'Oasis',
                content: '{title: Wonderwall}\n[Em7]Today',
            }),
            expect.objectContaining({ songId: 'song-2', content: '{title: Zweiter Song}' }),
        ]);
        expect(stored.songs[0]).not.toHaveProperty('version');
        expect(stored.setlists).toEqual([
            {
                userId: 'user-a',
                bandId: 'band-a',
                setlistId: 'set-1',
                name: 'Abend',
                songIds: ['song-1', 'song-2', 'song-1'],
            },
        ]);
        expect(stored.notes).toEqual([
            { userId: 'user-a', bandId: 'band-a', songId: 'song-1', text: 'Capo 2', version: 0 },
        ]);
        expect(JSON.stringify(stored)).not.toContain('secret');
        expect(JSON.stringify(stored)).not.toContain('someone-else');
        expect(stored.meta).toEqual({
            userId: 'user-a',
            bandId: 'band-a',
            refreshedAt: '2026-10-02T12:00:00.000Z',
        });
    });

    it('ersetzt einen Band-Snapshot vollständig', async () => {
        await replaceBandSnapshot(buildBandSnapshot(payload('Alt')));
        const next = payload('Neu');
        next.notes = [];
        next.setlists = [];
        next.songs = [next.songs[1]];
        next.refreshedAt = '2026-10-02T13:00:00.000Z';
        await replaceBandSnapshot(buildBandSnapshot(next));

        const stored = await readBandSnapshot('user-a', 'band-a');
        expect(stored.songs.map((song) => song.songId)).toEqual(['song-2']);
        expect(stored.setlists).toEqual([]);
        expect(stored.notes).toEqual([]);
        expect(stored.meta.refreshedAt).toBe('2026-10-02T13:00:00.000Z');
    });

    it('lässt den vorherigen Snapshot stehen, wenn der Commit scheitert', async () => {
        await replaceBandSnapshot(buildBandSnapshot(payload('Alt')));
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function failingPut() {
            throw new DOMException('disk full', 'UnknownError');
        };
        try {
            await expect(replaceBandSnapshot(buildBandSnapshot(payload('Neu')))).rejects.toThrow(/disk full/);
        } finally {
            IDBObjectStore.prototype.put = originalPut;
        }

        const stored = await readBandSnapshot('user-a', 'band-a');
        expect(stored.songs.map((song) => song.title)).toEqual(['Alt', 'Zweiter Song']);
        expect(stored.setlists[0].songIds).toEqual(['song-1', 'song-2', 'song-1']);
        expect(stored.notes[0].text).toBe('Capo 2');
    });

    it('hält Snapshots von User A und User B auseinander', async () => {
        await replaceBandSnapshot(buildBandSnapshot(payload('Von A')));
        const userB = payload('Von B');
        userB.userId = 'user-b';
        userB.notes = [{ songId: 'song-1', text: 'Nur B', version: 1 }];
        await replaceBandSnapshot(buildBandSnapshot(userB));

        const storedA = await readBandSnapshot('user-a', 'band-a');
        const storedB = await readBandSnapshot('user-b', 'band-a');
        expect(storedA.songs[0].title).toBe('Von A');
        expect(storedA.notes.map((note) => note.text)).toEqual(['Capo 2']);
        expect(storedB.songs[0].title).toBe('Von B');
        expect(storedB.notes.map((note) => note.text)).toEqual(['Nur B']);
        expect(JSON.stringify(storedB)).not.toContain('Capo 2');
        expect(JSON.stringify(storedA)).not.toContain('Nur B');
    });

    it('behält vorhandene Snapshot-Daten und Pending-Notizen beim Schema-Upgrade', async () => {
        await deleteSnapshotDatabase();
        const versionOne = await openDB(SNAPSHOT_DB_NAME, 1, {
            upgrade(db) {
                const bands = db.createObjectStore('bands', { keyPath: ['userId', 'bandId'] });
                bands.createIndex('byUser', 'userId');
                const songs = db.createObjectStore('songs', { keyPath: ['userId', 'bandId', 'songId'] });
                songs.createIndex('byUserBand', ['userId', 'bandId']);
                const setlists = db.createObjectStore('setlists', { keyPath: ['userId', 'bandId', 'setlistId'] });
                setlists.createIndex('byUserBand', ['userId', 'bandId']);
                const notes = db.createObjectStore('notes', { keyPath: ['userId', 'bandId', 'songId'] });
                notes.createIndex('byUserBand', ['userId', 'bandId']);
                const meta = db.createObjectStore('meta', { keyPath: ['userId', 'bandId'] });
                meta.createIndex('byUser', 'userId');
            },
        });
        await versionOne.put('bands', { userId: 'user-a', bandId: 'band-a', name: 'Alt' });
        await versionOne.put('meta', {
            userId: 'user-a',
            bandId: 'band-a',
            refreshedAt: '2026-10-01T10:00:00.000Z',
        });
        versionOne.close();

        const upgraded = await openSnapshotDb();
        expect([...upgraded.objectStoreNames]).toContain('pendingNoteChanges');
        expect((await readBandSnapshot('user-a', 'band-a')).band.name).toBe('Alt');

        await putPendingNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo 3',
            action: 'UPSERT',
            baseAbsent: false,
            baseVersion: 1,
            baseText: 'Capo 2',
            updatedAt: '2026-10-06T10:00:00.000Z',
            conflict: null,
            blocked: null,
        });
        await replaceBandSnapshot(buildBandSnapshot(payload('Neu')));

        expect((await readBandSnapshot('user-a', 'band-a')).songs[0].title).toBe('Neu');
        expect((await getPendingNoteChange('user-a', 'band-a', 'song-1')).text).toBe('Capo 3');
    });
});
