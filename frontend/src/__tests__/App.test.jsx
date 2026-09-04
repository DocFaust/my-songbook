import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App.jsx';

describe('App', () => {
    it('zeigt SongManager im Header', () => {
        render(<App />);
        expect(screen.getByRole('heading', { level: 6, name: /SongManager/i })).toBeInTheDocument();
    });

    it('zeigt Home-Seite auf /', () => {
        render(<App />);
        expect(screen.getByText(/Willkommen im SongManager/i)).toBeInTheDocument();
    });

    it('blendet Import, Editor und Sets ohne aktive Band aus', () => {
        render(<App />);
        expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Band anlegen' })).not.toBeInTheDocument();
    });
});
