import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BandSelector from '../BandSelector.jsx';
import { BandProvider } from '../BandContext.jsx';
import Header from '../../components/Header.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: true,
    apiBaseUrl: 'http://localhost:8080',
}));

function authenticatedAuth() {
    return {
        isAuthenticated: true,
        isLoading: false,
        signinRedirect: vi.fn(),
        signoutRedirect: vi.fn(),
        user: {
            access_token: 'test-token',
            profile: { preferred_username: 'local-dev' },
        },
    };
}

function stubBandsFetch(bands) {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
        if (String(url).endsWith('/api/me')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 'user-1' }),
            });
        }
        if (options?.method === 'POST' && String(url).endsWith('/api/bands')) {
            const body = JSON.parse(options.body);
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    id: 'band-created',
                    name: body.name,
                    role: 'OWNER',
                }),
            });
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bands),
        });
    }));
}

function renderSelector() {
    return render(
        <MemoryRouter>
            <BandProvider>
                <BandSelector />
            </BandProvider>
        </MemoryRouter>
    );
}

describe('BandSelector', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('zeigt ohne Anmeldung keinen Band-Kontext', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: null,
        });

        renderSelector();

        expect(screen.queryByRole('button', { name: /Aktive Band/ })).not.toBeInTheDocument();
        expect(screen.queryByText('Keine Band')).not.toBeInTheDocument();
    });

    it('lässt einen angemeldeten User ohne Bands eine Band anlegen', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);

        renderSelector();

        fireEvent.click(await screen.findByRole('button', { name: 'Aktive Band: Keine Band' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Band erstellen' }));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpspitzbuam' } });
        fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Aktive Band: Alpspitzbuam' })).toBeInTheDocument();
        });
        expect(screen.queryByText('Keine Band')).not.toBeInTheDocument();
    });

    it('zeigt die Bandliste und wechselt die aktive Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([
            { id: 'band-1', name: 'Alpspitzbuam', role: 'OWNER' },
            { id: 'band-2', name: 'Zweite Besetzung', role: 'OWNER' },
        ]);

        renderSelector();

        expect(await screen.findByRole('button', { name: 'Aktive Band: Alpspitzbuam' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Aktive Band: Alpspitzbuam' }));
        expect(screen.getByText('Band wechseln')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Zweite Besetzung' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Aktive Band: Zweite Besetzung' })).toBeInTheDocument();
        });
    });

    it('blendet die alte Navigation ohne Anmeldung aus', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            signinRedirect: vi.fn(),
            signoutRedirect: vi.fn(),
            user: null,
        });

        render(
            <MemoryRouter>
                <BandProvider>
                    <Header />
                </BandProvider>
            </MemoryRouter>
        );

        expect(screen.getByRole('link', { name: 'SongManager' })).toHaveAttribute('href', '/');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
    });
});
