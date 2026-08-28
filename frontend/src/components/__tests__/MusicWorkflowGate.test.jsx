import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MusicWorkflowGate from '../MusicWorkflowGate.jsx';
import { BandProvider } from '../../band/BandContext.jsx';
import {
    authenticatedAuth,
    stubBandsFetch,
    unauthenticatedAuth,
    BAND_A,
} from '../../__tests__/helpers/musicTestUtils.jsx';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: true,
    apiBaseUrl: 'http://localhost:8080',
}));

describe('MusicWorkflowGate', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        window.localStorage.clear();
    });

    it('zeigt den Login-Weg ohne Anmeldung', () => {
        mockUseAuth.mockReturnValue(unauthenticatedAuth());
        render(
            <BandProvider>
                <MusicWorkflowGate>
                    <div>Musik</div>
                </MusicWorkflowGate>
            </BandProvider>
        );

        expect(screen.getByText(/erfordern eine Anmeldung/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Anmelden' })).toBeInTheDocument();
        expect(screen.queryByText('Musik')).not.toBeInTheDocument();
    });

    it('zeigt einen Empty-State ohne aktive Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([]);
        render(
            <BandProvider>
                <MusicWorkflowGate>
                    <div>Musik</div>
                </MusicWorkflowGate>
            </BandProvider>
        );

        expect(await screen.findByText(/Keine Band ausgewählt/i)).toBeInTheDocument();
        expect(screen.queryByText('Musik')).not.toBeInTheDocument();
    });

    it('rendert Kinder bei angemeldeter aktiver Band', async () => {
        mockUseAuth.mockReturnValue(authenticatedAuth());
        stubBandsFetch([BAND_A]);
        render(
            <BandProvider>
                <MusicWorkflowGate>
                    <div>Musik</div>
                </MusicWorkflowGate>
            </BandProvider>
        );

        expect(await screen.findByText('Musik')).toBeInTheDocument();
    });
});
