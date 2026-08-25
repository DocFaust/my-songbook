import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BandProvider } from '../BandContext.jsx';
import BandSelector from '../BandSelector.jsx';
import EditorPage from '../../pages/EditorPage.jsx';
import SetlistPage from '../../pages/SetlistPage.jsx';

const mockUseAuth = vi.fn();
const getAllSongs = vi.fn(() =>
    Promise.resolve([
        { Id: 'song-1', type: 1, title: 'Local Song', artist: 'Local Artist', content: '{title: Local Song}' },
    ])
);
const getSetlists = vi.fn(() => Promise.resolve([]));

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    apiBaseUrl: 'http://localhost:8080',
}));

vi.mock('../../db', () => ({
    getAllSongs: (...args) => getAllSongs(...args),
    getSetlists: (...args) => getSetlists(...args),
    addSongs: vi.fn(() => Promise.resolve()),
    saveSetlist: vi.fn(() => Promise.resolve()),
    deleteSetlist: vi.fn(() => Promise.resolve()),
}));

describe('Band selection and local music data', () => {
    beforeEach(() => {
        window.localStorage.clear();
        getAllSongs.mockClear();
        getSetlists.mockClear();
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            user: { access_token: 'test-token', profile: {} },
        });
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { id: 'band-1', name: 'Alpspitzbuam', role: 'OWNER' },
                    { id: 'band-2', name: 'Zweite', role: 'OWNER' },
                ]),
            })
        ));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('filtert IndexedDB-Songs nicht nach der aktiven Band', async () => {
        render(
            <MemoryRouter>
                <BandProvider>
                    <BandSelector />
                    <EditorPage />
                </BandProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Local Song')).toBeInTheDocument();
            expect(screen.getByLabelText('Aktive Band')).toHaveTextContent('Alpspitzbuam');
        });

        fireEvent.mouseDown(screen.getByLabelText('Aktive Band'));
        fireEvent.click(await screen.findByRole('option', { name: 'Zweite' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Aktive Band')).toHaveTextContent('Zweite');
        });
        expect(screen.getByText('Local Song')).toBeInTheDocument();
        expect(getAllSongs).toHaveBeenCalled();
        getAllSongs.mock.calls.forEach((args) => {
            expect(args).toHaveLength(0);
        });
    });

    it('lässt den lokalen Setlist-Workflow unverändert', async () => {
        render(
            <MemoryRouter>
                <BandProvider>
                    <BandSelector />
                    <SetlistPage />
                </BandProvider>
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByLabelText('Aktive Band')).toBeInTheDocument();
            expect(screen.getByText('Neue Setlist')).toBeInTheDocument();
        });
        expect(getSetlists).toHaveBeenCalled();
        getSetlists.mock.calls.forEach((args) => {
            expect(args).toHaveLength(0);
        });
    });
});
