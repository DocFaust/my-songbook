import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../db', () => ({
    getAllSongs: vi.fn(() => Promise.resolve([])),
    getSetlists: vi.fn(() => Promise.resolve([])),
    addSongs: vi.fn(() => Promise.resolve()),
    saveSetlist: vi.fn(() => Promise.resolve()),
    deleteSetlist: vi.fn(() => Promise.resolve()),
}));

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
});
