import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BandPage from '../BandPage.jsx';
import Header from '../../components/Header.jsx';
import { ApiError } from '../../api/apiClient.js';
import { createInvitation, listInvitations, revokeInvitation } from '../../api/invitationsApi.js';
import { leaveBand, listMembers, removeMember, transferOwnership, updateMemberRole } from '../../api/membershipsApi.js';
import {
    BAND_A,
    BAND_GUEST,
    authenticatedAuth,
    renderWithBand,
    stubBandsFetch,
} from '../../__tests__/helpers/musicTestUtils.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: true,
    apiBaseUrl: 'http://localhost:8080',
}));

vi.mock('../../api/invitationsApi.js', () => ({
    createInvitation: vi.fn(),
    listInvitations: vi.fn(),
    revokeInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
}));

vi.mock('../../api/membershipsApi.js', () => ({
    listMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    transferOwnership: vi.fn(),
    leaveBand: vi.fn(),
}));

const owner = { userId: 'user-owner', displayName: 'user-owner', role: 'OWNER' };
const guest = { userId: 'user-guest', displayName: 'user-guest', role: 'GUEST' };

describe('BandPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);
        vi.mocked(listMembers).mockResolvedValue([owner, guest]);
        vi.mocked(listInvitations).mockResolvedValue([
            {
                id: 'inv-1',
                createdAt: '2026-08-01T10:00:00Z',
                expiresAt: '2026-08-15T10:00:00Z',
                status: 'ACTIVE',
            },
        ]);
        vi.mocked(createInvitation).mockResolvedValue({
            id: 'inv-new',
            bandId: BAND_A.id,
            token: 'raw',
            expiresAt: '2026-09-12T10:00:00Z',
            inviteUrl: 'http://localhost:5173/invite/raw',
        });
        vi.mocked(updateMemberRole).mockResolvedValue({ ...guest, role: 'MEMBER' });
        vi.mocked(removeMember).mockResolvedValue(null);
        vi.mocked(revokeInvitation).mockResolvedValue(null);
        vi.mocked(transferOwnership).mockResolvedValue({
            newOwner: { ...guest, role: 'OWNER' },
            previousOwner: { ...owner, role: 'ADMIN' },
        });
        vi.mocked(leaveBand).mockResolvedValue(null);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('zeigt Mitglieder und lässt OWNER Rollen ändern, entfernen und einladen', async () => {
        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('OWNER')).toBeInTheDocument();
        expect(screen.getByLabelText('Rolle von user-gue')).toBeInTheDocument();
        expect(screen.queryByLabelText('Rolle von user-own')).not.toBeInTheDocument();

        fireEvent.mouseDown(screen.getByLabelText('Rolle von user-gue'));
        fireEvent.click(screen.getByRole('option', { name: 'MEMBER' }));
        await waitFor(() => {
            expect(updateMemberRole).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                userId: 'user-guest',
                role: 'MEMBER',
            });
        });

        fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
        await waitFor(() => {
            expect(removeMember).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                userId: 'user-guest',
            });
        });

        fireEvent.click(screen.getByRole('button', { name: 'Einladungslink erzeugen' }));
        expect(await screen.findByDisplayValue('http://localhost:5173/invite/raw')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:5173/invite/raw');
        });
        fireEvent.click(screen.getByRole('button', { name: 'Zurückziehen' }));
        await waitFor(() => {
            expect(revokeInvitation).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                invitationId: 'inv-1',
            });
        });
    });

    it('zeigt GUEST keine Verwaltungssteuerung', async () => {
        stubBandsFetch([BAND_GUEST]);
        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('OWNER')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Einladungslink erzeugen' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Entfernen' })).not.toBeInTheDocument();
        expect(listInvitations).not.toHaveBeenCalled();
    });

    it('zeigt Du für das eigene Konto und kopiert den Link nicht still bei Clipboard-Fehlern', async () => {
        stubBandsFetch([BAND_A]);
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (String(url).endsWith('/api/me')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'user-owner' }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([BAND_A]),
            });
        }));
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-guest', displayName: 'Gastmusiker', role: 'GUEST' },
        ]);
        navigator.clipboard.writeText.mockRejectedValue(new Error('denied'));

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Du')).toBeInTheDocument();
        expect(screen.getByText('Gastmusiker')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Einladungslink erzeugen' }));
        expect(await screen.findByDisplayValue('http://localhost:5173/invite/raw')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
        expect(await screen.findByText(/Kopieren nicht möglich/i)).toBeInTheDocument();
    });

    it('zeigt dem OWNER die Übertragung und nicht das Verlassen', async () => {
        stubCurrentUser('user-owner', [BAND_A]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-guest', displayName: 'Gastmusiker', role: 'GUEST' },
            { userId: 'user-member', displayName: 'Mitglied', role: 'MEMBER' },
            { userId: 'user-admin', displayName: 'Admin', role: 'ADMIN' },
        ]);

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Du')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Ownership übertragen' })).toBeDisabled();
        expect(screen.queryByRole('button', { name: 'Band verlassen' })).not.toBeInTheDocument();
        expect(screen.getByText(/Übertrage zuerst die Eigentümerschaft/)).toBeInTheDocument();

        fireEvent.mouseDown(screen.getByLabelText('Mitglied für die Eigentümerschaft'));
        expect(screen.queryByRole('option', { name: /Alex/ })).not.toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Gastmusiker (GUEST)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Mitglied (MEMBER)' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Admin (ADMIN)' })).toBeInTheDocument();
    });

    it('bestätigt die Übertragung und zeigt danach die neue Rolle', async () => {
        const session = stubCurrentUser('user-owner', [BAND_A]);
        vi.mocked(listMembers)
            .mockResolvedValueOnce([
                { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
                { userId: 'user-guest', displayName: 'Gastmusiker', role: 'GUEST' },
            ])
            .mockResolvedValue([
                { userId: 'user-owner', displayName: 'Alex', role: 'ADMIN' },
                { userId: 'user-guest', displayName: 'Gastmusiker', role: 'OWNER' },
            ]);
        vi.mocked(transferOwnership).mockImplementation(async () => {
            session.setBands([{ ...BAND_A, role: 'ADMIN' }]);
            return {
                newOwner: { userId: 'user-guest', displayName: 'Gastmusiker', role: 'OWNER' },
                previousOwner: { userId: 'user-owner', displayName: 'Alex', role: 'ADMIN' },
            };
        });

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Du')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByLabelText('Mitglied für die Eigentümerschaft'));
        fireEvent.click(screen.getByRole('option', { name: 'Gastmusiker (GUEST)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Ownership übertragen' }));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/Eigentümerschaft wirklich an Gastmusiker übertragen/)).toBeInTheDocument();
        expect(within(dialog).getByText(/anschließend Administrator dieser Band/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Eigentümerschaft übertragen' }));

        await waitFor(() => {
            expect(transferOwnership).toHaveBeenCalledWith({
                token: 'test-token',
                bandId: BAND_A.id,
                userId: 'user-guest',
            });
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(screen.queryByRole('button', { name: 'Ownership übertragen' })).not.toBeInTheDocument();
        expect(screen.getByText('OWNER')).toBeInTheDocument();
        expect(screen.getByLabelText('Rolle von Du')).toHaveTextContent('ADMIN');
        expect(screen.getByRole('button', { name: 'Band verlassen' })).toBeInTheDocument();
    });

    it.each(['ADMIN', 'MEMBER', 'GUEST'])('lässt %s die Band verlassen', async (role) => {
        stubCurrentUser('user-self', [{ id: 'band-a', name: 'Band A', role }]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-self', displayName: 'Ich', role },
        ]);

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByRole('button', { name: 'Band verlassen' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ownership übertragen' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Band verlassen' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/Deine Mitgliedschaft wird beendet/)).toBeInTheDocument();
        expect(within(dialog).getByText(/persönlichen Notizen/)).toBeInTheDocument();
    });

    it('verwirft die aktive Band nach dem Verlassen und zeigt den Leerzustand ohne weitere Band', async () => {
        const session = stubCurrentUser('user-admin', [{ id: 'band-a', name: 'Band A', role: 'ADMIN' }]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-admin', displayName: 'Admin', role: 'ADMIN' },
        ]);
        vi.mocked(leaveBand).mockImplementation(async () => {
            session.setBands([]);
            return null;
        });

        renderWithBand(
            <MemoryRouter>
                <Header />
                <BandPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Band verlassen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mitgliedschaft beenden' }));

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        });
        expect(leaveBand).toHaveBeenCalledWith({ token: 'test-token', bandId: 'band-a' });
    });

    it('wählt nach dem Verlassen eine verbleibende Band', async () => {
        const remaining = { id: 'band-b', name: 'Band B', role: 'MEMBER' };
        const session = stubCurrentUser('user-admin', [{ id: 'band-a', name: 'Band A', role: 'ADMIN' }]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-admin', displayName: 'Admin', role: 'ADMIN' },
        ]);
        vi.mocked(leaveBand).mockImplementation(async () => {
            session.setBands([remaining]);
            return null;
        });

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Band verlassen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mitgliedschaft beenden' }));

        expect(await screen.findByRole('heading', { name: 'Band: Band B' })).toBeInTheDocument();
    });

    it('zeigt API-Fehler der Eigentumsübertragung verständlich an', async () => {
        stubCurrentUser('user-owner', [BAND_A]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-guest', displayName: 'Gastmusiker', role: 'GUEST' },
        ]);
        vi.mocked(transferOwnership).mockRejectedValue(
            new ApiError(403, 'forbidden', 'Forbidden', { error: 'Forbidden' })
        );

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Du')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByLabelText('Mitglied für die Eigentümerschaft'));
        fireEvent.click(screen.getByRole('option', { name: 'Gastmusiker (GUEST)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Ownership übertragen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Eigentümerschaft übertragen' }));

        expect(await screen.findByText(/nicht erlaubt/i)).toBeInTheDocument();
    });

    it('bricht die Übertragung ab und zeigt Leave-Fehler im Dialog', async () => {
        stubCurrentUser('user-owner', [BAND_A]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-guest', displayName: 'Gastmusiker', role: 'GUEST' },
        ]);

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Du')).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByLabelText('Mitglied für die Eigentümerschaft'));
        fireEvent.click(screen.getByRole('option', { name: 'Gastmusiker (GUEST)' }));
        fireEvent.click(screen.getByRole('button', { name: 'Ownership übertragen' }));
        fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
        expect(transferOwnership).not.toHaveBeenCalled();
    });

    it('verwirft die verlassene Band auch wenn die Bandliste nicht neu geladen werden kann', async () => {
        let bandLoads = 0;
        vi.stubGlobal('fetch', vi.fn((url) => {
            if (String(url).endsWith('/api/me')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ id: 'user-admin' }),
                });
            }
            bandLoads += 1;
            if (bandLoads === 1) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([{ id: 'band-a', name: 'Band A', role: 'ADMIN' }]),
                });
            }
            return Promise.resolve({ ok: false, status: 500 });
        }));
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-admin', displayName: 'Admin', role: 'ADMIN' },
        ]);
        vi.mocked(leaveBand).mockResolvedValue(null);

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Band verlassen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mitgliedschaft beenden' }));

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        expect(window.localStorage.getItem('mysongbook.activeBandId')).toBeNull();
    });

    it('zeigt einen Leave-Fehler verständlich an', async () => {
        stubCurrentUser('user-self', [{ id: 'band-a', name: 'Band A', role: 'MEMBER' }]);
        vi.mocked(listMembers).mockResolvedValue([
            { userId: 'user-owner', displayName: 'Alex', role: 'OWNER' },
            { userId: 'user-self', displayName: 'Ich', role: 'MEMBER' },
        ]);
        vi.mocked(leaveBand).mockRejectedValue(new ApiError(
            400,
            'server',
            'OWNER cannot leave the band',
            { error: 'OWNER cannot leave the band' },
        ));

        renderWithBand(
            <MemoryRouter>
                <BandPage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole('button', { name: 'Band verlassen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Mitgliedschaft beenden' }));

        expect(await screen.findByText(/Übertrage zuerst die Eigentümerschaft/)).toBeInTheDocument();
    });
});

function stubCurrentUser(meId, bands) {
    let bandList = bands;
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (String(url).endsWith('/api/me')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: meId }),
            });
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bandList),
        });
    }));
    return {
        setBands(next) {
            bandList = next;
        },
    };
}
