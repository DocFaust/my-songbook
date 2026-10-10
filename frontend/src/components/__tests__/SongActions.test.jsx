import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SongActions from '../SongActions.jsx';

const performanceState = vi.hoisted(() => ({ active: false }));

vi.mock('../../performance/PerformanceModeContext.jsx', () => ({
    usePerformanceMode: () => ({ active: performanceState.active, ready: true }),
}));

describe('SongActions', () => {
    afterEach(() => {
        performanceState.active = false;
    });

    it('startet das Anlegen und verlinkt den Import', () => {
        const onCreate = vi.fn();
        render(
            <MemoryRouter>
                <SongActions onCreate={onCreate} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        expect(screen.getByRole('menuitem', { name: 'Neuer Song' })).not.toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).toHaveAttribute('href', '/import');
        fireEvent.click(screen.getByRole('menuitem', { name: 'Neuer Song' }));
        expect(onCreate).toHaveBeenCalledTimes(1);
    });

    it('sperrt Anlegen und Import im Performance Mode', () => {
        performanceState.active = true;
        const onCreate = vi.fn();
        render(
            <MemoryRouter>
                <SongActions onCreate={onCreate} />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        expect(screen.getByRole('menuitem', { name: 'Neuer Song' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).not.toHaveAttribute('href');
        expect(screen.getByText('Im Performance Mode nicht verfügbar.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('menuitem', { name: 'Neuer Song' }));
        expect(onCreate).not.toHaveBeenCalled();
    });
});
