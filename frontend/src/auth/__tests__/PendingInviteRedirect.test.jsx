import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import PendingInviteRedirect from '../PendingInviteRedirect.jsx';
import { savePendingInviteToken } from '../inviteStorage.js';
import { authenticatedAuth, unauthenticatedAuth } from '../../__tests__/helpers/musicTestUtils.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../authConfig.js', () => ({
    isOidcConfigured: true,
}));

function LocationDisplay() {
    const location = useLocation();
    return <div>{`path:${location.pathname}`}</div>;
}

function renderRedirect(initialEntry = '/') {
    return render(
        <MemoryRouter initialEntries={[initialEntry]}>
            <PendingInviteRedirect />
            <Routes>
                <Route path="*" element={<LocationDisplay />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('PendingInviteRedirect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.sessionStorage.clear();
    });

    afterEach(() => {
        window.sessionStorage.clear();
    });

    it('navigiert nach erfolgreicher Anmeldung zur ausstehenden Einladung', async () => {
        savePendingInviteToken('invite-token');
        mockUseAuth.mockReturnValue(authenticatedAuth());

        const { findByText } = renderRedirect('/');

        expect(await findByText('path:/invite/invite-token')).toBeInTheDocument();
    });

    it('ändert die Route nicht ohne ausstehende Einladung', () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());

        const { getByText } = renderRedirect('/editor');

        expect(getByText('path:/editor')).toBeInTheDocument();
    });

    it('überschreibt einen geöffneten Einladungslink nicht mit einem älteren Token', () => {
        savePendingInviteToken('old-token');
        mockUseAuth.mockReturnValue(authenticatedAuth());

        const { getByText } = renderRedirect('/invite/new-token');

        expect(getByText('path:/invite/new-token')).toBeInTheDocument();
    });

    it('navigiert nicht solange der User nicht authentifiziert ist', () => {
        savePendingInviteToken('invite-token');
        mockUseAuth.mockReturnValue(unauthenticatedAuth());

        const { getByText } = renderRedirect('/');

        expect(getByText('path:/')).toBeInTheDocument();
    });

    it('navigiert nicht ohne Access-Token, um Login-Loops zu vermeiden', () => {
        savePendingInviteToken('invite-token');
        mockUseAuth.mockReturnValue({
            ...authenticatedAuth(),
            user: { profile: { preferred_username: 'local-dev' } },
        });

        const { getByText } = renderRedirect('/');

        expect(getByText('path:/')).toBeInTheDocument();
    });
});
