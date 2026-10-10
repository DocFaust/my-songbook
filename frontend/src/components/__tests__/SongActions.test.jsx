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

    it('sperrt Neuer Song im Performance Mode und lässt den Import offen', () => {
        performanceState.active = true;
        render(
            <MemoryRouter>
                <SongActions />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByRole('button', { name: '+ Song' }));
        expect(screen.getByRole('menuitem', { name: 'Neuer Song' })).toHaveAttribute('aria-disabled', 'true');
        expect(screen.getByText('Im Performance Mode nicht verfügbar.')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: 'Song importieren' })).toHaveAttribute('href', '/import');
    });
});
