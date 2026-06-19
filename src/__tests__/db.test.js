import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockStore = {
    put: vi.fn(),
    getAll: vi.fn(),
    get: vi.fn(),
};

const mockTx = {
    objectStore: vi.fn(() => mockStore),
    done: Promise.resolve(),
};

const mockDb = {
    transaction: vi.fn(() => mockTx),
    put: vi.fn(),
    getAll: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
};

const createObjectStore = vi.fn();

vi.mock('idb', () => ({
    openDB: vi.fn((_name, _version, { upgrade }) => {
        const db = { createObjectStore };
        if (upgrade) {
            upgrade(db, 0);
        }
        return Promise.resolve(mockDb);
    }),
}));

import {
    initDB,
    addSongs,
    getAllSongs,
    saveSetlist,
    getSetlists,
    getSetlistById,
    deleteSetlist,
} from '../db.js';

describe('db', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('initialisiert die Datenbank mit beiden Stores', async () => {
        await initDB();
        expect(createObjectStore).toHaveBeenCalledWith('songs', { keyPath: 'Id' });
        expect(createObjectStore).toHaveBeenCalledWith('setlists', { keyPath: 'id' });
    });

    it('addSongs speichert nur Songs mit type 1 und content', async () => {
        const songs = [
            { Id: '1', type: 1, content: 'text' },
            { Id: '2', type: 2, content: 'skip' },
            { Id: '3', type: 1, content: '' },
        ];
        await addSongs(songs);
        expect(mockStore.put).toHaveBeenCalledTimes(1);
        expect(mockStore.put).toHaveBeenCalledWith(songs[0]);
    });

    it('getAllSongs liefert alle Songs', async () => {
        const songs = [{ Id: '1', title: 'Song' }];
        mockDb.getAll.mockResolvedValue(songs);
        await expect(getAllSongs()).resolves.toEqual(songs);
        expect(mockDb.getAll).toHaveBeenCalledWith('songs');
    });

    it('saveSetlist speichert eine Setlist', async () => {
        const setlist = { id: 'sl1', name: 'Gig', songIds: [] };
        await saveSetlist(setlist);
        expect(mockDb.put).toHaveBeenCalledWith('setlists', setlist);
    });

    it('getSetlists liefert alle Setlists', async () => {
        const setlists = [{ id: 'sl1', name: 'Gig' }];
        mockDb.getAll.mockResolvedValue(setlists);
        await expect(getSetlists()).resolves.toEqual(setlists);
    });

    it('getSetlistById liefert eine Setlist', async () => {
        const setlist = { id: 'sl1', name: 'Gig' };
        mockDb.get.mockResolvedValue(setlist);
        await expect(getSetlistById('sl1')).resolves.toEqual(setlist);
    });

    it('deleteSetlist löscht eine Setlist', async () => {
        await deleteSetlist('sl1');
        expect(mockDb.delete).toHaveBeenCalledWith('setlists', 'sl1');
    });
});
