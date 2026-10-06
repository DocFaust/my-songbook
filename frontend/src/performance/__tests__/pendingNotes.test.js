import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBandSnapshot } from '../../snapshot/snapshotModel.js';
import { deleteSnapshotDatabase, replaceBandSnapshot } from '../../snapshot/snapshotDb.js';
import { readPerformanceMusic, readPerformanceNote } from '../musicRead.js';
import { displayedNote, listPendingNotes, stageNoteChange } from '../pendingNotes.js';

const snapshotNote = { songId: 'song-1', text: 'Capo 2', version: 4 };

async function seed() {
    await replaceBandSnapshot(buildBandSnapshot({
        userId: 'user-a',
        band: { id: 'band-a', name: 'Band A', role: 'OWNER' },
        songs: [{
            id: 'song-1',
            bandId: 'band-a',
            title: 'Wonderwall',
            artist: 'Oasis',
            content: '{title: Wonderwall}',
        }],
        setlists: [{
            id: 'set-1',
            bandId: 'band-a',
            name: 'Abend',
            songIds: ['song-1', 'song-1'],
        }],
        notes: [snapshotNote],
        refreshedAt: '2026-10-06T17:42:00.000Z',
    }));
}

describe('pendingNotes', () => {
    beforeEach(async () => {
        await deleteSnapshotDatabase();
        await seed();
    });

    it('verdichtet mehrere Änderungen und lässt den Server-Snapshot stehen', async () => {
        await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo 3',
            snapshotNote,
            now: () => '2026-10-06T18:00:00.000Z',
        });
        await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo 4',
            snapshotNote,
            now: () => '2026-10-06T18:05:00.000Z',
        });

        const pending = await listPendingNotes('user-a');
        expect(pending).toHaveLength(1);
        expect(pending[0]).toMatchObject({
            action: 'UPSERT',
            text: 'Capo 4',
            baseVersion: 4,
            baseText: 'Capo 2',
            baseAbsent: false,
        });
        const music = await readPerformanceMusic('user-a', 'band-a');
        expect(music.setlists[0].songIds).toEqual(['song-1', 'song-1']);
        expect(music.songs[0].content).toContain('Wonderwall');
        expect(music.refreshedAt).toBe('2026-10-06T17:42:00.000Z');
        const shown = await readPerformanceNote('user-a', 'band-a', 'song-1');
        expect(shown).toMatchObject({ text: 'Capo 4', pending: true });
        expect(displayedNote(snapshotNote, null).text).toBe('Capo 2');
    });

    it('merkt sich eine neue Notiz als auf dem Server fehlend', async () => {
        const created = await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'neu',
            snapshotNote: null,
        });
        expect(created).toMatchObject({ action: 'UPSERT', baseAbsent: true, baseVersion: null });
    });

    it('verdichtet eine Änderung bis zum Löschen und übersteht einen Reload des Stores', async () => {
        await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo 9',
            snapshotNote,
        });
        await stageNoteChange({
            userId: 'user-a',
            bandId: 'band-a',
            songId: 'song-1',
            text: '   ',
            snapshotNote,
        });
        const pending = await listPendingNotes('user-a');
        expect(pending).toEqual([
            expect.objectContaining({ action: 'DELETE', text: '', baseVersion: 4 }),
        ]);
        expect((await readPerformanceNote('user-a', 'band-a', 'song-1')).text).toBe('');
    });

    it('zeigt Pending-Notizen eines anderen Users nicht', async () => {
        await stageNoteChange({
            userId: 'user-b',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'fremd',
            snapshotNote: null,
        });
        expect(await listPendingNotes('user-a')).toEqual([]);
        expect((await readPerformanceNote('user-a', 'band-a', 'song-1')).text).toBe('Capo 2');
    });
});
