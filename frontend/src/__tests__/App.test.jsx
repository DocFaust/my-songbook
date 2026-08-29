import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App.jsx';
import { savePendingInviteToken } from '../auth/inviteStorage.js';

describe('App', () => {
    afterEach(() => {
        window.sessionStorage.clear();
        window.history.replaceState({}, '', '/');
    });

    it('zeigt SongManager im Header', () => {
        render(<App />);
        expect(screen.getByRole('heading', { level: 6, name: /SongManager/i })).toBeInTheDocument();
    });

    it('zeigt Home-Seite auf /', () => {
        render(<App />);
        expect(screen.getByText(/Willkommen im SongManager/i)).toBeInTheDocument();
    });

    it('bietet Import, Editor und Sets weiterhin an', () => {
        render(<App />);
        expect(screen.getByRole('link', { name: 'Import' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Editor' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sets' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Band anlegen' })).not.toBeInTheDocument();
    });

    it('stellt eine ausstehende Einladung über den Router wieder her', () => {
        savePendingInviteToken('invite-token');
        render(<App />);
        expect(screen.getByText(/Einladung/i)).toBeInTheDocument();
        expect(screen.queryByText(/Willkommen im SongManager/i)).not.toBeInTheDocument();
    });
});
