import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ImportPage from '../ImportPage.jsx';
import { createSong } from '../../api/songsApi.js';
import { ApiError } from '../../api/apiClient.js';
import * as db from '../../db';
import {
    BAND_A,
    BAND_GUEST,
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
    createSong: vi.fn(),
    listSongs: vi.fn(),
    getSong: vi.fn(),
    updateSong: vi.fn(),
}));

vi.mock('../../db', () => ({
    addSongs: vi.fn(),
    getAllSongs: vi.fn(),
    getSetlists: vi.fn(),
    saveSetlist: vi.fn(),
    deleteSetlist: vi.fn(),
}));

describe('ImportPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);
        vi.mocked(createSong).mockResolvedValue({
            id: 'created-1',
            bandId: BAND_A.id,
            title: 'My Song',
            artist: 'Band',
            content: '{title: My Song}',
            version: 0,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('POSTet konvertierten ChordPro-Text an die aktive Band', async () => {
        renderWithBand(<ImportPage />);

        fireEvent.change(await screen.findByLabelText('Titel'), { target: { value: 'My Song' } });
        fireEvent.change(screen.getByLabelText('Artist'), { target: { value: 'Band' } });
        fireEvent.change(screen.getByLabelText('UG-Inhalt einfügen'), {
            target: { value: 'C G\nHello world' },
        });

        fireEvent.click(screen.getByRole('button', { name: /Konvertieren/i }));

        await waitFor(() => {
            expect(createSong).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                title: 'My Song',
                artist: 'Band',
                content: expect.stringContaining('{title: My Song}'),
            });
        });
        expect(createSong.mock.calls[0][0]).not.toHaveProperty('id');
        expect(createSong.mock.calls[0][0]).not.toHaveProperty('Id');
        expect(screen.getByText('Song importiert!')).toBeInTheDocument();
        expect(db.addSongs).not.toHaveBeenCalled();
        expect(screen.getByLabelText('UG-Inhalt einfügen')).toHaveValue('');
    });

    it('deaktiviert Import ohne Inhalt', async () => {
        renderWithBand(<ImportPage />);
        expect(await screen.findByRole('button', { name: /Konvertieren/i })).toBeDisabled();
    });

    it('fällt ohne Anmeldung nicht auf IndexedDB zurück', () => {
        mockUseAuth.mockReturnValue(unauthenticatedAuth());
        renderWithBand(<ImportPage />);

        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
        expect(db.addSongs).not.toHaveBeenCalled();
    });

    it('stellt ohne aktive Band keine Song-Anfrage', async () => {
        stubBandsFetch([]);
        renderWithBand(<ImportPage />);

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
        expect(db.addSongs).not.toHaveBeenCalled();
    });

    it('zeigt bei 403 eine verständliche Meldung und speichert nicht', async () => {
        vi.mocked(createSong).mockRejectedValue(
            new ApiError(403, 'forbidden', 'insufficient role')
        );
        renderWithBand(<ImportPage />);

        fireEvent.change(await screen.findByLabelText('UG-Inhalt einfügen'), {
            target: { value: 'C G\nHello world' },
        });
        fireEvent.click(screen.getByRole('button', { name: /Konvertieren/i }));

        expect(await screen.findByText(/nicht erlaubt/i)).toBeInTheDocument();
        expect(screen.queryByText('Song importiert!')).not.toBeInTheDocument();
        expect(screen.getByLabelText('UG-Inhalt einfügen')).toHaveValue('C G\nHello world');
        expect(db.addSongs).not.toHaveBeenCalled();
    });

    it('verhindert Import für GUEST in der UI', async () => {
        stubBandsFetch([BAND_GUEST]);
        renderWithBand(<ImportPage />);

        fireEvent.change(await screen.findByLabelText('UG-Inhalt einfügen'), {
            target: { value: 'C G\nHello' },
        });
        expect(screen.getByRole('button', { name: /Konvertieren/i })).toBeDisabled();
        expect(createSong).not.toHaveBeenCalled();
    });
});
