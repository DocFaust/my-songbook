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
            <SongTextarea
                selectedSong={song}
                editedText="new content"
                editedTitle="Test"
                onChange={onChange}
                onSave={onSave}
            />
        );

        expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveValue('Test');

        fireEvent.change(screen.getByRole('textbox', { name: 'Songtext' }), { target: { value: 'updated' } });
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
            <SongTextarea
                selectedSong={song}
                editedText="   "
                editedTitle="Test"
                onChange={vi.fn()}
                onSave={onSave}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(onSave).not.toHaveBeenCalled();
            expect(screen.getByText('Songtext darf nicht leer sein.')).toBeInTheDocument();
        });
    });

    it('zeigt Titel und Interpret als Felder', () => {
        const onTitleChange = vi.fn();
        const onArtistChange = vi.fn();
        const song = { id: '1', title: 'Wonderwall', artist: 'Oasis', content: 'text', version: 0 };

        render(
            <SongTextarea
                selectedSong={song}
                editedText="text"
                editedTitle="Wonderwall"
                editedArtist="Oasis"
                onChange={vi.fn()}
                onTitleChange={onTitleChange}
                onArtistChange={onArtistChange}
                onSave={onSave}
            />
        );

        fireEvent.change(screen.getByRole('textbox', { name: 'Titel' }), { target: { value: 'Neuer Titel' } });
        fireEvent.change(screen.getByRole('textbox', { name: 'Interpret' }), { target: { value: 'Neue Band' } });
        expect(onTitleChange).toHaveBeenCalledWith('Neuer Titel');
        expect(onArtistChange).toHaveBeenCalledWith('Neue Band');
        expect(screen.queryByRole('heading', { level: 3, name: 'Wonderwall' })).not.toBeInTheDocument();
    });

    it('speichert keinen Song ohne Titel', async () => {
        const song = { id: '1', title: 'Test', content: 'text', version: 0 };

        render(
            <SongTextarea
                selectedSong={song}
                editedText="text"
                editedTitle="   "
                onChange={vi.fn()}
                onSave={onSave}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(onSave).not.toHaveBeenCalled();
            expect(screen.getByText('Titel darf nicht leer sein.')).toBeInTheDocument();
        });
    });

    it('zeigt keinen Erfolg, wenn Speichern fehlschlägt', async () => {
        onSave.mockRejectedValue(new Error('fail'));
        const song = { id: '1', title: 'Test', content: 'old', version: 0 };

        render(
            <SongTextarea
                selectedSong={song}
                editedText="new content"
                editedTitle="Test"
                onChange={vi.fn()}
                onSave={onSave}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

        await waitFor(() => {
            expect(onSave).toHaveBeenCalled();
        });
        expect(screen.queryByText('Song gespeichert!')).not.toBeInTheDocument();
    });

    it('bricht das Bearbeiten ab, ohne zu speichern', () => {
        const onCancel = vi.fn();
        const song = { id: '1', title: 'Test', content: 'old', version: 0 };

        render(
            <SongTextarea
                selectedSong={song}
                editedText="new content"
                editedTitle="Test"
                onChange={vi.fn()}
                onSave={onSave}
                onCancel={onCancel}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
        expect(onCancel).toHaveBeenCalledOnce();
        expect(onSave).not.toHaveBeenCalled();
    });
});
