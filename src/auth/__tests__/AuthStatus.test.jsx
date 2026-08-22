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

    it('zeigt User-ID und Abmelden wenn authentifiziert', async () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: true,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: { access_token: 'test-token' },
        });

        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 'user-uuid-123' }),
            })
        ));

        render(<AuthStatus />);

        await waitFor(() => {
            expect(screen.getByText(/User user-uuid-123/)).toBeInTheDocument();
        });
        expect(screen.getByRole('button', { name: 'Abmelden' })).toBeInTheDocument();
    });
});
