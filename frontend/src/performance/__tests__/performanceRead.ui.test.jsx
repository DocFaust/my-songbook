import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BandProvider } from '../../band/BandContext.jsx';
import EditorPage from '../../pages/EditorPage.jsx';
import SetlistPage from '../../pages/SetlistPage.jsx';
import { listSetlists } from '../../api/setlistsApi.js';
import { listSongs } from '../../api/songsApi.js';
import { savePersonalSongNote } from '../../api/personalSongNotesApi.js';
import { PerformanceModeProvider } from '../PerformanceModeContext.jsx';
import { buildBandSnapshot } from '../../snapshot/snapshotModel.js';
import { deleteSnapshotDatabase, replaceBandSnapshot } from '../../snapshot/snapshotDb.js';
import { writeLastOfflineUserId, writePerformanceModeEnabled } from '../offlineUser.js';

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

vi.mock('../../api/personalSongNotesApi.js', () => ({
    getPersonalSongNote: vi.fn(),
    savePersonalSongNote: vi.fn(),
    deletePersonalSongNote: vi.fn(),
    listPersonalSongNotes: vi.fn(),
}));

function renderMusic(ui) {
    return render(
        <PerformanceModeProvider>
            <BandProvider>
                <MemoryRouter>
                    {ui}
                </MemoryRouter>
            </BandProvider>
        </PerformanceModeProvider>
    );
}

describe('Performance Mode liest den Snapshot', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            user: null,
        });
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        window.localStorage.setItem('mysongbook.activeBandId', 'band-a');
        await deleteSnapshotDatabase();
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-offline',
            band: { id: 'band-a', name: 'Probeband', role: 'OWNER' },
            songs: [
                {
                    id: 'song-1',
                    bandId: 'band-a',
                    title: 'Wonderwall',
                    artist: 'Oasis',
                    content: '{title: Wonderwall}\n[G]Today',
                },
                {
                    id: 'song-2',
                    bandId: 'band-a',
                    title: 'Zweiter',
                    artist: '',
                    content: '{title: Zweiter}',
                },
            ],
            setlists: [{
                id: 'set-1',
                bandId: 'band-a',
                name: 'Abend',
                songIds: ['song-1', 'song-2', 'song-1'],
            }],
            notes: [{ songId: 'song-1', text: 'Capo 2', version: 3 }],
            refreshedAt: '2026-10-06T17:42:00.000Z',
        }));
    });

    it('zeigt Songs, Notiz und deaktiviertes Speichern ohne API', async () => {
        const view = renderMusic(<EditorPage />);

        fireEvent.click(await screen.findByText('Wonderwall'));
        expect(await screen.findByDisplayValue(/Today/)).toBeInTheDocument();
        expect(await screen.findByDisplayValue('Capo 2')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        expect(screen.getByRole('menuitem', { name: 'Neuer Song' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getAllByText('Im Performance Mode nicht verfügbar.').length).toBeGreaterThan(0);
        fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
        expect(listSongs).not.toHaveBeenCalled();

        fireEvent.change(screen.getByRole('textbox', { name: 'Meine Notiz' }), {
            target: { value: 'Capo 3' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Notiz speichern' }));
        expect(await screen.findByText('Lokal geändert')).toBeInTheDocument();
        expect(savePersonalSongNote).not.toHaveBeenCalled();

        view.unmount();
        renderMusic(<EditorPage />);
        fireEvent.click(await screen.findByText('Wonderwall'));
        expect(await screen.findByDisplayValue('Capo 3')).toBeInTheDocument();
    });

    it('zeigt die Setlist-Reihenfolge inklusive Duplikat', async () => {
        renderMusic(<SetlistPage />);
        fireEvent.click(await screen.findByText('Abend (3)'));
        expect(listSetlists).not.toHaveBeenCalled();
        const entries = within(screen.getByRole('list', { name: 'Setlist-Einträge' })).getAllByRole('listitem');
        expect(entries[0]).toHaveTextContent('Wonderwall');
        expect(entries[1]).toHaveTextContent('Zweiter');
        expect(entries[2]).toHaveTextContent('Wonderwall');
        expect(screen.getByRole('button', { name: 'Setlist speichern' })).toBeDisabled();
        expect(screen.getAllByText('Im Performance Mode nicht verfügbar.').length).toBeGreaterThan(0);
    });
});
