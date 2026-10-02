import 'fake-indexeddb/auto';
import { IDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSnapshotDatabase, readBandSnapshot } from '../snapshotDb.js';
import { refreshOfflineSnapshot } from '../refreshSnapshot.js';

const song = {
    id: 'song-1',
    bandId: 'band-a',
    title: 'Wonderwall',
    artist: 'Oasis',
    content: '{title: Wonderwall}\n[Em7]Today',
    version: 1,
};

const secondSong = {
    id: 'song-2',
    bandId: 'band-a',
    title: 'Zweiter Song',
    artist: '',
    content: '{title: Zweiter Song}',
    version: 0,
};

const setlist = {
    id: 'set-1',
    bandId: 'band-a',
    name: 'Abend',
    songIds: ['song-1', 'song-2', 'song-1'],
    version: 1,
};

function clients(overrides = {}) {
    return {
        currentUser: vi.fn(async () => ({ id: 'user-a' })),
        listBands: vi.fn(async () => [{ id: 'band-a', name: 'Band A', role: 'OWNER' }]),
        listSongs: vi.fn(async () => [song, secondSong]),
        listSetlists: vi.fn(async () => [setlist]),
        listNotes: vi.fn(async () => [{ songId: 'song-1', text: 'Capo 2' }]),
        ...overrides,
    };
}

async function refresh(clientOverrides = {}, clock = () => '2026-10-02T12:00:00.000Z') {
    return refreshOfflineSnapshot({
        token: 'access-token',
        clients: clients(clientOverrides),
        clock,
    });
}

describe('refreshOfflineSnapshot', () => {
    beforeEach(async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        await deleteSnapshotDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('schreibt einen vollständigen Band-Snapshot und kein Token', async () => {
        const result = await refresh();
        const stored = await readBandSnapshot('user-a', 'band-a');

        expect(result.failures).toEqual([]);
        expect(stored.band.name).toBe('Band A');
        expect(stored.songs.map((entry) => entry.content)).toEqual([
            '{title: Wonderwall}\n[Em7]Today',
            '{title: Zweiter Song}',
        ]);
        expect(stored.setlists[0].songIds).toEqual(['song-1', 'song-2', 'song-1']);
        expect(stored.notes).toEqual([
            { userId: 'user-a', bandId: 'band-a', songId: 'song-1', text: 'Capo 2' },
        ]);
        expect(stored.meta.refreshedAt).toBe('2026-10-02T12:00:00.000Z');
        expect(JSON.stringify(stored)).not.toContain('access-token');
    });

    it('behält den alten Snapshot, wenn Songs, Setlists oder Notizen fehlschlagen', async () => {
        await refresh();
        const failures = [
            { listSongs: vi.fn(async () => { throw new Error('songs down'); }) },
            { listSetlists: vi.fn(async () => { throw new Error('setlists down'); }) },
            { listNotes: vi.fn(async () => { throw new Error('notes down'); }) },
        ];

        for (const override of failures) {
            const result = await refresh({
                ...override,
                listSongs: override.listSongs ?? vi.fn(async () => [{ ...song, title: 'Neu', content: 'neu' }, secondSong]),
            });
            const stored = await readBandSnapshot('user-a', 'band-a');
            expect(result.failures).toHaveLength(1);
            expect(stored.songs[0].title).toBe('Wonderwall');
            expect(stored.setlists[0].songIds).toEqual(['song-1', 'song-2', 'song-1']);
            expect(stored.notes[0].text).toBe('Capo 2');
        }
    });

    it('behält den alten Snapshot, wenn IndexedDB den Commit abbricht', async () => {
        await refresh();
        const originalPut = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function failingPut() {
            throw new DOMException('disk full', 'UnknownError');
        };
        try {
            const result = await refresh({
                listSongs: vi.fn(async () => [{ ...song, title: 'Neu' }, secondSong]),
            });
            expect(result.failures).toHaveLength(1);
        } finally {
            IDBObjectStore.prototype.put = originalPut;
        }

        const stored = await readBandSnapshot('user-a', 'band-a');
        expect(stored.songs[0].title).toBe('Wonderwall');
        expect(stored.notes[0].text).toBe('Capo 2');
    });

    it('aktualisiert eine Band und behält eine andere bei Teilfehler', async () => {
        await refreshOfflineSnapshot({
            token: 'access-token',
            clock: () => '2026-10-02T12:00:00.000Z',
            clients: clients({
                listBands: vi.fn(async () => [
                    { id: 'band-a', name: 'Band A' },
                    { id: 'band-b', name: 'Band B' },
                ]),
                listSongs: vi.fn(async ({ bandId }) => [{
                    ...song,
                    bandId,
                    title: bandId,
                }]),
                listSetlists: vi.fn(async ({ bandId }) => [{ ...setlist, bandId, songIds: ['song-1'] }]),
                listNotes: vi.fn(async () => []),
            }),
        });

        const result = await refreshOfflineSnapshot({
            token: 'access-token',
            clock: () => '2026-10-02T13:00:00.000Z',
            clients: clients({
                listBands: vi.fn(async () => [
                    { id: 'band-a', name: 'Band A neu' },
                    { id: 'band-b', name: 'Band B' },
                ]),
                listSongs: vi.fn(async ({ bandId }) => {
                    if (bandId === 'band-b') {
                        throw new Error('band b down');
                    }
                    return [{ ...song, title: 'A neu' }];
                }),
                listSetlists: vi.fn(async ({ bandId }) => [{ ...setlist, bandId, songIds: ['song-1', 'song-1'] }]),
                listNotes: vi.fn(async () => [{ songId: 'song-1', text: 'neu' }]),
            }),
        });

        const bandA = await readBandSnapshot('user-a', 'band-a');
        const bandB = await readBandSnapshot('user-a', 'band-b');
        expect(result.failures.map((failure) => failure.bandId)).toEqual(['band-b']);
        expect(bandA.band.name).toBe('Band A neu');
        expect(bandA.songs[0].title).toBe('A neu');
        expect(bandA.setlists[0].songIds).toEqual(['song-1', 'song-1']);
        expect(bandA.notes[0].text).toBe('neu');
        expect(bandB.band.name).toBe('Band B');
        expect(bandB.songs[0].title).toBe('band-b');
        expect(bandB.notes).toEqual([]);
        expect(bandB.meta.refreshedAt).toBe('2026-10-02T12:00:00.000Z');
    });

    it('löscht eine Band nur nach einer erfolgreichen Bandliste', async () => {
        await refreshOfflineSnapshot({
            token: 'access-token',
            clients: clients({
                listBands: vi.fn(async () => [
                    { id: 'band-a', name: 'Band A' },
                    { id: 'band-b', name: 'Band B' },
                ]),
                listSongs: vi.fn(async ({ bandId }) => [{ ...song, bandId, title: bandId }]),
                listSetlists: vi.fn(async ({ bandId }) => [{ ...setlist, bandId, songIds: ['song-1'] }]),
                listNotes: vi.fn(async () => []),
            }),
        });

        const failedList = clients({
            listBands: vi.fn(async () => { throw new Error('offline'); }),
        });
        await expect(refreshOfflineSnapshot({
            token: 'access-token',
            clients: failedList,
        })).rejects.toThrow(/offline/);
        expect((await readBandSnapshot('user-a', 'band-b')).band.name).toBe('Band B');

        await refreshOfflineSnapshot({
            token: 'access-token',
            clients: clients({
                listBands: vi.fn(async () => [{ id: 'band-a', name: 'Band A' }]),
            }),
        });
        expect((await readBandSnapshot('user-a', 'band-a')).band).not.toBeNull();
        expect((await readBandSnapshot('user-a', 'band-b')).band).toBeNull();
        expect((await readBandSnapshot('user-a', 'band-b')).songs).toEqual([]);
        expect((await readBandSnapshot('user-a', 'band-b')).notes).toEqual([]);
    });

    it('löscht beim leeren erfolgreichen Ergebnis nur die Bands dieses Users', async () => {
        await refresh();
        const userB = clients({
            currentUser: vi.fn(async () => ({ id: 'user-b' })),
            listNotes: vi.fn(async () => [{ songId: 'song-1', text: 'Nur B' }]),
        });
        await refreshOfflineSnapshot({ token: 'token-b', clients: userB });

        await refreshOfflineSnapshot({
            token: 'access-token',
            clients: clients({ listBands: vi.fn(async () => []) }),
        });

        expect((await readBandSnapshot('user-a', 'band-a')).band).toBeNull();
        expect((await readBandSnapshot('user-b', 'band-a')).notes[0].text).toBe('Nur B');
    });

    it('lässt eine fehlgeschlagene User-Identität den Snapshot unangetastet', async () => {
        await refresh();
        await expect(refresh({
            currentUser: vi.fn(async () => { throw new Error('me down'); }),
        })).rejects.toThrow(/me down/);
        expect((await readBandSnapshot('user-a', 'band-a')).songs[0].title).toBe('Wonderwall');
    });
});
