import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InvitePage from '../InvitePage.jsx';
import { acceptInvitation } from '../../api/invitationsApi.js';
import { ApiError } from '../../api/apiClient.js';
import { loadPendingInviteToken } from '../../auth/inviteStorage.js';
import { BandProvider } from '../../band/BandContext.jsx';
import {
    authenticatedAuth,
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

vi.mock('../../api/invitationsApi.js', () => ({
    acceptInvitation: vi.fn(),
}));

function renderInvite(token = 'invite-token') {
    return render(
        <BandProvider>
            <MemoryRouter initialEntries={[`/invite/${token}`]}>
                <Routes>
                    <Route path="/invite/:token" element={<InvitePage />} />
                    <Route path="/editor" element={<div>Editor bereit</div>} />
                </Routes>
            </MemoryRouter>
        </BandProvider>
    );
}

describe('InvitePage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    it('startet den bestehenden Login und merkt sich die Einladung', async () => {
        const auth = unauthenticatedAuth();
        mockUseAuth.mockReturnValue(auth);

        renderInvite();

        await waitFor(() => {
            expect(auth.signinRedirect).toHaveBeenCalled();
        });
        expect(loadPendingInviteToken()).toBe('invite-token');
        expect(acceptInvitation).not.toHaveBeenCalled();
    });

    it('nimmt die Einladung an und wechselt zur Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([{ id: 'band-joined', name: 'Neue Band', role: 'GUEST' }]);
        vi.mocked(acceptInvitation).mockResolvedValue({
            bandId: 'band-joined',
            bandName: 'Neue Band',
            role: 'GUEST',
        });

        renderInvite();

        await waitFor(() => {
            expect(acceptInvitation).toHaveBeenCalledWith({
                token: 'test-token',
                inviteToken: 'invite-token',
            });
        });
        expect(await screen.findByText('Editor bereit')).toBeInTheDocument();
        expect(loadPendingInviteToken()).toBeNull();
    });

    it('zeigt verständliche Fehler für abgelaufene, verwendete und ungültige Einladungen', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);

        vi.mocked(acceptInvitation).mockRejectedValueOnce(
            new ApiError(410, 'gone', 'Invitation expired')
        );
        const first = renderInvite();
        expect(await screen.findByText(/abgelaufen/i)).toBeInTheDocument();
        first.unmount();

        vi.mocked(acceptInvitation).mockRejectedValueOnce(
            new ApiError(409, 'conflict', 'Invitation already accepted')
        );
        const second = renderInvite();
        expect(await screen.findByText(/bereits verwendet/i)).toBeInTheDocument();
        second.unmount();

        vi.mocked(acceptInvitation).mockRejectedValueOnce(
            new ApiError(404, 'not_found', 'Not found')
        );
        renderInvite();
        expect(await screen.findByText(/ungültig oder wurde zurückgezogen/i)).toBeInTheDocument();
    });

    it('zeigt einen allgemeinen Fehler für andere Ablehnungen', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);
        vi.mocked(acceptInvitation).mockRejectedValue(new Error('boom'));

        renderInvite();

        expect(await screen.findByText(/konnte nicht angenommen werden/i)).toBeInTheDocument();
    });

    it('wartet auf den Auth-Ladezustand und meldet 401 verständlich', async () => {
        mockUseAuth.mockReturnValue({
            ...unauthenticatedAuth(),
            isLoading: true,
        });
        renderInvite();
        expect(screen.getByText(/Einladung wird angenommen/i)).toBeInTheDocument();
        expect(acceptInvitation).not.toHaveBeenCalled();

        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);
        vi.mocked(acceptInvitation).mockRejectedValue(
            new ApiError(401, 'unauthorized', 'Nicht angemeldet')
        );
        renderInvite();
        expect(await screen.findByText(/Bitte erneut anmelden/i)).toBeInTheDocument();
    });
});
