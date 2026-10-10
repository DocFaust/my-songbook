import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../Header.jsx';
import { BandProvider } from '../../band/BandContext.jsx';
import { authenticatedAuth, stubBandsFetch, BAND_A, BAND_GUEST } from '../../__tests__/helpers/musicTestUtils.jsx';

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

    it('zeigt die Vintage-Kopfzeile ohne die alte Navigation', () => {
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

        expect(screen.getByRole('heading', { level: 1, name: 'SongManager' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'SongManager' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('button', { name: 'Online' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Band' })).not.toBeInTheDocument();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.getByText(/Auth nicht konfiguriert/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Aktive Band/ })).not.toBeInTheDocument();
    });

    it('zeigt die aktive Band und keine Musik-Navigation', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);

        renderHeader();

        expect(await screen.findByRole('button', { name: 'Aktive Band: Band A' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    });

    it('bietet ohne Band das Erstellen und keine Bandverwaltung', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);

        renderHeader();

        fireEvent.click(await screen.findByRole('button', { name: 'Aktive Band: Keine Band' }));
        expect(screen.getByRole('menuitem', { name: 'Band erstellen' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Band verwalten' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
    });

    it('öffnet die Bandverwaltung für OWNER aus dem Bandmenü', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);

        renderHeader();

        fireEvent.click(await screen.findByRole('button', { name: 'Aktive Band: Band A' }));
        expect(screen.getByRole('menuitem', { name: 'Band verwalten' })).toHaveAttribute('href', '/band');
    });

    it('öffnet die Bandverwaltung auch für GUEST, damit die Band verlassen werden kann', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_GUEST]);

        renderHeader();

        fireEvent.click(await screen.findByRole('button', { name: 'Aktive Band: Band A' }));
        expect(screen.getByRole('menuitem', { name: 'Band verwalten' })).toHaveAttribute('href', '/band');
    });
});
