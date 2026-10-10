import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorPage from '../EditorPage.jsx';
import BandSelector from '../../band/BandSelector.jsx';
import { createSong, getSong, listSongs, updateSong } from '../../api/songsApi.js';
import { getPersonalSongNote, savePersonalSongNote } from '../../api/personalSongNotesApi.js';
import { ApiError } from '../../api/apiClient.js';
import {
    BAND_A,
    BAND_B,
    BAND_GUEST,
    SONG_A,
    SONG_B,
    authenticatedAuth,
    chooseBand,
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

vi.mock('../../api/personalSongNotesApi.js', () => ({
    getPersonalSongNote: vi.fn(),
    savePersonalSongNote: vi.fn(),
    deletePersonalSongNote: vi.fn(),
    listPersonalSongNotes: vi.fn(),
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
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: '' });
        vi.mocked(savePersonalSongNote).mockImplementation(async ({ text }) => ({ text }));
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

        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: '{title: New}' } });
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
    });

    it('aktualisiert mit der aktuellen Version und speichert die neue Server-Version', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'edited once' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenCalledWith(expect.objectContaining({
                songId: 'song-1',
                content: 'edited once',
                version: 0,
            }));
        });

        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'edited twice' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenLastCalledWith(expect.objectContaining({
                songId: 'song-1',
                content: 'edited twice',
                version: 1,
            }));
        });
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
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'local edit' } });
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
        fireEvent.click(screen.getByText('Song A'));
        expect(screen.getByDisplayValue('{title: Song A}')).toBeInTheDocument();

        await chooseBand('Band B');

        expect(await screen.findByText('Song B')).toBeInTheDocument();
        expect(screen.queryByText('Song A')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('{title: Song A}')).not.toBeInTheDocument();
        expect(listSongs).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_B.id,
        });
    });

    it('stellt ohne Anmeldung keine Song-Anfrage', () => {
        mockUseAuth.mockReturnValue(unauthenticatedAuth());
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
        expect(listSongs).not.toHaveBeenCalled();
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
    });

    it('zeigt bei 403 eine verständliche Meldung und keine Songs', async () => {
        vi.mocked(listSongs).mockRejectedValue(
            new ApiError(403, 'forbidden', 'insufficient role')
        );
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText(/nicht erlaubt/i)).toBeInTheDocument();
        expect(screen.queryByText('Existing')).not.toBeInTheDocument();
    });

    it('zeigt bei API-Fehler die Fehlermeldung und keine lokalen Songs', async () => {
        vi.mocked(listSongs).mockRejectedValue(
            new ApiError(0, 'network', 'Keine Verbindung zum Server.')
        );
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.queryByText('Existing')).not.toBeInTheDocument();
    });

    it('blendet nach Bandwechsel mit API-Fehler die Songs der vorigen Band aus', async () => {
        stubBandsFetch([BAND_A, BAND_B]);
        vi.mocked(listSongs).mockImplementation(async ({ bandId }) => {
            if (bandId === BAND_A.id) {
                return [SONG_A];
            }
            throw new ApiError(0, 'network', 'Keine Verbindung zum Server.');
        });

        renderWithBand(
            <MemoryRouter>
                <BandSelector />
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Song A'));
        expect(screen.getByDisplayValue('{title: Song A}')).toBeInTheDocument();

        await chooseBand('Band B');

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.queryByText('Song A')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('{title: Song A}')).not.toBeInTheDocument();
    });

    it('lädt und zeigt die persönliche Notiz des ausgewählten Songs', async () => {
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'Capo 3' });
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));

        expect(await screen.findByDisplayValue('Capo 3')).toBeInTheDocument();
        expect(getPersonalSongNote).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_A.id,
            songId: 'song-1',
        });
        expect(screen.getByRole('heading', { name: 'Meine Notiz' })).toBeInTheDocument();
    });

    it('speichert eine geänderte Notiz ohne den Songtext zu senden', async () => {
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'alt' });
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        const note = await screen.findByDisplayValue('alt');
        fireEvent.change(note, { target: { value: 'Capo 2' } });
        fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' }));

        await waitFor(() => {
            expect(savePersonalSongNote).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                songId: 'song-1',
                text: 'Capo 2',
            });
        });
        expect(savePersonalSongNote.mock.calls[0][0]).not.toHaveProperty('content');
        expect(updateSong).not.toHaveBeenCalled();
        expect(createSong).not.toHaveBeenCalled();
        expect(await screen.findByText('Notiz gespeichert.')).toBeInTheDocument();
    });

    it('lässt einen GUEST die eigene Notiz bearbeiten', async () => {
        stubBandsFetch([BAND_GUEST]);
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: '' });
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Notiz speichern' })).toBeEnabled();
        });
        const note = screen.getByRole('textbox', { name: 'Meine Notiz' });
        fireEvent.change(note, { target: { value: 'Gast-Hinweis' } });
        fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' }));

        await waitFor(() => {
            expect(savePersonalSongNote).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                songId: 'song-1',
                text: 'Gast-Hinweis',
            });
        });
        expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
        expect(updateSong).not.toHaveBeenCalled();
    });

    it('lädt beim Songwechsel die passende Notiz und zeigt die vorige nicht dazwischen', async () => {
        const secondSong = {
            ...existingSong,
            id: 'song-2',
            title: 'Second',
            content: '{title: Second}',
        };
        vi.mocked(listSongs).mockResolvedValue([existingSong, secondSong]);
        let releaseSecond;
        vi.mocked(getPersonalSongNote).mockImplementation(({ songId }) => {
            if (songId === 'song-2') {
                return new Promise((resolve) => {
                    releaseSecond = () => resolve({ text: 'Notiz Zwei' });
                });
            }
            return Promise.resolve({ text: 'Notiz Eins' });
        });

        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        expect(await screen.findByDisplayValue('Notiz Eins')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Second'));
        await waitFor(() => {
            expect(screen.queryByDisplayValue('Notiz Eins')).not.toBeInTheDocument();
            expect(getPersonalSongNote).toHaveBeenCalledWith(expect.objectContaining({ songId: 'song-2' }));
        });
        expect(screen.queryByDisplayValue('Notiz Zwei')).not.toBeInTheDocument();

        releaseSecond();
        expect(await screen.findByDisplayValue('Notiz Zwei')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Notiz Eins')).not.toBeInTheDocument();
        expect(getPersonalSongNote).toHaveBeenCalledWith(expect.objectContaining({ songId: 'song-2' }));
    });

    it('verwirft die Notiz der vorigen Band beim Bandwechsel', async () => {
        stubBandsFetch([BAND_A, BAND_B]);
        vi.mocked(listSongs).mockImplementation(async ({ bandId }) => (
            bandId === BAND_B.id ? [SONG_B] : [SONG_A]
        ));
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'Notiz von Band A' });

        renderWithBand(
            <MemoryRouter>
                <BandSelector />
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Song A'));
        expect(await screen.findByDisplayValue('Notiz von Band A')).toBeInTheDocument();

        await chooseBand('Band B');

        expect(await screen.findByText('Song B')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Notiz von Band A')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Meine Notiz' })).not.toBeInTheDocument();
    });

    it('bietet für einen noch nicht gespeicherten Song keine speicherbare Notiz', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await screen.findByText('Existing');
        fireEvent.click(screen.getByRole('button', { name: 'New' }));

        expect(screen.getByText(/sobald der Song gespeichert ist/i)).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Meine Notiz' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Notiz speichern' })).not.toBeInTheDocument();
        expect(getPersonalSongNote).not.toHaveBeenCalled();
    });

    it('zeigt einen Notiz-Ladefehler und lässt den Songtext stehen', async () => {
        vi.mocked(getPersonalSongNote).mockRejectedValue(
            new ApiError(0, 'network', 'Keine Verbindung zum Server.')
        );
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('{title: Existing}')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Notiz speichern' })).not.toBeInTheDocument();
        expect(updateSong).not.toHaveBeenCalled();
    });

    it('lässt einen Notiz-Speicherfehler den Songtext unverändert', async () => {
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'alt' });
        vi.mocked(savePersonalSongNote).mockRejectedValue(
            new ApiError(0, 'network', 'Keine Verbindung zum Server.')
        );
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        await screen.findByDisplayValue('alt');
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), {
            target: { value: 'lokaler Songtext' },
        });
        fireEvent.change(screen.getByRole('textbox', { name: 'Meine Notiz' }), {
            target: { value: 'neue Notiz' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' }));

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('lokaler Songtext')).toBeInTheDocument();
        expect(screen.getByDisplayValue('neue Notiz')).toBeInTheDocument();
        expect(updateSong).not.toHaveBeenCalled();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('sendet beim Speichern des Songs keine Notiz mit', async () => {
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'privat' });
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        await screen.findByDisplayValue('privat');
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), {
            target: { value: 'nur der Song' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenCalledWith(expect.objectContaining({
                songId: 'song-1',
                content: 'nur der Song',
                version: 0,
            }));
        });
        expect(updateSong.mock.calls[0][0]).not.toHaveProperty('text');
        expect(savePersonalSongNote).not.toHaveBeenCalled();
    });
});
