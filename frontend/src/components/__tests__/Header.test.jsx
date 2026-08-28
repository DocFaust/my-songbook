import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '../Header.jsx';

vi.mock('../../auth/authConfig.js', () => ({
    isOidcConfigured: false,
    apiBaseUrl: 'http://localhost:8080',
}));

describe('Header', () => {
    it('rendert Navigation', () => {
        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getByRole('heading', { level: 6, name: /SongManager/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
        expect(screen.getByRole('link', { name: 'Editor' })).toHaveAttribute('href', '/editor');
        expect(screen.getByRole('link', { name: 'Sets' })).toHaveAttribute('href', '/setlist');
        expect(screen.getByRole('link', { name: 'Import' })).toHaveAttribute('href', '/import');
        expect(screen.getByText(/Auth nicht konfiguriert/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Band anlegen' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Aktive Band')).not.toBeInTheDocument();
    });
});
