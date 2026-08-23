import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AuthStatus from '../AuthStatus.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../authConfig.js', () => ({
    isOidcConfigured: true,
    apiBaseUrl: 'http://localhost:8080',
}));

describe('AuthStatus', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('zeigt Anmelden wenn nicht authentifiziert', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: null,
        });

        render(<AuthStatus />);

        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
    });

    function stubMeFetch() {
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 'user-uuid-123' }),
            })
        ));
    }

    it('zeigt preferred_username und Abmelden wenn authentifiziert', async () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: {
                access_token: 'test-token',
                profile: { preferred_username: 'local-dev', name: 'Local Developer' },
            },
        });
        stubMeFetch();

        render(<AuthStatus />);

        expect(screen.getByText('local-dev')).toBeInTheDocument();
        expect(screen.queryByText(/user-uuid-123/i)).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
        await waitFor(() => {
            expect(fetch).toHaveBeenCalled();
        });
    });

    it('zeigt name wenn preferred_username fehlt', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: {
                access_token: 'test-token',
                profile: { name: 'Local Developer' },
            },
        });
        stubMeFetch();

        render(<AuthStatus />);

        expect(screen.getByText('Local Developer')).toBeInTheDocument();
        expect(screen.queryByText(/user-uuid-123/i)).not.toBeInTheDocument();
    });

    it('zeigt Angemeldet ohne Namens-Claims', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: { access_token: 'test-token', profile: {} },
        });
        stubMeFetch();

        render(<AuthStatus />);

        expect(screen.getByText('Angemeldet')).toBeInTheDocument();
        expect(screen.queryByText(/user-uuid-123/i)).not.toBeInTheDocument();
    });
});
