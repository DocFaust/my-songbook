import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/apiClient.js';
import { deleteSnapshotDatabase } from '../../snapshot/snapshotDb.js';
import { listPendingNotes, stageNoteChange } from '../pendingNotes.js';
import { discardPendingNote, resolvePendingNote, syncPendingNotes } from '../syncPendingNotes.js';

const note = { songId: 'song-1', text: 'Capo 2', version: 1 };

async function stage(text, songId = 'song-1', base = note) {
    await stageNoteChange({
        userId: 'user-a',
        bandId: 'band-a',
        songId,
        text,
        snapshotNote: base,
    });
}

describe('syncPendingNotes', () => {
    beforeEach(async () => {
        await deleteSnapshotDatabase();
    });

    it('synchronisiert einen unveränderten Serverstand und entfernt die Pending-Notiz', async () => {
        await stage('Capo 3');
        const saveNote = vi.fn(async () => ({ text: 'Capo 3', version: 2 }));
        const result = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });

        expect(result.networkFailed).toBe(false);
        expect(result.synced).toHaveLength(1);
        expect(saveNote).toHaveBeenCalledWith({
            token: 'token',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo 3',
            expectedVersion: 1,
        });
        expect(await listPendingNotes('user-a')).toEqual([]);
    });

    it('lässt bei einem Netzwerkfehler die noch nicht synchronisierte Notiz liegen', async () => {
        await stage('eins', 'song-1');
        await stage('zwei', 'song-2', { songId: 'song-2', text: 'alt', version: 0 });
        const saveNote = vi.fn()
            .mockResolvedValueOnce({ text: 'eins', version: 2 })
            .mockRejectedValueOnce(new ApiError(0, 'network', 'offline'));

        const result = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });

        expect(result.networkFailed).toBe(true);
        expect(result.synced).toHaveLength(1);
        expect((await listPendingNotes('user-a')).map((change) => change.songId)).toEqual(['song-2']);
    });

    it('synchronisiert konfliktfreie Notizen und hält den Konflikt fest', async () => {
        await stage('lokal', 'song-1');
        await stage('ok', 'song-2', { songId: 'song-2', text: 'alt', version: 3 });
        const saveNote = vi.fn(async ({ songId }) => {
            if (songId === 'song-1') {
                throw new ApiError(409, 'conflict', 'stale version', {
                    code: 'changed',
                    text: 'server',
                    version: 8,
                });
            }
            return { text: 'ok', version: 4 };
        });

        const result = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });

        expect(result.conflicts).toHaveLength(1);
        expect(result.synced).toHaveLength(1);
        const pending = await listPendingNotes('user-a');
        expect(pending).toHaveLength(1);
        expect(pending[0].conflict).toMatchObject({ code: 'changed', serverText: 'server', serverVersion: 8 });
    });

    it('wendet die lokale Fassung gegen den aktuellen Serverstand an', async () => {
        await stage('lokal');
        const pending = (await listPendingNotes('user-a'))[0];
        pending.conflict = { code: 'changed', serverText: 'server', serverVersion: 9 };
        const saveNote = vi.fn(async () => ({ text: 'lokal', version: 10 }));

        const result = await resolvePendingNote({
            change: pending,
            choice: 'local',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });

        expect(result.ok).toBe(true);
        expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 9, text: 'lokal' }));
        expect(await listPendingNotes('user-a')).toEqual([]);
    });

    it('verwirft die lokale Fassung, wenn die Server-Version gelten soll', async () => {
        await stage('lokal');
        const pending = (await listPendingNotes('user-a'))[0];
        pending.conflict = { code: 'changed', serverText: 'server', serverVersion: 9 };
        const saveNote = vi.fn();

        await resolvePendingNote({
            change: pending,
            choice: 'server',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });

        expect(saveNote).not.toHaveBeenCalled();
        expect(await listPendingNotes('user-a')).toEqual([]);
    });

    it('markiert einen gelöschten Song und eine verlorene Mitgliedschaft', async () => {
        await stage('lokal', 'song-1');
        await stage('andere', 'song-2', { songId: 'song-2', text: 'alt', version: 1 });
        const saveNote = vi.fn(async ({ songId }) => {
            throw new ApiError(404, 'not_found', 'Not found', {
                code: songId === 'song-1' ? 'song' : 'membership',
            });
        });

        const result = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });

        expect(result.blocked.map((change) => change.blocked).sort()).toEqual(['membership', 'song']);
        expect(await listPendingNotes('user-a')).toHaveLength(2);
        await discardPendingNote(result.blocked[0]);
        expect(await listPendingNotes('user-a')).toHaveLength(1);
    });

    it('legt eine offline neue Notiz an und löscht eine gemerkte Notiz', async () => {
        await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-new',
            text: 'neu',
            snapshotNote: null,
        });
        await stage('weg');
        const created = (await listPendingNotes('user-a')).find((change) => change.songId === 'song-1');
        created.action = 'DELETE';
        created.text = '';
        const { putPendingNoteChange } = await import('../../snapshot/snapshotDb.js');
        await putPendingNoteChange(created);

        const saveNote = vi.fn(async () => ({ text: 'neu', version: 0 }));
        const deleteNote = vi.fn(async () => undefined);
        const result = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote, getNote: vi.fn() },
        });

        expect(result.synced).toHaveLength(2);
        expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ expectAbsent: true, text: 'neu' }));
        expect(deleteNote).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 1 }));
    });

    it('holt die Basisversion, wenn der Snapshot keine Version gespeichert hat', async () => {
        await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-legacy',
            text: 'neu',
            snapshotNote: { text: 'alt' },
        });
        const getNote = vi.fn(async () => ({ text: 'alt', version: 4 }));
        const saveNote = vi.fn(async () => ({ text: 'neu', version: 5 }));

        await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote },
        });

        expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 4 }));
    });

    it('behandelt Löschen, Wiederherstellen und einen erneuten Konflikt', async () => {
        await stage('lokal', 'song-del');
        await stage('zurück', 'song-restore', { songId: 'song-restore', text: 'alt', version: 2 });
        const pending = await listPendingNotes('user-a');
        const deletion = pending.find((change) => change.songId === 'song-del');
        deletion.action = 'DELETE';
        deletion.conflict = { code: 'changed', serverText: 'online', serverVersion: 6 };
        const restore = pending.find((change) => change.songId === 'song-restore');
        restore.conflict = { code: 'deleted', serverText: '', serverVersion: null };
        const { putPendingNoteChange } = await import('../../snapshot/snapshotDb.js');
        await putPendingNoteChange(deletion);
        await putPendingNoteChange(restore);

        const deleteNote = vi.fn(async () => undefined);
        await resolvePendingNote({
            change: deletion,
            choice: 'local',
            token: 'token',
            clients: { saveNote: vi.fn(), deleteNote, getNote: vi.fn() },
        });
        expect(deleteNote).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 6 }));

        const saveNote = vi.fn(async () => ({ text: 'zurück', version: 0 }));
        await resolvePendingNote({
            change: restore,
            choice: 'local',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });
        expect(saveNote).toHaveBeenCalledWith(expect.objectContaining({ expectAbsent: true }));

        await stage('nochmal', 'song-again', { songId: 'song-again', text: 'alt', version: 1 });
        const fresh = (await listPendingNotes('user-a')).find((change) => change.songId === 'song-again');
        fresh.conflict = { code: 'changed', serverText: 'x', serverVersion: 1 };
        const raced = vi.fn(async () => {
            throw new ApiError(409, 'conflict', 'stale version', { code: 'changed', text: 'neuer', version: 3 });
        });
        const outcome = await resolvePendingNote({
            change: fresh,
            choice: 'local',
            token: 'token',
            clients: { saveNote: raced, deleteNote: vi.fn(), getNote: vi.fn() },
        });
        expect(outcome.ok).toBe(false);
        expect(outcome.reason).toBe('conflict');
    });

    it('meldet Netzwerk, fehlenden Song und eine 409 ohne Text', async () => {
        await stage('lokal');
        const change = (await listPendingNotes('user-a'))[0];
        change.conflict = { code: 'changed', serverText: 's', serverVersion: 2 };
        const network = await resolvePendingNote({
            change,
            choice: 'local',
            token: 'token',
            clients: {
                saveNote: async () => {
                    throw new ApiError(0, 'network', 'offline');
                },
                deleteNote: vi.fn(),
                getNote: vi.fn(),
            },
        });
        expect(network).toMatchObject({ ok: false, reason: 'network' });

        const blocked = await resolvePendingNote({
            change,
            choice: 'local',
            token: 'token',
            clients: {
                saveNote: async () => {
                    throw new ApiError(404, 'not_found', 'Not found', { code: 'membership' });
                },
                deleteNote: vi.fn(),
                getNote: vi.fn(),
            },
        });
        expect(blocked.reason).toBe('membership');

        await stage('offen', 'song-open', { songId: 'song-open', text: 'alt', version: 1 });
        const getNote = vi.fn(async () => ({ text: 'aktuell', version: 5 }));
        const saveNote = vi.fn(async () => {
            throw new ApiError(409, 'conflict', 'stale version', { code: 'changed' });
        });
        const result = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote },
        });
        expect(result.conflicts[0].conflict).toMatchObject({ serverText: 'aktuell', serverVersion: 5 });
    });

    it('gibt einen Authentifizierungsfehler weiter', async () => {
        await stage('lokal');
        await expect(syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: {
                saveNote: async () => {
                    throw new ApiError(401, 'unauthorized', 'unauthorized');
                },
                deleteNote: vi.fn(),
                getNote: vi.fn(),
            },
        })).rejects.toMatchObject({ kind: 'unauthorized' });
    });

    it('überspringt bereits blockierte oder konfliktbehaftete Notizen', async () => {
        await stage('lokal');
        const change = (await listPendingNotes('user-a'))[0];
        change.blocked = 'song';
        const { putPendingNoteChange } = await import('../../snapshot/snapshotDb.js');
        await putPendingNoteChange(change);
        const saveNote = vi.fn();
        const blocked = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });
        expect(blocked.blocked).toHaveLength(1);
        expect(saveNote).not.toHaveBeenCalled();

        change.blocked = null;
        change.conflict = { code: 'changed', serverText: 's', serverVersion: 2 };
        await putPendingNoteChange(change);
        const conflicts = await syncPendingNotes({
            userId: 'user-a',
            token: 'token',
            clients: { saveNote, deleteNote: vi.fn(), getNote: vi.fn() },
        });
        expect(conflicts.conflicts).toHaveLength(1);
    });

    it('synchronisiert während eines offenen Performance Mode nicht von selbst', async () => {
        await stage('lokal');
        const saveNote = vi.fn();
        expect(saveNote).not.toHaveBeenCalled();
        expect(await listPendingNotes('user-a')).toHaveLength(1);
    });
});
