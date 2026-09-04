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

        render(
            <BandProvider>
                <BandSelector />
            </BandProvider>
        );

        expect(screen.queryByRole('button', { name: 'Band anlegen' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Aktive Band')).not.toBeInTheDocument();
        expect(screen.queryByText('Keine Band')).not.toBeInTheDocument();
    });

    it('lässt einen angemeldeten User ohne Bands eine Band anlegen', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);

        render(
            <BandProvider>
                <BandSelector />
            </BandProvider>
        );

        await waitFor(() => {
            expect(screen.getByText('Keine Band')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Band anlegen' }));
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alpspitzbuam' } });
        fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Aktive Band')).toHaveTextContent('Alpspitzbuam');
        });
        expect(screen.queryByText('Keine Band')).not.toBeInTheDocument();
    });

    it('zeigt die Bandliste und wechselt die aktive Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([
            { id: 'band-1', name: 'Alpspitzbuam', role: 'OWNER' },
            { id: 'band-2', name: 'Zweite Besetzung', role: 'OWNER' },
        ]);

        render(
            <BandProvider>
                <BandSelector />
            </BandProvider>
        );

        const select = await screen.findByLabelText('Aktive Band');
        expect(select).toHaveTextContent('Alpspitzbuam');

        fireEvent.mouseDown(select);
        fireEvent.click(await screen.findByRole('option', { name: 'Zweite Besetzung' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Aktive Band')).toHaveTextContent('Zweite Besetzung');
        });
    });

    it('blendet Import, Editor und Sets ohne aktive Band aus', () => {
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

        expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
    });
});
