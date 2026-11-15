import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditorPage from '../EditorPage.jsx';
import BandSelector from '../../band/BandSelector.jsx';
import RepertoireFrame from '../../components/RepertoireFrame.jsx';
import { SongLeaveGuardProvider } from '../../components/songLeaveGuard.jsx';
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

function openNotes() {
    fireEvent.click(screen.getByRole('button', { name: 'Meine Notizen' }));
}

function startEditing() {
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
}

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
        vi.mocked(createSong).mockImplementation(async ({ title, artist, content }) => ({
            id: 'new-song',
            bandId: BAND_A.id,
            title,
            artist,
            content,
            version: 0,
        }));
        vi.mocked(updateSong).mockImplementation(async ({ title, artist, content, version }) => ({
            ...existingSong,
            title,
            artist,
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
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Existing' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeEnabled();
    });

    it('erzeugt einen Song über die API statt als lokales Fake-Objekt', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await screen.findByText('Existing');
        expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Neuer Song' }));
        expect(screen.getByRole('textbox', { name: 'Songtext' })).toHaveValue('');
        expect(createSong).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: '{title: New}' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
        expect(await screen.findByText('Titel darf nicht leer sein.')).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: '  Eigener Titel  ' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Interpret' }), { target: { value: '  Neue Band  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(createSong).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                title: 'Eigener Titel',
                artist: 'Neue Band',
                content: '{title: New}',
            });
        });
        expect(createSong.mock.calls[0][0]).not.toHaveProperty('id');
        expect(await screen.findByRole('heading', { level: 3, name: 'Eigener Titel' })).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        });
        const songs = screen.getByRole('list', { name: 'Songs' });
        expect(songs).toHaveTextContent('Eigener Titel');
        expect(songs).toHaveTextContent('Neue Band');
    });

    it('filtert die Songliste und öffnet den Treffer', async () => {
        const secondSong = {
            ...existingSong,
            id: 'song-2',
            title: 'Zweiter',
            artist: 'Andere Band',
            content: '{title: Zweiter}',
        };
        vi.mocked(listSongs).mockResolvedValue([existingSong, secondSong]);
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Existing')).toBeInTheDocument();
        expect(screen.getByText('Zweiter')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Song suchen'), { target: { value: 'andere' } });
        expect(screen.queryByText('Existing')).not.toBeInTheDocument();
        fireEvent.click(screen.getByText('Zweiter'));
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Zweiter' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Zweiter/ })).toHaveAttribute('aria-selected', 'true');

        fireEvent.change(screen.getByLabelText('Song suchen'), { target: { value: 'kein-treffer' } });
        expect(screen.getByText('Keine Songs passen zur Suche.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Zweiter' })).toBeInTheDocument();
    });

    it('zeigt bei leerer Band einen Hinweis und kein New', async () => {
        vi.mocked(listSongs).mockResolvedValue([]);
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Noch keine Songs im Repertoire.')).toBeInTheDocument();
        expect(screen.getByText(/importiere einen bestehenden ChordPro-Song/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '+ Song' })).toBeInTheDocument();
    });

    it('öffnet den Import aus + Song', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await screen.findByText('Existing');
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).toHaveAttribute('href', '/import');
        expect(screen.getByRole('menuitem', { name: 'Neuer Song' })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('sperrt Anlegen und Import für GUEST', async () => {
        stubBandsFetch([BAND_GUEST]);
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await screen.findByText('Existing');
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        expect(screen.getByRole('menuitem', { name: 'Neuer Song' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    });

    it('öffnet denselben Entwurf, wenn die Route einen neuen Song übergibt', async () => {
        renderWithBand(
            <MemoryRouter initialEntries={[{ pathname: '/editor', state: { createSong: true } }]}>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Existing')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Songtext' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'Interpret' })).toHaveValue('');
        expect(screen.queryByRole('heading', { level: 3, name: 'Neuer Song' })).not.toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('aktualisiert mit der aktuellen Version und speichert die neue Server-Version', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        startEditing();
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'edited once' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenCalledWith(expect.objectContaining({
                songId: 'song-1',
                title: 'Existing',
                artist: 'Band',
                content: 'edited once',
                version: 0,
            }));
        });

        await waitFor(() => {
            expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        });
        startEditing();
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
        startEditing();
        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: 'Lokaler Titel' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'local edit' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        expect(await screen.findByText(/zwischenzeitlich geändert/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('local edit')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Lokaler Titel');
        expect(screen.queryByText('Song gespeichert!')).not.toBeInTheDocument();
        expect(getSong).not.toHaveBeenCalled();

        vi.mocked(getSong).mockResolvedValue({
            ...existingSong,
            title: 'Server Titel',
            artist: 'Server Interpret',
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
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Server Titel');
        expect(screen.getByRole('textbox', { name: 'Interpret' })).toHaveValue('Server Interpret');
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
        fireEvent.change(screen.getByLabelText('Song suchen'), { target: { value: 'Artist A' } });
        fireEvent.click(screen.getByText('Song A'));
        startEditing();
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'ungespeichert' } });
        expect(screen.getByDisplayValue('ungespeichert')).toBeInTheDocument();

        await chooseBand('Band B');

        expect(await screen.findByText('Song B')).toBeInTheDocument();
        expect(screen.getByLabelText('Song suchen')).toHaveValue('');
        expect(screen.queryByText('Song A')).not.toBeInTheDocument();
        expect(screen.queryByDisplayValue('ungespeichert')).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
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
        expect(screen.queryByRole('button', { name: '+ Song' })).not.toBeInTheDocument();
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
        expect(screen.getByRole('heading', { level: 3, name: 'Song A' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();

        await chooseBand('Band B');

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.queryByText('Song A')).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 3, name: 'Song A' })).not.toBeInTheDocument();
    });

    it('lädt und zeigt die persönliche Notiz des ausgewählten Songs', async () => {
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'Capo 3' });
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        expect(screen.queryByRole('textbox', { name: 'Meine Notiz' })).not.toBeInTheDocument();
        openNotes();

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
        openNotes();
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
        expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeDisabled();
        expect(screen.getByText(/nur lesen/i)).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Titel' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Interpret' })).not.toBeInTheDocument();
        openNotes();
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
        expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();
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
        openNotes();
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
        openNotes();
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
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Neuer Song' }));
        openNotes();

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
        expect(screen.getByRole('heading', { level: 3, name: 'Existing' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        openNotes();

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Existing' })).toBeInTheDocument();
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
        startEditing();
        openNotes();
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
        openNotes();
        await screen.findByDisplayValue('privat');
        startEditing();
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

    it('rendert ChordPro und wechselt den Song in der Leseansicht', async () => {
        const secondSong = {
            ...existingSong,
            id: 'song-2',
            title: 'Zweiter',
            artist: 'Andere Band',
            content: '{title: Zweiter}\n[G]Hello',
        };
        vi.mocked(listSongs).mockResolvedValue([existingSong, secondSong]);
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        expect(screen.getByRole('article', { name: 'Songblatt' })).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Zweiter'));
        expect(screen.getByRole('heading', { level: 3, name: 'Zweiter' })).toBeInTheDocument();
        expect(screen.getAllByText('Andere Band').length).toBeGreaterThan(0);
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('G')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
    });

    it('verwirft ungespeicherte Änderungen beim Abbrechen und beim Songwechsel', async () => {
        const secondSong = {
            ...existingSong,
            id: 'song-2',
            title: 'Zweiter',
            content: '{title: Zweiter}\nRefrain',
        };
        vi.mocked(listSongs).mockResolvedValue([existingSong, secondSong]);
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        startEditing();
        expect(screen.getByRole('textbox', { name: 'Songtext' })).toHaveValue('{title: Existing}');
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'geändert' } });
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Existing' })).toBeInTheDocument();
        expect(updateSong).not.toHaveBeenCalled();

        startEditing();
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'noch offen' } });
        fireEvent.click(screen.getByText('Zweiter'));
        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Weiter bearbeiten' }));
        expect(screen.getByDisplayValue('noch offen')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 3, name: 'Zweiter' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Zweiter'));
        fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.getByRole('heading', { level: 3, name: 'Zweiter' })).toBeInTheDocument();
        expect(screen.getByText('Refrain')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('noch offen')).not.toBeInTheDocument();
        expect(updateSong).not.toHaveBeenCalled();
    });

    it('öffnet einen neuen Song im Editor und legt beim Abbrechen nichts an', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await screen.findByText('Existing');
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Neuer Song' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'Entwurf' } });
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

        expect(createSong).not.toHaveBeenCalled();
        expect(screen.queryByRole('textbox', { name: 'Songtext' })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { level: 3, name: 'Neuer Song' })).not.toBeInTheDocument();
    });

    it('zeigt auf schmalen Fenstern den Song vor der Liste', async () => {
        const original = window.matchMedia;
        window.matchMedia = (query) => ({
            matches: String(query).includes('max-width'),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        });
        try {
            renderWithBand(
                <MemoryRouter>
                    <EditorPage />
                </MemoryRouter>
            );

            fireEvent.click(await screen.findByText('Existing'));
            expect(screen.getByRole('heading', { level: 3, name: 'Existing' })).toBeInTheDocument();
            expect(screen.queryByLabelText('Song suchen')).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole('button', { name: 'Songliste' }));
            expect(screen.getByLabelText('Song suchen')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Songliste schließen' })).toBeInTheDocument();
        } finally {
            window.matchMedia = original;
        }
    });

    it('fragt vor einem neuen Song, wenn der aktuelle Text ungespeichert ist', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        startEditing();
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'offen' } });
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Neuer Song' }));

        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.getByRole('textbox', { name: 'Songtext' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('');
        expect(screen.getByRole('textbox', { name: 'Interpret' })).toHaveValue('');
        expect(createSong).not.toHaveBeenCalled();
        expect(updateSong).not.toHaveBeenCalled();
    });

    it('benennt einen Song um und aktualisiert Liste und Leseansicht', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        startEditing();
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Existing');
        expect(screen.getByRole('textbox', { name: 'Interpret' })).toHaveValue('Band');
        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: 'Umbenannt' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Interpret' }), { target: { value: 'Neuer Interpret' } });
        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(updateSong).toHaveBeenCalledWith(expect.objectContaining({
                songId: 'song-1',
                title: 'Umbenannt',
                artist: 'Neuer Interpret',
                content: '{title: Existing}',
                version: 0,
            }));
        });
        expect(await screen.findByRole('heading', { level: 3, name: 'Umbenannt' })).toBeInTheDocument();
        const songs = screen.getByRole('list', { name: 'Songs' });
        expect(songs).toHaveTextContent('Umbenannt');
        expect(songs).toHaveTextContent('Neuer Interpret');
        expect(songs).not.toHaveTextContent('Existing');
        expect(screen.getByRole('article', { name: 'Songblatt' })).toHaveTextContent('Neuer Interpret');
        expect(screen.queryByRole('textbox', { name: 'Titel' })).not.toBeInTheDocument();
    });

    it('stellt Titel und Interpret beim Abbrechen wieder her', async () => {
        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Existing'));
        startEditing();
        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: 'Anders' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Interpret' }), { target: { value: 'Jemand' } });
        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

        expect(screen.getByRole('heading', { level: 3, name: 'Existing' })).toBeInTheDocument();
        expect(screen.getByRole('article', { name: 'Songblatt' })).toHaveTextContent('Band');
        expect(screen.queryByRole('textbox', { name: 'Titel' })).not.toBeInTheDocument();
        expect(updateSong).not.toHaveBeenCalled();

        startEditing();
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Existing');
        expect(screen.getByRole('textbox', { name: 'Interpret' })).toHaveValue('Band');
    });
});

function LeaveHarness() {
    return (
        <SongLeaveGuardProvider>
            <MemoryRouter initialEntries={['/repertoire']}>
                <BandSelector />
                <RepertoireFrame />
                <Routes>
                    <Route path="/repertoire" element={<EditorPage />} />
                    <Route path="/setlist" element={<h2>Setlist-Seite</h2>} />
                    <Route path="/import" element={<h2>Import-Seite</h2>} />
                    <Route path="/band" element={<h2>Band-Seite</h2>} />
                </Routes>
            </MemoryRouter>
        </SongLeaveGuardProvider>
    );
}

async function editExistingSong(value) {
    fireEvent.click(await screen.findByText('Existing'));
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
    if (value !== undefined) {
        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value } });
    }
}

function openImport() {
    fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Song importieren' }));
}

async function chooseDialog(name) {
    fireEvent.click(screen.getByRole('button', { name }));
    await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
}

describe('ungespeicherter Songtext beim Verlassen', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A, BAND_B]);
        vi.mocked(listSongs).mockImplementation(async ({ bandId }) => (
            bandId === BAND_B.id ? [SONG_B] : [existingSong]
        ));
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: '' });
        vi.mocked(savePersonalSongNote).mockImplementation(async ({ text }) => ({ text }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('bleibt beim Bearbeiten, wenn Setlists abgebrochen wird', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));

        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        await chooseDialog('Weiter bearbeiten');

        expect(screen.getByDisplayValue('geändert')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Setlist-Seite' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'true');
    });

    it('öffnet Setlists, wenn die Änderungen verworfen werden', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
        fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));

        expect(await screen.findByRole('heading', { name: 'Setlist-Seite' })).toBeInTheDocument();
        expect(screen.queryByDisplayValue('geändert')).not.toBeInTheDocument();
        expect(updateSong).not.toHaveBeenCalled();
    });

    it('bleibt beim Bearbeiten, wenn der Import abgebrochen wird', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        openImport();

        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        await chooseDialog('Weiter bearbeiten');

        expect(screen.getByDisplayValue('geändert')).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Import-Seite' })).not.toBeInTheDocument();
    });

    it('öffnet den Import, wenn die Änderungen verworfen werden', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        openImport();
        fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));

        expect(await screen.findByRole('heading', { name: 'Import-Seite' })).toBeInTheDocument();
        expect(screen.queryByDisplayValue('geändert')).not.toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('behält Band und Text, wenn der Bandwechsel abgebrochen wird', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        await chooseBand('Band B');

        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        await chooseDialog('Weiter bearbeiten');

        expect(screen.getByRole('button', { name: 'Aktive Band: Band A' })).toBeInTheDocument();
        expect(screen.getByDisplayValue('geändert')).toBeInTheDocument();
        expect(screen.queryByText('Song B')).not.toBeInTheDocument();
        expect(listSongs).not.toHaveBeenCalledWith(expect.objectContaining({ bandId: BAND_B.id }));
    });

    it('wechselt die Band und leert den Entwurf, wenn verworfen wird', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        await chooseBand('Band B');
        fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));

        expect(await screen.findByText('Song B')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Aktive Band: Band B' })).toBeInTheDocument();
        expect(screen.queryByDisplayValue('geändert')).not.toBeInTheDocument();
        expect(listSongs).toHaveBeenCalledWith(expect.objectContaining({ bandId: BAND_B.id }));
    });

    it('bleibt auf Songs, wenn der Tab bei offenem Text erneut gewählt wird', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong('geändert');
        fireEvent.click(screen.getByRole('tab', { name: 'Songs' }));

        expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('geändert')).toBeInTheDocument();
    });

    it('fragt nach, wenn nur Titel oder Interpret geändert wurde', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong();
        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: 'Nur Titel' } });
        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));

        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        await chooseDialog('Weiter bearbeiten');
        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Nur Titel');
        expect(screen.getByRole('textbox', { name: 'Songtext' })).toHaveValue('{title: Existing}');

        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: 'Existing' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Interpret' }), { target: { value: 'Nur Interpret' } });
        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));

        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        await chooseDialog('Weiter bearbeiten');
        expect(screen.getByRole('textbox', { name: 'Interpret' })).toHaveValue('Nur Interpret');
        expect(screen.queryByRole('heading', { name: 'Setlist-Seite' })).not.toBeInTheDocument();
    });

    it('navigiert ohne Dialog, wenn der Songtext unverändert ist', async () => {
        renderWithBand(<LeaveHarness />);

        await editExistingSong();
        expect(screen.getByRole('textbox', { name: 'Songtext' })).toHaveValue('{title: Existing}');
        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));

        expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).not.toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Setlist-Seite' })).toBeInTheDocument();
    });

    it('fragt beim Songwechsel weiterhin nach und lässt eine Notiz den Wechsel nicht sperren', async () => {
        const secondSong = {
            ...existingSong,
            id: 'song-2',
            title: 'Zweiter',
            content: '{title: Zweiter}',
        };
        vi.mocked(listSongs).mockResolvedValue([existingSong, secondSong]);
        renderWithBand(<LeaveHarness />);

        await editExistingSong('offen');
        fireEvent.click(screen.getByText('Zweiter'));
        expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
        await chooseDialog('Weiter bearbeiten');
        expect(screen.getByDisplayValue('offen')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
        openNotes();
        fireEvent.change(await screen.findByRole('textbox', { name: 'Meine Notiz' }), {
            target: { value: 'nur die Notiz' },
        });
        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));

        expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).not.toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'Setlist-Seite' })).toBeInTheDocument();
        expect(savePersonalSongNote).not.toHaveBeenCalled();
        expect(updateSong).not.toHaveBeenCalled();
    });
});
