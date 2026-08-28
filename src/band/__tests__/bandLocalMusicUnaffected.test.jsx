import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BandProvider } from '../BandContext.jsx';
import BandSelector from '../BandSelector.jsx';
import EditorPage from '../../pages/EditorPage.jsx';
import SetlistPage from '../../pages/SetlistPage.jsx';
import { listSongs } from '../../api/songsApi.js';
import { listSetlists } from '../../api/setlistsApi.js';
import * as db from '../../db';
import {
    BAND_A,
    BAND_B,
    SONG_A,
    SONG_B,
    authenticatedAuth,
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
    getAllSongs: vi.fn(),
    getSetlists: vi.fn(),
    addSongs: vi.fn(),
    saveSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
}));

describe('Band selection and server-backed music data', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve([BAND_A, BAND_B]),
            })
        ));
        vi.mocked(listSongs).mockImplementation(async ({ bandId }) => {
            if (bandId === BAND_A.id) {
                return [SONG_A];
            }
            if (bandId === BAND_B.id) {
                return [SONG_B];
            }
            return [];
        });
        vi.mocked(listSetlists).mockImplementation(async ({ bandId }) => {
            if (bandId === BAND_A.id) {
                return [{ id: 'sl-a', bandId: BAND_A.id, name: 'Set A', songIds: [SONG_A.id], version: 0 }];
            }
            return [];
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('lädt nach Bandwechsel die Songs der neuen Band und zeigt die alten nicht mehr', async () => {
        render(
            <MemoryRouter>
                <BandProvider>
                    <BandSelector />
                    <EditorPage />
                </BandProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Song A')).toBeInTheDocument();
            expect(screen.getByLabelText('Aktive Band')).toHaveTextContent('Band A');
        });

        fireEvent.mouseDown(screen.getByLabelText('Aktive Band'));
        fireEvent.click(await screen.findByRole('option', { name: 'Band B' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Aktive Band')).toHaveTextContent('Band B');
            expect(screen.getByText('Song B')).toBeInTheDocument();
        });
        expect(screen.queryByText('Song A')).not.toBeInTheDocument();
        expect(listSongs).toHaveBeenCalledWith({ token: 'test-token', bandId: BAND_B.id });
        expect(db.getAllSongs).not.toHaveBeenCalled();
    });

    it('lädt Setlists der aktiven Band und nicht IndexedDB', async () => {
        render(
            <MemoryRouter>
                <BandProvider>
                    <BandSelector />
                    <SetlistPage />
                </BandProvider>
            </MemoryRouter>
        );

        expect(await screen.findByText('Set A (1)')).toBeInTheDocument();
        expect(listSetlists).toHaveBeenCalledWith({ token: 'test-token', bandId: BAND_A.id });
        expect(db.getSetlists).not.toHaveBeenCalled();
    });
});
