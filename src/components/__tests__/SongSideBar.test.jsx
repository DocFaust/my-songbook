import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SongSidebar from '../SongSideBar/index.jsx';

describe('SongSidebar', () => {
    const songs = [
        { Id: '1', title: 'Song A', artist: 'Artist A' },
        { Id: '2', title: 'Song B' },
    ];

    it('rendert Songs und ruft Callbacks auf', () => {
        const onSelect = vi.fn();
        const onNew = vi.fn();

        render(<SongSidebar songs={songs} onSelect={onSelect} onNew={onNew} />);

        expect(screen.getByText('Song A')).toBeInTheDocument();
        expect(screen.getByText('Song B')).toBeInTheDocument();
        expect(screen.getByText('Artist A')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Song A'));
        expect(onSelect).toHaveBeenCalledWith(songs[0]);

        fireEvent.click(screen.getByRole('button', { name: 'New' }));
        expect(onNew).toHaveBeenCalled();
    });
});
