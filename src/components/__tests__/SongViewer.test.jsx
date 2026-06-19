import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SongViewer from '../SongViewer.jsx';

describe('SongViewer', () => {
    it('rendert Vorschau mit ChordPro-Text', () => {
        render(<SongViewer chordProText="{title: Test Song}" />);
        expect(screen.getByRole('heading', { level: 3, name: 'Vorschau' })).toBeInTheDocument();
    });

    it('zeigt Hinweis bei leerem Text', () => {
        render(<SongViewer chordProText="" />);
        expect(screen.getByText('Kein ChordPro Text')).toBeInTheDocument();
    });
});
