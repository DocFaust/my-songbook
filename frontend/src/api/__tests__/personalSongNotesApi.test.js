import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../apiClient.js';
import {
    deletePersonalSongNote,
    getPersonalSongNote,
    listPersonalSongNotes,
    savePersonalSongNote,
} from '../personalSongNotesApi.js';

vi.mock('../apiClient.js', () => ({
    apiRequest: vi.fn(),
}));

describe('personalSongNotesApi', () => {
    beforeEach(() => {
        vi.mocked(apiRequest).mockReset();
        vi.mocked(apiRequest).mockResolvedValue({ text: '' });
    });

    it('liest, speichert und löscht nur die eigene Notiz', async () => {
        await listPersonalSongNotes({ token: 'tok', bandId: 'band-a' });
        await getPersonalSongNote({ token: 'tok', bandId: 'band-a', songId: 'song-1' });
        await savePersonalSongNote({
            token: 'tok',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo 2',
        });
        await deletePersonalSongNote({ token: 'tok', bandId: 'band-a', songId: 'song-1' });

        expect(apiRequest).toHaveBeenNthCalledWith(1, {
            path: '/api/bands/band-a/notes',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(2, {
            path: '/api/bands/band-a/songs/song-1/note',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(3, {
            method: 'PUT',
            path: '/api/bands/band-a/songs/song-1/note',
            token: 'tok',
            body: { text: 'Capo 2' },
        });
        expect(apiRequest).toHaveBeenNthCalledWith(4, {
            method: 'DELETE',
            path: '/api/bands/band-a/songs/song-1/note',
            token: 'tok',
        });
        expect(apiRequest.mock.calls[0][0]).not.toHaveProperty('body');
        expect(apiRequest.mock.calls[2][0].body).not.toHaveProperty('content');
        expect(apiRequest.mock.calls[2][0].body).not.toHaveProperty('userId');
    });
});
