import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImportPage from '../ImportPage.jsx';

vi.mock('../../db', () => ({
    addSongs: vi.fn(() => Promise.resolve()),
}));

import { addSongs } from '../../db';

describe('ImportPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('alert', vi.fn());
        vi.stubGlobal('crypto', { randomUUID: () => 'import-uuid' });
    });

    it('importiert und konvertiert UG-Inhalt', async () => {
        render(<ImportPage />);

        fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'My Song' } });
        fireEvent.change(screen.getByLabelText('Artist'), { target: { value: 'Band' } });
        fireEvent.change(screen.getByLabelText('UG-Inhalt einfügen'), {
            target: { value: 'C G\nHello world' },
        });

        const button = screen.getByRole('button', { name: /Konvertieren/i });
        expect(button).not.toBeDisabled();

        fireEvent.click(button);

        await waitFor(() => {
            expect(addSongs).toHaveBeenCalledWith([
                expect.objectContaining({
                    Id: 'import-uuid',
                    title: 'My Song',
                    artist: 'Band',
                    type: 1,
                }),
            ]);
            expect(window.alert).toHaveBeenCalledWith('Song importiert!');
        });
    });

    it('deaktiviert Import ohne Inhalt', () => {
        render(<ImportPage />);
        expect(screen.getByRole('button', { name: /Konvertieren/i })).toBeDisabled();
    });
});
