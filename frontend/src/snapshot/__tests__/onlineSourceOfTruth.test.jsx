import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorPage from '../../pages/EditorPage.jsx';
import SetlistPage from '../../pages/SetlistPage.jsx';
import { listSetlists } from '../../api/setlistsApi.js';
import { listSongs } from '../../api/songsApi.js';
import { ApiError } from '../../api/apiClient.js';
import { renderWithBand, stubBandsFetch, authenticatedAuth } from '../../__tests__/helpers/musicTestUtils.jsx';
import { buildBandSnapshot } from '../snapshotModel.js';
import { deleteSnapshotDatabase, readBandSnapshot, replaceBandSnapshot } from '../snapshotDb.js';
import OfflineSnapshotRefresh from '../OfflineSnapshotRefresh.jsx';

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

const cachedTitle = 'Nur im Snapshot';

describe('Online-UI bleibt bei der API', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([{ id: 'band-a', name: 'Band A', role: 'OWNER' }]);
        await deleteSnapshotDatabase();
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-1',
            band: { id: 'band-a', name: 'Band A' },
            songs: [{
                id: 'song-cached',
                bandId: 'band-a',
                title: cachedTitle,
                artist: 'Cache',
                content: '{title: Cache}',
            }],
            setlists: [{
                id: 'set-cached',
                bandId: 'band-a',
                name: 'Cache-Set',
                songIds: ['song-cached', 'song-cached'],
            }],
            notes: [{ songId: 'song-cached', text: 'private Cache-Notiz', version: 2 }],
            refreshedAt: '2026-10-02T12:00:00.000Z',
        }));
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        window.localStorage.clear();
        await deleteSnapshotDatabase();
    });

    it('zeigt bei einem API-Fehler den Snapshot nicht im Editor', async () => {
        vi.mocked(listSongs).mockRejectedValue(new ApiError(0, 'network', 'Keine Verbindung zum Server.'));
        const open = vi.spyOn(indexedDB, 'open');

        renderWithBand(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.queryByText(cachedTitle)).not.toBeInTheDocument();
        expect(screen.queryByText('private Cache-Notiz')).not.toBeInTheDocument();
        expect(open).not.toHaveBeenCalled();
        expect((await readBandSnapshot('user-1', 'band-a')).songs[0].title).toBe(cachedTitle);
    });

    it('zeigt bei einem API-Fehler den Snapshot nicht in der Setlist', async () => {
        vi.mocked(listSongs).mockRejectedValue(new ApiError(0, 'network', 'Keine Verbindung zum Server.'));
        vi.mocked(listSetlists).mockRejectedValue(new ApiError(0, 'network', 'Keine Verbindung zum Server.'));
        const open = vi.spyOn(indexedDB, 'open');

        renderWithBand(
            <MemoryRouter>
                <SetlistPage />
            </MemoryRouter>
        );

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.queryByText('Cache-Set')).not.toBeInTheDocument();
        expect(open).not.toHaveBeenCalled();
    });

    it('löscht den Snapshot beim Abmelden nicht', async () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            user: { access_token: 'tok', profile: { sub: 'kc-a' } },
        });
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const view = render(<OfflineSnapshotRefresh />);
        await waitFor(() => {
            expect(console.error).toHaveBeenCalled();
        });
        expect((await readBandSnapshot('user-1', 'band-a')).band.name).toBe('Band A');

        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            user: null,
        });
        view.rerender(<OfflineSnapshotRefresh />);
        expect((await readBandSnapshot('user-1', 'band-a')).notes[0].text).toBe('private Cache-Notiz');
    });
});
