import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorPage from '../EditorPage.jsx';

vi.mock('../../db', () => ({
    getAllSongs: vi.fn(() =>
        Promise.resolve([
            { Id: '1', type: 1, title: 'Existing', artist: 'Band', content: '{title: Existing}' },
        ])
    ),
    addSongs: vi.fn(() => Promise.resolve()),
}));

describe('EditorPage', () => {
    beforeEach(() => {
        vi.stubGlobal('crypto', { randomUUID: () => 'new-uuid' });
    });

    it('lädt Songs und erlaubt Auswahl', async () => {
        render(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Existing')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Existing'));
        expect(screen.getByDisplayValue('{title: Existing}')).toBeInTheDocument();
    });

    it('erstellt neuen Song', async () => {
        render(
            <MemoryRouter>
                <EditorPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Existing')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'New' }));
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
    });
});
