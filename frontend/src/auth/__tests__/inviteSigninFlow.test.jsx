import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OidcAuthProvider from '../OidcAuthProvider.jsx';
import PendingInviteRedirect from '../PendingInviteRedirect.jsx';
import InvitePage from '../../pages/InvitePage.jsx';
import { acceptInvitation } from '../../api/invitationsApi.js';
import { loadPendingInviteToken, savePendingInviteToken } from '../inviteStorage.js';
import { BandProvider } from '../../band/BandContext.jsx';
import {
    authenticatedAuth,
    stubBandsFetch,
    unauthenticatedAuth,
} from '../../__tests__/helpers/musicTestUtils.jsx';

let capturedOnSigninCallback;
const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    AuthProvider: ({ children, onSigninCallback }) => {
        capturedOnSigninCallback = onSigninCallback;
        return children;
    },
    useAuth: () => mockUseAuth(),
}));

vi.mock('../authConfig.js', () => ({
    isOidcConfigured: true,
    oidcConfig: {},
    apiBaseUrl: 'http://localhost:8080',
}));

vi.mock('../../api/invitationsApi.js', () => ({
    acceptInvitation: vi.fn(),
}));

function FlowApp({ initialEntry }) {
    return (
        <OidcAuthProvider>
            <BandProvider>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <PendingInviteRedirect />
                    <Routes>
                        <Route path="/" element={<div>Home</div>} />
                        <Route path="/invite/:token" element={<InvitePage />} />
                        <Route path="/editor" element={<div>Editor bereit</div>} />
                    </Routes>
                </MemoryRouter>
            </BandProvider>
        </OidcAuthProvider>
    );
}

describe('Invite-Login-Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedOnSigninCallback = undefined;
        window.sessionStorage.clear();
        window.localStorage.clear();
        stubBandsFetch([{ id: 'band-joined', name: 'Neue Band', role: 'GUEST' }]);
        vi.mocked(acceptInvitation).mockResolvedValue({
            bandId: 'band-joined',
            bandName: 'Neue Band',
            role: 'GUEST',
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.sessionStorage.clear();
        window.localStorage.clear();
    });

    it('speichert die Einladung, navigiert nach dem Callback per Router und nimmt sie an', async () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        const unauth = unauthenticatedAuth();
        mockUseAuth.mockReturnValue(unauth);

        const beforeLogin = render(<FlowApp initialEntry="/invite/invite-token" />);

        await waitFor(() => {
            expect(unauth.signinRedirect).toHaveBeenCalled();
        });
        expect(loadPendingInviteToken()).toBe('invite-token');
        expect(acceptInvitation).not.toHaveBeenCalled();
        beforeLogin.unmount();

        mockUseAuth.mockReturnValue({
            ...authenticatedAuth(),
            isLoading: true,
        });
        const afterLogin = render(<FlowApp initialEntry="/" />);
        expect(screen.getByText('Home')).toBeInTheDocument();

        act(() => {
            capturedOnSigninCallback();
        });
        expect(replaceState).toHaveBeenCalledWith({}, expect.any(String), '/');
        expect(replaceState.mock.calls.some(([, , url]) => String(url).startsWith('/invite/'))).toBe(false);
        expect(acceptInvitation).not.toHaveBeenCalled();

        mockUseAuth.mockReturnValue(authenticatedAuth());
        afterLogin.rerender(<FlowApp initialEntry="/" />);

        await waitFor(() => {
            expect(acceptInvitation).toHaveBeenCalledWith({
                token: 'test-token',
                inviteToken: 'invite-token',
            });
        });
        expect(await screen.findByText('Editor bereit')).toBeInTheDocument();
        expect(loadPendingInviteToken()).toBeNull();
        replaceState.mockRestore();
    });

    it('lässt normalen Login ohne ausstehende Einladung unverändert', async () => {
        const replaceState = vi.spyOn(window.history, 'replaceState');
        mockUseAuth.mockReturnValue({
            ...authenticatedAuth(),
            isLoading: true,
        });

        const view = render(<FlowApp initialEntry="/" />);
        expect(loadPendingInviteToken()).toBeNull();
        expect(screen.getByText('Home')).toBeInTheDocument();

        act(() => {
            capturedOnSigninCallback();
        });
        expect(replaceState).toHaveBeenCalledWith({}, expect.any(String), '/');

        mockUseAuth.mockReturnValue(authenticatedAuth());
        view.rerender(<FlowApp initialEntry="/" />);

        expect(screen.getByText('Home')).toBeInTheDocument();
        expect(screen.queryByText(/Einladung wird angenommen/)).not.toBeInTheDocument();
        expect(acceptInvitation).not.toHaveBeenCalled();
        replaceState.mockRestore();
    });

    it('startet keinen Login-Loop wenn bereits auf der Einladungsseite', async () => {
        savePendingInviteToken('invite-token');
        const auth = authenticatedAuth();
        mockUseAuth.mockReturnValue(auth);

        render(<FlowApp initialEntry="/invite/invite-token" />);

        await waitFor(() => {
            expect(acceptInvitation).toHaveBeenCalledTimes(1);
        });
        expect(await screen.findByText('Editor bereit')).toBeInTheDocument();
        expect(auth.signinRedirect).not.toHaveBeenCalled();
    });
});
