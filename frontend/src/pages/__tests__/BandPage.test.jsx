import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BandPage from '../BandPage.jsx';
import { createInvitation, listInvitations, revokeInvitation } from '../../api/invitationsApi.js';
import { listMembers, removeMember, updateMemberRole } from '../../api/membershipsApi.js';
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
});
