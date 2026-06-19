import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SongTextarea from '../SongTextArea.jsx';

vi.mock('../../db', () => ({
    addSongs: vi.fn(() => Promise.resolve()),
}));

import { addSongs } from '../../db';

describe('SongTextarea', () => {
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
});
