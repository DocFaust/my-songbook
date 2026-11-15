import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import ImportPage from '../ImportPage.jsx';
import { createSong, updateSong } from '../../api/songsApi.js';
import { ApiError } from '../../api/apiClient.js';
import {
    BAND_A,
    BAND_GUEST,
    authenticatedAuth,
    renderWithBand,
    stubBandsFetch,
    unauthenticatedAuth,
} from '../../__tests__/helpers/musicTestUtils.jsx';

const mockUseAuth = vi.fn();
const { performanceState } = vi.hoisted(() => ({
    performanceState: {
        active: false,
        ready: true,
        userId: null,
        revision: 0,
        reportUnreachable: () => {},
    },
}));

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../performance/PerformanceModeContext.jsx', () => ({
    usePerformanceMode: () => performanceState,
}));

vi.mock('../../performance/musicRead.js', () => ({
    readPerformanceBands: vi.fn(async () => [{ id: 'band-a', name: 'Band A', role: 'OWNER' }]),
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

describe('ImportPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        performanceState.active = false;
        performanceState.ready = true;
        performanceState.userId = null;
        performanceState.revision = 0;
        performanceState.reportUnreachable = vi.fn();
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

        expect(await screen.findByRole('button', { name: 'Ultimate Guitar' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'My Song' } });
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
        expect(screen.getByLabelText('UG-Inhalt einfügen')).toHaveValue('');
    });

    it('deaktiviert Import ohne Inhalt', async () => {
        renderWithBand(<ImportPage />);
        expect(await screen.findByRole('button', { name: /Konvertieren/i })).toBeDisabled();
    });

    it('stellt ohne Anmeldung keine Import-Anfrage', () => {
        mockUseAuth.mockReturnValue(unauthenticatedAuth());
        renderWithBand(<ImportPage />);

        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('stellt ohne aktive Band keine Song-Anfrage', async () => {
        stubBandsFetch([]);
        renderWithBand(<ImportPage />);

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
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

    async function openChordProImport() {
        renderWithBand(<ImportPage />);
        fireEvent.click(await screen.findByRole('button', { name: 'ChordPro-Datei' }));
        return screen.findByLabelText('ChordPro-Datei auswählen', { hidden: true });
    }

    async function chooseChordProFile(content, name) {
        const input = await openChordProImport();
        const file = typeof content === 'string'
            ? new File([content], name, { type: 'text/plain' })
            : content;
        fireEvent.change(input, { target: { files: [file] } });
        return input;
    }

    it('bietet die unterstützten Dateiendungen an', async () => {
        const input = await openChordProImport();
        expect(input).toHaveAttribute('accept', '.cho,.chopro,.chordpro,.pro,.txt');
    });

    it('zeigt Titel, Interpret und den unveränderten ChordPro-Text', async () => {
        const content = '{title: Über den Wolken}\n{artist: Reinhard Mey}\n[C]Grüß dich\n';
        await chooseChordProFile(content, 'wolken.cho');

        expect(await screen.findByLabelText('Titel')).toHaveValue('Über den Wolken');
        expect(screen.getByLabelText('Interpret')).toHaveValue('Reinhard Mey');
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);
        expect(screen.getByText('Gewählte Datei: wolken.cho')).toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('lässt fehlende Metadaten leer und verlangt einen Titel', async () => {
        const content = '{comment: Hinweis}\n[G]Nur Text\n';
        await chooseChordProFile(content, 'ohne.pro');

        expect(await screen.findByLabelText('Titel')).toHaveValue('');
        expect(screen.getByLabelText('Interpret')).toHaveValue('');
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);
        expect(screen.getByText('Titel darf nicht leer sein.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Song anlegen' })).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: '   ' } });
        expect(screen.getByRole('button', { name: 'Song anlegen' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Song anlegen' }));
        expect(createSong).not.toHaveBeenCalled();
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);
    });

    it('legt den Song erst nach Bestätigung an und überschreibt nichts', async () => {
        const content = '{t: Frühling}\n{subtitle: Niemand}\n[Am]Grün und groß\r\n';
        await chooseChordProFile(content, 'fruehling.txt');
        expect(await screen.findByLabelText('Titel')).toHaveValue('Frühling');
        expect(createSong).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: '  Frühling  ' } });
        fireEvent.change(screen.getByLabelText('Interpret'), { target: { value: '  Die Band  ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Song anlegen' }));

        await waitFor(() => {
            expect(createSong).toHaveBeenCalledTimes(1);
        });
        expect(createSong).toHaveBeenCalledWith({
            token: 'test-token',
            bandId: BAND_A.id,
            title: 'Frühling',
            artist: 'Die Band',
            content: `{artist: Die Band}\r\n${content}`,
        });
        expect(createSong.mock.calls[0][0]).not.toHaveProperty('id');
        expect(updateSong).not.toHaveBeenCalled();
        expect(screen.getByText('Song importiert!')).toBeInTheDocument();
        expect(screen.queryByLabelText('ChordPro')).not.toBeInTheDocument();
    });

    it('bricht den Import ab, ohne einen Song anzulegen', async () => {
        const content = '{title: Bleibt}\n[C]Text';
        await chooseChordProFile(content, 'bleibt.chopro');
        expect(await screen.findByLabelText('ChordPro')).toHaveValue(content);

        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

        expect(screen.queryByLabelText('ChordPro')).not.toBeInTheDocument();
        expect(screen.queryByText('Gewählte Datei: bleibt.chopro')).not.toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('behält den Text bei einer leeren oder unlesbaren Datei', async () => {
        const content = '{title: Bleibt}\n[C]Text';
        const input = await chooseChordProFile(content, 'bleibt.chordpro');
        expect(await screen.findByLabelText('ChordPro')).toHaveValue(content);

        fireEvent.change(input, { target: { files: [new File([' \n'], 'leer.cho')] } });
        expect(await screen.findByText('Die Datei ist leer.')).toBeInTheDocument();
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);

        const broken = new File(['{title: Neu}'], 'kaputt.cho');
        Object.defineProperty(broken, 'text', { value: () => Promise.reject(new Error('lesen')) });
        fireEvent.change(input, { target: { files: [broken] } });
        expect(await screen.findByText('Die Datei konnte nicht gelesen werden.')).toBeInTheDocument();
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);
        expect(screen.getByLabelText('Titel')).toHaveValue('Bleibt');
        expect(createSong).not.toHaveBeenCalled();
    });

    it('behält den Text, wenn das Anlegen fehlschlägt', async () => {
        const content = '{title: Bleibt}\n[C]Äöüß';
        await chooseChordProFile(content, 'bleibt.cho');
        expect(await screen.findByLabelText('Titel')).toHaveValue('Bleibt');

        vi.mocked(createSong).mockRejectedValueOnce(new ApiError(403, 'forbidden', 'insufficient role'));
        fireEvent.click(screen.getByRole('button', { name: 'Song anlegen' }));
        expect(await screen.findByText(/nicht erlaubt/i)).toBeInTheDocument();
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);

        vi.mocked(createSong).mockRejectedValueOnce(new TypeError('Failed to fetch'));
        fireEvent.click(screen.getByRole('button', { name: 'Song anlegen' }));
        expect(await screen.findByText('Die Anfrage ist fehlgeschlagen.')).toBeInTheDocument();
        expect(screen.getByLabelText('ChordPro')).toHaveValue(content);
        expect(performanceState.reportUnreachable).toHaveBeenCalled();
        expect(updateSong).not.toHaveBeenCalled();
    });

    it('sperrt den ChordPro-Import für GUEST', async () => {
        stubBandsFetch([BAND_GUEST]);
        const input = await openChordProImport();
        expect(input).toBeDisabled();
        expect(screen.getByText('Mit deiner Rolle kannst du keine Songs anlegen.')).toBeInTheDocument();

        fireEvent.change(input, {
            target: { files: [new File(['{title: Geheim}\n[C]Text'], 'geheim.cho')] },
        });
        expect(screen.queryByLabelText('ChordPro')).not.toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });

    it('sperrt den ChordPro-Import im Performance Mode', async () => {
        performanceState.active = true;
        performanceState.userId = 'user-1';
        const input = await openChordProImport();

        expect(await screen.findByText('Im Performance Mode nicht verfügbar.')).toBeInTheDocument();
        expect(input).toBeDisabled();
        fireEvent.change(input, {
            target: { files: [new File(['{title: Offline}\n[C]Text'], 'offline.cho')] },
        });
        expect(screen.queryByLabelText('ChordPro')).not.toBeInTheDocument();
        expect(createSong).not.toHaveBeenCalled();
    });
});
