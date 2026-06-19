import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SongTextarea from '../SongTextArea.jsx';

vi.mock('../../db', () => ({
    addSongs: vi.fn(() => Promise.resolve()),
}));

import { addSongs } from '../../db';

describe('SongTextarea', () => {
    beforeEach(() => {
        vi.mocked(addSongs).mockClear();
    });

    it('zeigt Platzhalter ohne ausgewählten Song', () => {
        render(<SongTextarea selectedSong={null} editedText="" onChange={vi.fn()} />);
        expect(screen.getByText('Kein Song ausgewählt')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    });

    it('speichert Song und zeigt Snackbar', async () => {
        const onChange = vi.fn();
        const song = { Id: '1', title: 'Test', content: 'old' };

        render(
            <SongTextarea selectedSong={song} editedText="new content" onChange={onChange} />
        );

        expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'updated' } });
        expect(onChange).toHaveBeenCalledWith('updated');

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(addSongs).toHaveBeenCalledWith([{ ...song, content: 'new content' }]);
            expect(screen.getByText('Song gespeichert!')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Song gespeichert!'));
    });

    it('zeigt Fehlermeldung bei leerem Songtext', async () => {
        const song = { Id: '1', title: 'Test', content: '' };

        render(
            <SongTextarea selectedSong={song} editedText="   " onChange={vi.fn()} />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(addSongs).not.toHaveBeenCalled();
            expect(screen.getByText('Songtext darf nicht leer sein.')).toBeInTheDocument();
        });
    });

    it('zeigt Songtitel im Heading', () => {
        const song = { Id: '1', title: 'Wonderwall', content: 'text' };

        render(
            <SongTextarea selectedSong={song} editedText="text" onChange={vi.fn()} />
        );

        expect(screen.getByRole('heading', { level: 3, name: 'Wonderwall' })).toBeInTheDocument();
    });
});
