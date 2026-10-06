import 'fake-indexeddb/auto';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BandProvider } from '../../band/BandContext.jsx';
import Header from '../../components/Header.jsx';
import OfflineSnapshotRefresh from '../../snapshot/OfflineSnapshotRefresh.jsx';
import { deleteSnapshotDatabase, replaceBandSnapshot } from '../../snapshot/snapshotDb.js';
import { buildBandSnapshot } from '../../snapshot/snapshotModel.js';
import { savePersonalSongNote } from '../../api/personalSongNotesApi.js';
import NoteConflictDialog from '../NoteConflictDialog.jsx';
import PerformanceBanner from '../PerformanceBanner.jsx';
import { PerformanceModeProvider, usePerformanceMode } from '../PerformanceModeContext.jsx';
import { markPendingBlocked, markPendingConflict, stageNoteChange } from '../pendingNotes.js';
import { writeLastOfflineUserId, writePerformanceModeEnabled } from '../offlineUser.js';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: true,
    apiBaseUrl: 'http://localhost:8080',
}));

vi.mock('../../api/personalSongNotesApi.js', () => ({
    getPersonalSongNote: vi.fn(),
    savePersonalSongNote: vi.fn(),
    deletePersonalSongNote: vi.fn(),
    listPersonalSongNotes: vi.fn(),
}));

function jsonResponse(body) {
    return {
        status: 200,
        ok: true,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
        json: async () => body,
    };
}

function responseFor(url, userId) {
    if (String(url).includes('/api/me')) {
        return jsonResponse({ id: userId });
    }
    return jsonResponse([]);
}

function Shell() {
    const [open, setOpen] = useState(false);
    const mode = usePerformanceMode();
    return (
        <>
            <Header />
            <PerformanceBanner onOpenDecisions={() => setOpen(true)} />
            <NoteConflictDialog open={open} onClose={() => setOpen(false)} />
            <button type="button" onClick={() => mode.reportUnreachable()}>Verbindung prüfen</button>
            <button type="button" onClick={() => mode.dismissNotice()}>Hinweis schließen</button>
        </>
    );
}

function renderShell() {
    return render(
        <PerformanceModeProvider>
            <BandProvider>
                <MemoryRouter>
                    <Shell />
                </MemoryRouter>
            </BandProvider>
        </PerformanceModeProvider>
    );
}

describe('Performance Mode Oberfläche', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            user: { access_token: 'token', profile: { preferred_username: 'ada' } },
        });
        vi.stubGlobal('fetch', vi.fn(async (url) => responseFor(url, 'user-offline')));
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        await deleteSnapshotDatabase();
    });

    it('zeigt Konflikt und blockierte Notiz und übernimmt die lokale Fassung', async () => {
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        window.localStorage.setItem('mysongbook.activeBandId', 'band-a');
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-offline',
            band: { id: 'band-a', name: 'Probeband', role: 'OWNER' },
            songs: [{
                id: 'song-1',
                bandId: 'band-a',
                title: 'Wonderwall',
                artist: 'Oasis',
                content: '{title: Wonderwall}',
            }],
            setlists: [],
            notes: [{ songId: 'song-1', text: 'alt', version: 1 }],
            refreshedAt: '2026-10-06T17:42:00.000Z',
        }));
        const change = await stageNoteChange({
            userId: 'user-offline',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo lokal',
            snapshotNote: { text: 'alt', version: 1 },
        });
        await markPendingConflict(change, { code: 'changed', serverText: 'Capo online', serverVersion: 4 });
        const blocked = await stageNoteChange({
            userId: 'user-offline',
            bandId: 'band-a',
            songId: 'song-2',
            text: 'nur lokal',
            snapshotNote: null,
        });
        await markPendingBlocked(blocked, 'song');
        vi.mocked(savePersonalSongNote).mockResolvedValue({ text: 'Capo lokal', version: 5 });

        renderShell();

        expect(await screen.findByText(/Performance Mode · Stand heute/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('switch', { name: 'Performance Mode ausschalten' }));
        expect(await screen.findByText('2 Notizen benötigen deine Entscheidung.')).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Entscheidungen öffnen' }));
        expect(await screen.findByText('Notiz wurde an anderer Stelle geändert.')).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Meine Offline-Notiz' })).toHaveValue('Capo lokal');
        expect(screen.getByRole('textbox', { name: 'Aktuelle Online-Notiz' })).toHaveValue('Capo online');
        fireEvent.click(screen.getByRole('button', { name: 'Meine Version verwenden' }));
        expect(await screen.findByText('Die Notiz kann nicht synchronisiert werden, weil der Song nicht mehr existiert.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Text kopieren' }));
        expect(await screen.findByText('Text kopiert.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Lokale Notiz verwerfen' }));
        expect(screen.queryByRole('button', { name: 'Entscheidungen öffnen' })).not.toBeInTheDocument();
    });

    it('bleibt ohne Anmeldung im Performance Mode und startet ihn nicht ohne Snapshot', async () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            user: null,
        });
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-offline',
            band: { id: 'band-a', name: 'Probeband', role: 'MEMBER' },
            songs: [],
            setlists: [],
            notes: [],
            refreshedAt: '2026-10-01T17:42:00.000Z',
        }));

        renderShell();
        expect(await screen.findByText(/Performance Mode · Stand/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('switch', { name: 'Performance Mode ausschalten' }));
        expect(await screen.findByText(/Zum Synchronisieren bitte anmelden/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Hinweis schließen' }));
        expect(screen.queryByText(/Zum Synchronisieren bitte anmelden/)).not.toBeInTheDocument();
    });

    it('zeigt offene Notizkonflikte nach einem Neuladen auch ohne Performance Mode', async () => {
        writeLastOfflineUserId('user-offline');
        const change = await stageNoteChange({
            userId: 'user-offline',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo lokal',
            snapshotNote: { text: 'alt', version: 1 },
        });
        await markPendingConflict(change, { code: 'changed', serverText: 'Capo online', serverVersion: 4 });

        renderShell();

        expect(await screen.findByText('1 Notiz benötigt deine Entscheidung.')).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: 'Performance Mode einschalten' })).toBeInTheDocument();
    });

    it('zeigt nach einem Nutzerwechsel weder den fremden Performance Mode noch fremde Notizen', async () => {
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        const change = await stageNoteChange({
            userId: 'user-offline',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo lokal',
            snapshotNote: { text: 'alt', version: 1 },
        });
        await markPendingConflict(change, { code: 'changed', serverText: 'Capo online', serverVersion: 4 });
        vi.stubGlobal('fetch', vi.fn(async (url) => responseFor(url, 'other-user')));

        renderShell();

        expect(await screen.findByRole('switch', { name: 'Performance Mode einschalten' })).toBeInTheDocument();
        expect(screen.queryByText(/Notiz benötigt deine Entscheidung/)).not.toBeInTheDocument();
        expect(savePersonalSongNote).not.toHaveBeenCalled();
    });

    it('lädt offene Notizen nach dem Neuladen nur für den angemeldeten User', async () => {
        writeLastOfflineUserId('user-offline');
        const change = await stageNoteChange({
            userId: 'user-offline',
            bandId: 'band-a',
            songId: 'song-1',
            text: 'Capo lokal',
            snapshotNote: { text: 'alt', version: 1 },
        });
        await markPendingConflict(change, { code: 'changed', serverText: 'Capo online', serverVersion: 4 });
        vi.stubGlobal('fetch', vi.fn(async (url) => responseFor(url, 'other-user')));

        renderShell();

        await screen.findByRole('switch', { name: 'Performance Mode einschalten' });
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/me'), expect.anything());
        });
        expect(screen.queryByText(/Notiz benötigt deine Entscheidung/)).not.toBeInTheDocument();
    });

    it('aktualisiert den Snapshot nicht, solange der gespeicherte Performance Mode aktiv ist', async () => {
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        window.localStorage.setItem('mysongbook.activeBandId', 'band-a');
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-offline',
            band: { id: 'band-a', name: 'Probeband', role: 'OWNER' },
            songs: [],
            setlists: [],
            notes: [],
            refreshedAt: '2026-10-06T17:42:00.000Z',
        }));

        render(
            <PerformanceModeProvider>
                <OfflineSnapshotRefresh />
                <BandProvider>
                    <MemoryRouter>
                        <Shell />
                    </MemoryRouter>
                </BandProvider>
            </PerformanceModeProvider>
        );

        expect(await screen.findByText(/Performance Mode · Stand/)).toBeInTheDocument();
        const urls = vi.mocked(fetch).mock.calls.map((call) => String(call[0]));
        expect(urls.some((url) => url.includes('/api/bands'))).toBe(false);
    });

    it('bleibt im Performance Mode, wenn die Nutzerprüfung offline fehlschlägt', async () => {
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        window.localStorage.setItem('mysongbook.activeBandId', 'band-a');
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-offline',
            band: { id: 'band-a', name: 'Probeband', role: 'OWNER' },
            songs: [],
            setlists: [],
            notes: [],
            refreshedAt: '2026-10-06T17:42:00.000Z',
        }));
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new TypeError('Failed to fetch');
        }));

        renderShell();

        expect(await screen.findByText(/Performance Mode · Stand/)).toBeInTheDocument();
    });

    it('verlässt den Performance Mode, wenn die Anmeldung abgelehnt wird', async () => {
        writePerformanceModeEnabled(true);
        writeLastOfflineUserId('user-offline');
        await replaceBandSnapshot(buildBandSnapshot({
            userId: 'user-offline',
            band: { id: 'band-a', name: 'Probeband', role: 'OWNER' },
            songs: [],
            setlists: [],
            notes: [],
            refreshedAt: '2026-10-06T17:42:00.000Z',
        }));
        vi.stubGlobal('fetch', vi.fn(async () => ({
            status: 401,
            ok: false,
            headers: { get: () => 'application/json' },
            json: async () => ({ error: 'unauthorized' }),
        })));

        renderShell();

        expect(await screen.findByRole('switch', { name: 'Performance Mode einschalten' })).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('nennt den Grund, wenn noch kein Snapshot vorliegt', async () => {
        renderShell();
        fireEvent.click(await screen.findByRole('switch', { name: 'Performance Mode einschalten' }));
        expect(await screen.findByText(/Performance Mode nicht verfügbar/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Verbindung prüfen' }));
        expect(await screen.findByText('Server nicht erreichbar.')).toBeInTheDocument();
    });
});
