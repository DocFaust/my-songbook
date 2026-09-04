import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../Header.jsx';
import { BandProvider } from '../../band/BandContext.jsx';
import { authenticatedAuth, stubBandsFetch, BAND_A } from '../../__tests__/helpers/musicTestUtils.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: false,
    apiBaseUrl: 'http://localhost:8080',
}));

function renderHeader() {
    return render(
        <BandProvider>
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        </BandProvider>
    );
}

describe('Header', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('rendert Navigation', () => {
        mockUseAuth.mockReturnValue({
            isAuthenticated: false,
            isLoading: false,
            user: null,
        });

        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { level: 6, name: /SongManager/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.getByText(/Auth nicht konfiguriert/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Band anlegen' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Aktive Band')).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Band' })).not.toBeInTheDocument();
    });

    it('zeigt Editor, Sets und Import bei aktiver Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);

        renderHeader();

        expect(await screen.findByRole('link', { name: 'Editor' })).toHaveAttribute('href', '/editor');
        expect(screen.getByRole('link', { name: 'Sets' })).toHaveAttribute('href', '/setlist');
        expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('href', '/import');
        expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    });

    it('blendet Editor, Sets und Import ohne aktive Band aus', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);

        renderHeader();

        await waitFor(() => {
            expect(screen.getByText('Keine Band')).toBeInTheDocument();
        });
        expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Band anlegen' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Band' })).not.toBeInTheDocument();
    });

    it('zeigt Band-Verwaltung für OWNER', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);

        renderHeader();

        expect(await screen.findByRole('link', { name: 'Band' })).toHaveAttribute('href', '/band');
        await waitFor(() => {
            expect(screen.getByLabelText('Aktive Band')).toBeInTheDocument();
        });
    });
});
