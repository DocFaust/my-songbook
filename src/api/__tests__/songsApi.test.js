import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../apiClient.js';
import { createSong, getSong, listSongs, updateSong } from '../songsApi.js';

vi.mock('../apiClient.js', () => ({
    apiRequest: vi.fn(),
}));

describe('songsApi', () => {
    beforeEach(() => {
        vi.mocked(apiRequest).mockReset();
        vi.mocked(apiRequest).mockResolvedValue([]);
    });

    it('listet Songs der Band', async () => {
        await listSongs({ token: 'tok', bandId: 'band-a' });
        expect(apiRequest).toHaveBeenCalledWith({
            path: '/api/bands/band-a/songs',
            token: 'tok',
        });
    });

    it('lädt, erzeugt und aktualisiert Songs ohne clientseitige ID', async () => {
        await getSong({ token: 'tok', bandId: 'band-a', songId: 'song-1' });
        await createSong({
            token: 'tok',
            bandId: 'band-a',
            title: 'Titel',
            artist: 'Artist',
            content: '{title: Titel}',
        });
        await updateSong({
            token: 'tok',
            bandId: 'band-a',
            songId: 'song-1',
            title: 'Titel',
            artist: 'Artist',
            content: '{title: Titel}',
            version: 2,
        });

        expect(apiRequest).toHaveBeenNthCalledWith(1, {
            path: '/api/bands/band-a/songs/song-1',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(2, {
            method: 'POST',
            path: '/api/bands/band-a/songs',
            token: 'tok',
            body: { title: 'Titel', artist: 'Artist', content: '{title: Titel}' },
        });
        expect(apiRequest).toHaveBeenNthCalledWith(3, {
            method: 'PUT',
            path: '/api/bands/band-a/songs/song-1',
            token: 'tok',
            body: {
                title: 'Titel',
                artist: 'Artist',
                content: '{title: Titel}',
                version: 2,
            },
        });
    });
});
