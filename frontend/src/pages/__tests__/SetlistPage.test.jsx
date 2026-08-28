import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import SetlistPage from '../SetlistPage.jsx';
import { listSongs } from '../../api/songsApi.js';
import {
    createSetlist,
    deleteSetlist,
    getSetlist,
    listSetlists,
    updateSetlist,
} from '../../api/setlistsApi.js';
import { ApiError } from '../../api/apiClient.js';
import * as db from '../../db';
import {
    BAND_A,
    authenticatedAuth,
    renderWithBand,
    stubBandsFetch,
    unauthenticatedAuth,
} from '../../__tests__/helpers/musicTestUtils.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: true,
    apiBaseUrl: 'http://localhost:8080',
}));

vi.mock('../../api/songsApi.js', () => ({
    listSongs: vi.fn(),
    getSong: vi.fn(),
    createSong: vi.fn(),
    updateSong: vi.fn(),
}));

vi.mock('../../api/setlistsApi.js', () => ({
    listSetlists: vi.fn(),
    getSetlist: vi.fn(),
    createSetlist: vi.fn(),
    updateSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
}));

vi.mock('../../db', () => ({
    addSongs: vi.fn(),
    getAllSongs: vi.fn(),
    getSetlists: vi.fn(),
    saveSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
}));

const songOne = {
    id: 'song-1',
    bandId: BAND_A.id,
    title: 'Song One',
    artist: '',
    content: '{title: Song One}',
    version: 0,
};
const songTwo = {
    id: 'song-2',
    bandId: BAND_A.id,
    title: 'Song Two',
    artist: '',
    content: '{title: Song Two}',
    version: 0,
};

const savedSetlist = {
    id: 'sl1',
    bandId: BAND_A.id,
    name: 'Saved Gig',
    songIds: ['song-1'],
    version: 2,
};

async function addSongByName(name) {
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByRole('option', { name }));
}

describe('SetlistPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);
        vi.mocked(listSongs).mockResolvedValue([songOne, songTwo]);
        vi.mocked(listSetlists).mockResolvedValue([savedSetlist]);
        vi.mocked(createSetlist).mockImplementation(async ({ name, songIds }) => ({
            id: 'sl-new',
            bandId: BAND_A.id,
            name,
            songIds,
            version: 0,
        }));
        vi.mocked(updateSetlist).mockImplementation(async ({ name, songIds, version }) => ({
            id: savedSetlist.id,
            bandId: BAND_A.id,
            name,
            songIds,
            version: version + 1,
        }));
        vi.mocked(deleteSetlist).mockResolvedValue(null);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('lädt Setlists und Songs der aktiven Band aus der API', async () => {
        renderWithBand(<SetlistPage />);

        expect(await screen.findByText('Saved Gig (1)')).toBeInTheDocument();
        expect(listSetlists).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_A.id,
        });
        expect(listSongs).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_A.id,
        });
        expect(db.getSetlists).not.toHaveBeenCalled();
        expect(db.getAllSongs).not.toHaveBeenCalled();

        fireEvent.mouseDown(screen.getByRole('combobox'));
        expect(await screen.findByRole('option', { name: 'Song Two' })).toBeInTheDocument();
    });

    it('erlaubt doppelte Song-IDs und behält [A, B, A]', async () => {
        renderWithBand(<SetlistPage />);
        await screen.findByText('Saved Gig (1)');

        await addSongByName('Song One');
        await addSongByName('Song Two');
        await addSongByName('Song One');

        const entries = screen.getByRole('list', { name: 'Setlist-Einträge' });
        const items = within(entries).getAllByRole('listitem');
        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent('Song One');
        expect(items[1]).toHaveTextContent('Song Two');
        expect(items[2]).toHaveTextContent('Song One');

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ABA Gig' } });
        fireEvent.click(screen.getByRole('button', { name: 'Setlist speichern' }));

        await waitFor(() => {
            expect(createSetlist).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                name: 'ABA Gig',
                songIds: ['song-1', 'song-2', 'song-1'],
            });
        });
    });

    it('entfernt nur die gewählte Vorkommen-Zeile', async () => {
        renderWithBand(<SetlistPage />);
        await screen.findByText('Saved Gig (1)');

        await addSongByName('Song One');
        await addSongByName('Song Two');
        await addSongByName('Song One');

        const removeButtons = screen.getAllByRole('button', { name: 'Entfernen' });
        fireEvent.click(removeButtons[0]);

        const entries = screen.getByRole('list', { name: 'Setlist-Einträge' });
        const items = within(entries).getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('Song Two');
        expect(items[1]).toHaveTextContent('Song One');
    });

    it('sendet beim Update die aktuelle Version und die UI-Reihenfolge', async () => {
        renderWithBand(<SetlistPage />);
        fireEvent.click(await screen.findByText('Saved Gig (1)'));

        await addSongByName('Song Two');
        fireEvent.click(screen.getAllByRole('button', { name: 'Hoch' })[1]);
        fireEvent.click(screen.getByRole('button', { name: 'Setlist speichern' }));

        await waitFor(() => {
            expect(updateSetlist).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                setlistId: 'sl1',
                name: 'Saved Gig',
                songIds: ['song-2', 'song-1'],
                version: 2,
            });
        });
    });

    it('sendet beim Löschen die erwartete Version', async () => {
        renderWithBand(<SetlistPage />);
        await screen.findByText('Saved Gig (1)');

        fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

        await waitFor(() => {
            expect(deleteSetlist).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                setlistId: 'sl1',
                version: 2,
            });
        });
        expect(db.deleteSetlist).not.toHaveBeenCalled();
    });

    it('zeigt Setlist-409 sichtbar und überschreibt die Bearbeitung nicht still', async () => {
        vi.mocked(updateSetlist).mockRejectedValue(
            new ApiError(409, 'conflict', 'stale version')
        );
        renderWithBand(<SetlistPage />);
        fireEvent.click(await screen.findByText('Saved Gig (1)'));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Local name' } });
        fireEvent.click(screen.getByRole('button', { name: 'Setlist speichern' }));

        expect(await screen.findByText(/zwischenzeitlich geändert/i)).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toHaveValue('Local name');
        expect(getSetlist).not.toHaveBeenCalled();

        vi.mocked(getSetlist).mockResolvedValue({
            ...savedSetlist,
            name: 'Server name',
            songIds: ['song-2'],
            version: 9,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Vom Server laden' }));

        await waitFor(() => {
            expect(getSetlist).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                setlistId: 'sl1',
            });
        });
        expect(screen.getByLabelText('Name')).toHaveValue('Server name');
    });

    it('stürzt nicht ab, wenn eine Song-ID nicht mehr auflösbar ist', async () => {
        vi.mocked(listSetlists).mockResolvedValue([{
            ...savedSetlist,
            songIds: ['missing-song', 'song-1'],
        }]);
        renderWithBand(<SetlistPage />);
        fireEvent.click(await screen.findByText('Saved Gig (2)'));

        const entries = screen.getByRole('list', { name: 'Setlist-Einträge' });
        const items = within(entries).getAllByRole('listitem');
        expect(items[0]).toHaveTextContent('missing-song');
        expect(items[1]).toHaveTextContent('Song One');
        expect(screen.getByText('Dieser Song ist in der Band nicht mehr verfügbar.')).toBeInTheDocument();
    });

    it('setzt das Formular über Neue Setlist zurück', async () => {
        renderWithBand(<SetlistPage />);
        fireEvent.click(await screen.findByText('Saved Gig (1)'));
        expect(screen.getByLabelText('Name')).toHaveValue('Saved Gig');

        fireEvent.click(screen.getByRole('button', { name: 'Neue Setlist' }));
        expect(screen.getByLabelText('Name')).toHaveValue('');
        expect(screen.getByRole('heading', { name: 'Neue Setlist' })).toBeInTheDocument();
    });

    it('fällt ohne Anmeldung nicht auf IndexedDB zurück', () => {
        mockUseAuth.mockReturnValue(unauthenticatedAuth());
        renderWithBand(<SetlistPage />);

        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
        expect(listSetlists).not.toHaveBeenCalled();
        expect(listSongs).not.toHaveBeenCalled();
        expect(db.getSetlists).not.toHaveBeenCalled();
        expect(db.getAllSongs).not.toHaveBeenCalled();
    });

    it('stellt ohne aktive Band keine Setlist-Anfrage', async () => {
        stubBandsFetch([]);
        renderWithBand(<SetlistPage />);

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        expect(listSetlists).not.toHaveBeenCalled();
        expect(listSongs).not.toHaveBeenCalled();
        expect(db.getSetlists).not.toHaveBeenCalled();
    });

    it('zeigt bei 403 eine verständliche Meldung', async () => {
        vi.mocked(listSetlists).mockRejectedValue(
            new ApiError(403, 'forbidden', 'insufficient role')
        );
        renderWithBand(<SetlistPage />);

        expect(await screen.findByText(/nicht erlaubt/i)).toBeInTheDocument();
        expect(db.getSetlists).not.toHaveBeenCalled();
    });
});
