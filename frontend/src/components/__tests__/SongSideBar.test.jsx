import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SongSidebar from '../SongSideBar/index.jsx';
import { filterSongs } from '../SongSideBar/filterSongs.js';

describe('SongSidebar', () => {
    const songs = [
        { id: '1', title: 'Song A', artist: 'Artist A' },
        { id: '2', title: 'Song B' },
    ];

    it('rendert Songs, markiert die Auswahl und ruft die Auswahl auf', () => {
        const onSelect = vi.fn();

        render(<SongSidebar songs={songs} onSelect={onSelect} selectedId="1" />);

        expect(screen.getByText('Song A')).toBeInTheDocument();
        expect(screen.getByText('Song B')).toBeInTheDocument();
        expect(screen.getByText('Artist A')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Song A/ })).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByText('Song A'));
        expect(onSelect).toHaveBeenCalledWith(songs[0]);
    });
});

describe('filterSongs', () => {
    const songs = [
        { id: '1', title: 'Beta', artist: 'Zweite' },
        { id: '2', title: 'Alpha', name: 'Arbeitsname', author: 'Komponist' },
        { id: '3', title: 'Gamma', artist: 'Alpha Band' },
    ];

    it('behält die bestehende Reihenfolge und filtert Titel, Name, Artist und Author', () => {
        expect(filterSongs(songs, '   ')).toEqual(songs);
        expect(filterSongs(songs, 'alpha').map((song) => song.id)).toEqual(['2', '3']);
        expect(filterSongs(songs, 'komponist').map((song) => song.id)).toEqual(['2']);
        expect(filterSongs(songs, 'arbeitsname').map((song) => song.id)).toEqual(['2']);
        expect(filterSongs(null, 'alpha')).toEqual([]);
    });
});
