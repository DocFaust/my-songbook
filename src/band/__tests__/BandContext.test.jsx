import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BandProvider, useBand } from '../BandContext.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    apiBaseUrl: 'http://localhost:8080',
}));

function BandProbe() {
    const { bands, activeBand, isAuthenticated, loading, createBand, selectBand } = useBand();
    return (
        <div>
            <span data-testid="authenticated">{String(isAuthenticated)}</span>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="active-band">{activeBand?.name ?? ''}</span>
            <ul>
                {bands.map((band) => (
                    <li key={band.id}>{band.name}</li>
                ))}
            </ul>
            <button type="button" onClick={() => createBand('Neue Band')}>
                Create from probe
            </button>
            {bands[1] ? (
                <button type="button" onClick={() => selectBand(bands[1].id)}>
                    Select second
                </button>
            ) : null}
        </div>
    );
}

function authenticatedAuth() {
    return {
        isAuthenticated: true,
        isLoading: false,
        user: { access_token: 'test-token', profile: { preferred_username: 'local-dev' } },
    };
}

describe('BandContext', () => {
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
            user: null,
        });

        render(
            <BandProvider>
                <BandProbe />
            </BandProvider>
        );

        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
        expect(screen.getByTestId('active-band')).toHaveTextContent('');
        expect(screen.queryByText('Alpspitzbuam')).not.toBeInTheDocument();
    });

    it('lädt Bands und stellt die zuletzt gewählte Band wieder her', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        window.localStorage.setItem('mysongbook.activeBandId', 'band-2');
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { id: 'band-1', name: 'Erste', role: 'OWNER' },
                    { id: 'band-2', name: 'Zweite', role: 'OWNER' },
                ]),
            })
        ));

        render(
            <BandProvider>
                <BandProbe />
            </BandProvider>
        );

        await waitFor(() => {
            expect(screen.getAllByRole('listitem').map((item) => item.textContent))
                .toEqual(['Erste', 'Zweite']);
        });
        expect(screen.getByTestId('active-band')).toHaveTextContent('Zweite');
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/bands',
            expect.objectContaining({
                headers: { Authorization: 'Bearer test-token' },
            })
        );
    });

    it('wählt die erste Band wenn die gespeicherte ID unbekannt ist', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        window.localStorage.setItem('mysongbook.activeBandId', 'missing');
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { id: 'band-1', name: 'Erste', role: 'OWNER' },
                    { id: 'band-2', name: 'Zweite', role: 'OWNER' },
                ]),
            })
        ));

        render(
            <BandProvider>
                <BandProbe />
            </BandProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('active-band')).toHaveTextContent('Erste');
        });
    });

    it('lässt einen User ohne Bands eine Band anlegen', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        vi.stubGlobal('fetch', vi.fn((url, options) => {
            if (options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        id: 'band-new',
                        name: 'Neue Band',
                        role: 'OWNER',
                    }),
                });
            }
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve([]),
            });
        }));

        render(
            <BandProvider>
                <BandProbe />
            </BandProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Create from probe' }));

        await waitFor(() => {
            expect(screen.getAllByRole('listitem').map((item) => item.textContent))
                .toEqual(['Neue Band']);
        });
        expect(screen.getByTestId('active-band')).toHaveTextContent('Neue Band');
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8080/api/bands',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ name: 'Neue Band' }),
            })
        );
        expect(window.localStorage.getItem('mysongbook.activeBandId')).toBe('band-new');
    });

    it('wechselt die aktive Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        vi.stubGlobal('fetch', vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve([
                    { id: 'band-1', name: 'Erste', role: 'OWNER' },
                    { id: 'band-2', name: 'Zweite', role: 'OWNER' },
                ]),
            })
        ));

        render(
            <BandProvider>
                <BandProbe />
            </BandProvider>
        );

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Select second' })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: 'Select second' }));
        expect(screen.getByTestId('active-band')).toHaveTextContent('Zweite');
        expect(window.localStorage.getItem('mysongbook.activeBandId')).toBe('band-2');
    });
});
