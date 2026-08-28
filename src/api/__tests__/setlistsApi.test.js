import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../apiClient.js';
import {
    createSetlist,
    deleteSetlist,
    getSetlist,
    listSetlists,
    updateSetlist,
} from '../setlistsApi.js';

vi.mock('../apiClient.js', () => ({
    apiRequest: vi.fn(),
}));

describe('setlistsApi', () => {
    beforeEach(() => {
        vi.mocked(apiRequest).mockReset();
        vi.mocked(apiRequest).mockResolvedValue([]);
    });

    it('listet Setlists der Band', async () => {
        await listSetlists({ token: 'tok', bandId: 'band-a' });
        expect(apiRequest).toHaveBeenCalledWith({
            path: '/api/bands/band-a/setlists',
            token: 'tok',
        });
    });

    it('erzeugt, aktualisiert und löscht Setlists mit Version und Reihenfolge', async () => {
        await getSetlist({ token: 'tok', bandId: 'band-a', setlistId: 'sl-1' });
        await createSetlist({
            token: 'tok',
            bandId: 'band-a',
            name: 'Gig',
            songIds: ['a', 'b', 'a'],
        });
        await updateSetlist({
            token: 'tok',
            bandId: 'band-a',
            setlistId: 'sl-1',
            name: 'Gig',
            songIds: ['b', 'a', 'a'],
            version: 4,
        });
        await deleteSetlist({
            token: 'tok',
            bandId: 'band-a',
            setlistId: 'sl-1',
            version: 4,
        });

        expect(apiRequest).toHaveBeenNthCalledWith(2, {
            method: 'POST',
            path: '/api/bands/band-a/setlists',
            token: 'tok',
            body: { name: 'Gig', songIds: ['a', 'b', 'a'] },
        });
        expect(apiRequest).toHaveBeenNthCalledWith(3, {
            method: 'PUT',
            path: '/api/bands/band-a/setlists/sl-1',
            token: 'tok',
            body: { name: 'Gig', songIds: ['b', 'a', 'a'], version: 4 },
        });
        expect(apiRequest).toHaveBeenNthCalledWith(4, {
            method: 'DELETE',
            path: '/api/bands/band-a/setlists/sl-1',
            token: 'tok',
            query: { version: 4 },
        });
    });
});
