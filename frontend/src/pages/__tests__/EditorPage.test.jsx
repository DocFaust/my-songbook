import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorPage from '../EditorPage.jsx';
import BandSelector from '../../band/BandSelector.jsx';
import { createSong, getSong, listSongs, updateSong } from '../../api/songsApi.js';
import { ApiError } from '../../api/apiClient.js';
import * as db from '../../db';
import {
    BAND_A,
    BAND_B,
    SONG_A,
    SONG_B,
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

vi.mock('../../db', () => ({
    addSongs: vi.fn(),
    getAllSongs: vi.fn(),
    getSetlists: vi.fn(),
    saveSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
}));

const existingSong = {
    id: 'song-1',
    bandId: BAND_A.id,
    title: 'Existing',
    artist: 'Band',
    content: '{title: Existing}',
    version: 0,
};

describe('EditorPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);
        vi.mocked(listSongs).mockResolvedValue([existingSong]);
        vi.mocked(createSong).mockResolvedValue({
            id: 'new-song',
            bandId: BAND_A.id,
            title: 'Neuer Song',
            artist: '',
            content: '{title: New}',
            version: 0,
        });
        vi.mocked(updateSong).mockImplementation(async ({ content, version }) => ({
            ...existingSong,
            content,
            version: version + 1,
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('lädt die Songliste der angemeldeten aktiven Band aus der API', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Existing')).toBeInTheDocument();
        expect(listSongs).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_A.id,
        });
        expect(db.getAllSongs).not.toHaveBeenCalled();

        fireEvent.click(screen.getByText('Existing'));
        expect(screen.getByDisplayValue('{title: Existing}')).toBeInTheDocument();
    });

    it('erzeugt einen Song über die API statt als lokales Fake-Objekt', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await screen.findByText('Existing');
        fireEvent.click(screen.getByRole('button', { name: 'New' }));
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox'), { target: { value: '{title: New}' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(createSong).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                title: 'Neuer Song',
                artist: '',
                content: '{title: New}',
            });
        });
        expect(createSong.mock.calls[0][0]).not.toHaveProperty('id');
        expect(await screen.findByRole('heading', { level: 3, name: 'Neuer Song' })).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getAllByText('Neuer Song').length).toBeGreaterThan(1);
        });
        expect(db.addSongs).not.toHaveBeenCalled();
    });

    it('aktualisiert mit der aktuellen Version und speichert die neue Server-Version', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'edited once' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenCalledWith(expect.objectContaining({
                songId: 'song-1',
                content: 'edited once',
                version: 0,
            }));
        });

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'edited twice' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenLastCalledWith(expect.objectContaining({
                songId: 'song-1',
                content: 'edited twice',
                version: 1,
            }));
        });
        expect(db.addSongs).not.toHaveBeenCalled();
    });

    it('überschreibt bei 409 nicht still und behält den editierten Text', async () => {
        vi.mocked(updateSong).mockRejectedValue(
            new ApiError(409, 'conflict', 'stale version')
        );
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'local edit' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        expect(await screen.findByText(/zwischenzeitlich geändert/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('local edit')).toBeInTheDocument();
        expect(screen.queryByText('Song gespeichert!')).not.toBeInTheDocument();
        expect(getSong).not.toHaveBeenCalled();

        vi.mocked(getSong).mockResolvedValue({
            ...existingSong,
            content: 'server content',
            version: 4,
        });
        fireEvent.click(screen.getByRole('button', { name: 'Vom Server laden' }));

        await waitFor(() => {
            expect(getSong).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                songId: 'song-1',
            });
        });
        expect(await screen.findByDisplayValue('server content')).toBeInTheDocument();
    });

    it('lädt beim Bandwechsel die Songs der neuen Band und blendet die alten aus', async () => {
        stubBandsFetch([BAND_A, BAND_B]);
        vi.mocked(listSongs).mockImplementation(async ({ bandId }) => {
            if (bandId === BAND_A.id) {
                return [SONG_A];
            }
            if (bandId === BAND_B.id) {
                return [SONG_B];
            }
            return [];
        });

        renderWithBand(
            <MemoryRouter>
                <BandSelector />
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Song A')).toBeInTheDocument();
        expect(screen.queryByText('Song B')).not.toBeInTheDocument();

        fireEvent.mouseDown(screen.getByLabelText('Aktive Band'));
        fireEvent.click(await screen.findByRole('option', { name: 'Band B' }));

        expect(await screen.findByText('Song B')).toBeInTheDocument();
        expect(screen.queryByText('Song A')).not.toBeInTheDocument();
        expect(listSongs).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_B.id,
        });
        expect(db.getAllSongs).not.toHaveBeenCalled();
    });

    it('fällt ohne Anmeldung nicht auf IndexedDB zurück', () => {
        mockUseAuth.mockReturnValue(unauthenticatedAuth());
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
        expect(listSongs).not.toHaveBeenCalled();
        expect(db.getAllSongs).not.toHaveBeenCalled();
        expect(db.addSongs).not.toHaveBeenCalled();
    });

    it('stellt ohne aktive Band keine Song-Anfrage', async () => {
        stubBandsFetch([]);
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        expect(listSongs).not.toHaveBeenCalled();
        expect(db.getAllSongs).not.toHaveBeenCalled();
    });

    it('zeigt bei 403 eine verständliche Meldung', async () => {
        vi.mocked(listSongs).mockRejectedValue(
            new ApiError(403, 'forbidden', 'insufficient role')
        );
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText(/nicht erlaubt/i)).toBeInTheDocument();
        expect(db.getAllSongs).not.toHaveBeenCalled();
    });
});
