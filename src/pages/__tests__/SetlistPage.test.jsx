import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SetlistPage from '../SetlistPage.jsx';

const mockSetlists = [{ id: 'sl1', name: 'Saved Gig', songIds: ['1'] }];

vi.mock('../../db', () => ({
    getAllSongs: vi.fn(() =>
        Promise.resolve([
            { Id: '1', type: 1, title: 'Song One', content: '{title: Song One}' },
            { Id: '2', type: 1, title: 'Song Two', content: '{title: Song Two}' },
        ])
    ),
    getSetlists: vi.fn(() => Promise.resolve(mockSetlists)),
    saveSetlist: vi.fn(() => Promise.resolve()),
    deleteSetlist: vi.fn(() => Promise.resolve()),
}));

vi.mock('uuid', () => ({
    v4: vi.fn(() => 'new-setlist-id'),
}));

import { saveSetlist, deleteSetlist } from '../../db';

async function openSongSelect() {
    fireEvent.mouseDown(screen.getByRole('combobox'));
    await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Song One' })).toBeInTheDocument();
    });
}

describe('SetlistPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('lädt Songs und gespeicherte Setlists', async () => {
        render(<SetlistPage />);

        await waitFor(() => {
            expect(screen.getByText('Saved Gig (1)')).toBeInTheDocument();
        });

        await openSongSelect();
        expect(screen.getByRole('option', { name: 'Song Two' })).toBeInTheDocument();
    });

    it('fügt Songs hinzu, speichert und entfernt Setlist', async () => {
        render(<SetlistPage />);

        await waitFor(() => {
            expect(screen.getByText('Saved Gig (1)')).toBeInTheDocument();
        });

        await openSongSelect();
        fireEvent.click(screen.getByRole('option', { name: 'Song Two' }));

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Entfernen' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
        expect(screen.getByText('Wähle Songs für die Vorschau.')).toBeInTheDocument();

        await openSongSelect();
        fireEvent.click(screen.getByRole('option', { name: 'Song One' }));

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Gig' } });
        fireEvent.click(screen.getByRole('button', { name: 'Setlist speichern' }));

        await waitFor(() => {
            expect(saveSetlist).toHaveBeenCalledWith({
                id: 'new-setlist-id',
                name: 'New Gig',
                songIds: ['1'],
            });
        });

        fireEvent.click(screen.getAllByRole('button', { name: 'Löschen' })[0]);

        await waitFor(() => {
            expect(deleteSetlist).toHaveBeenCalledWith('sl1');
        });
    });
});
