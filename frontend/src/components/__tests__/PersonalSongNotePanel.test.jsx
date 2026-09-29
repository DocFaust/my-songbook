import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PersonalSongNotePanel from '../PersonalSongNotePanel.jsx';
import { ApiError } from '../../api/apiClient.js';
import { getPersonalSongNote } from '../../api/personalSongNotesApi.js';

vi.mock('../../api/personalSongNotesApi.js', () => ({
    getPersonalSongNote: vi.fn(),
    savePersonalSongNote: vi.fn(),
}));

describe('PersonalSongNotePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('behält eine ungespeicherte Notiz, wenn sich das Token ändert', async () => {
        vi.mocked(getPersonalSongNote).mockResolvedValue({ text: 'server' });
        const { rerender } = render(
            <PersonalSongNotePanel token="t1" bandId="band-a" songId="song-1" />
        );

        const field = await screen.findByDisplayValue('server');
        fireEvent.change(field, { target: { value: 'lokal' } });
        rerender(<PersonalSongNotePanel token="t2" bandId="band-a" songId="song-1" />);

        expect(screen.getByDisplayValue('lokal')).toBeInTheDocument();
        expect(getPersonalSongNote).toHaveBeenCalledTimes(1);
    });

    it('zeigt die Notiz wieder, wenn ein späterer Ladevorgang nach einem Fehler gelingt', async () => {
        vi.mocked(getPersonalSongNote).mockImplementation(({ songId }) => {
            if (songId === 'song-1') {
                return Promise.reject(new ApiError(0, 'network', 'Keine Verbindung zum Server.'));
            }
            return Promise.resolve({ text: 'wieder da' });
        });
        const { rerender } = render(
            <PersonalSongNotePanel token="t1" bandId="band-a" songId="song-1" />
        );

        expect(await screen.findByText(/Keine Verbindung zum Server/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Notiz speichern' })).not.toBeInTheDocument();

        rerender(<PersonalSongNotePanel token="t1" bandId="band-a" songId="song-2" />);

        expect(await screen.findByDisplayValue('wieder da')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Notiz speichern' })).toBeEnabled();
    });
});
