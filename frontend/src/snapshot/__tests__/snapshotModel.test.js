import { describe, expect, it } from 'vitest';
import { buildBandSnapshot } from '../snapshotModel.js';

function payload() {
    return {
        userId: 'user-a',
        band: { id: 'band-a', name: 'Band A' },
        songs: [{
            id: 'song-1',
            bandId: 'band-a',
            title: 'Song',
            artist: 'A',
            content: '{title: Song}',
        }],
        setlists: [{
            id: 'set-1',
            bandId: 'band-a',
            name: 'Set',
            songIds: ['song-1', 'song-1'],
        }],
        notes: [{ songId: 'song-1', text: 'Capo 2', version: 0 }],
        refreshedAt: '2026-10-02T12:00:00.000Z',
    };
}

describe('buildBandSnapshot', () => {
    it('lehnt unvollständige oder bandfremde Daten ab', () => {
        const cases = [
            [{ ...payload(), userId: '' }, /userId/],
            [{ ...payload(), band: { id: 'band-a', name: '' } }, /Bandname/],
            [{ ...payload(), songs: null }, /Songs/],
            [{ ...payload(), songs: [{ ...payload().songs[0], bandId: 'other' }] }, /anderen Band/],
            [{ ...payload(), songs: [{ ...payload().songs[0], content: null }] }, /ChordPro/],
            [{ ...payload(), songs: [payload().songs[0], payload().songs[0]] }, /doppelte Song-ID/],
            [{ ...payload(), setlists: [{ ...payload().setlists[0], bandId: 'other' }] }, /anderen Band/],
            [{ ...payload(), setlists: [payload().setlists[0], payload().setlists[0]] }, /doppelte Setlist-ID/],
            [{ ...payload(), setlists: [{ ...payload().setlists[0], songIds: ['song-1', ''] }] }, /Setlist-Song/],
            [{ ...payload(), notes: [{ songId: 'song-1', text: '   ' }] }, /leere Notiz/],
            [{ ...payload(), notes: [{ songId: 'song-1', text: 'Capo 2' }] }, /Notizversion/],
            [{ ...payload(), notes: [{ songId: 'missing', text: 'x', version: 0 }] }, /ohne Song/],
            [{ ...payload(), notes: [payload().notes[0], payload().notes[0]] }, /doppelte Notiz/],
            [{ ...payload(), refreshedAt: null }, /Zeitpunkt/],
        ];

        for (const [input, pattern] of cases) {
            expect(() => buildBandSnapshot(input)).toThrow(pattern);
        }
    });
});
