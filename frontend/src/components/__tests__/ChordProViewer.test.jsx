import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChordProViewer from '../ChordProViewer/index.jsx';

describe('ChordProViewer', () => {
    it('zeigt Hinweis bei leerem Text', () => {
        render(<ChordProViewer chordProText="" />);
        expect(screen.getByText('Kein ChordPro Text')).toBeInTheDocument();
    });

    it('parst gültigen ChordPro-Text', () => {
        render(<ChordProViewer chordProText={'{title: Test}\nHello'} />);
        expect(screen.queryByText(/Fehler:/)).not.toBeInTheDocument();
    });

    it('zeigt Fehler bei ungültigem Input', () => {
        render(<ChordProViewer chordProText="{invalid directive without closing" />);
        expect(screen.getByText(/Fehler:/)).toBeInTheDocument();
    });
});
