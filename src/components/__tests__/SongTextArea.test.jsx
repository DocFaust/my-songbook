import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SongTextarea from '../SongTextArea.jsx';

describe('SongTextarea', () => {
    const onSave = vi.fn(() => Promise.resolve());

    beforeEach(() => {
        onSave.mockClear();
        onSave.mockResolvedValue(undefined);
    });

    it('zeigt Platzhalter ohne ausgewählten Song', () => {
        render(<SongTextarea selectedSong={null} editedText="" onChange={vi.fn()} onSave={onSave} />);
        expect(screen.getByText('Kein Song ausgewählt')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
    });

    it('speichert Song und zeigt Snackbar', async () => {
        const onChange = vi.fn();
        const song = { id: '1', title: 'Test', content: 'old', version: 0 };

        render(
            <SongTextarea selectedSong={song} editedText="new content" onChange={onChange} onSave={onSave} />
        );

        expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'updated' } });
        expect(onChange).toHaveBeenCalledWith('updated');

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalled();
            expect(screen.getByText('Song gespeichert!')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('Song gespeichert!'));
    });

    it('zeigt Fehlermeldung bei leerem Songtext', async () => {
        const song = { id: '1', title: 'Test', content: '', version: 0 };

        render(
            <SongTextarea selectedSong={song} editedText="   " onChange={vi.fn()} onSave={onSave} />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(onSave).not.toHaveBeenCalled();
            expect(screen.getByText('Songtext darf nicht leer sein.')).toBeInTheDocument();
        });
    });

    it('zeigt Songtitel im Heading', () => {
        const song = { id: '1', title: 'Wonderwall', content: 'text', version: 0 };

        render(
            <SongTextarea selectedSong={song} editedText="text" onChange={vi.fn()} onSave={onSave} />
        );

        expect(screen.getByRole('heading', { level: 3, name: 'Wonderwall' })).toBeInTheDocument();
    });

    it('zeigt keinen Erfolg, wenn Speichern fehlschlägt', async () => {
        onSave.mockRejectedValue(new Error('fail'));
        const song = { id: '1', title: 'Test', content: 'old', version: 0 };

        render(
            <SongTextarea selectedSong={song} editedText="new content" onChange={vi.fn()} onSave={onSave} />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalled();
        });
        expect(screen.queryByText('Song gespeichert!')).not.toBeInTheDocument();
    });
});
