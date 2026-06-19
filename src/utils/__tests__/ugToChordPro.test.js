import { describe, it, expect } from 'vitest';
import { ugToChordPro } from '../ugToChordPro.js';

describe('ugToChordPro', () => {
    it('ersetzt [ch]-Tags', () => {
        const input = '[ch]C[/ch] hello [ch]G[/ch]\n[verse]';
        const result = ugToChordPro(input);
        expect(result).toContain('{C}');
        expect(result).toContain('{G}');
        expect(result).toContain('{c: VERSE}');
    });

    it('webt Akkorde in Lyrics ein', () => {
        const input = 'C G\nHello world';
        const result = ugToChordPro(input);
        expect(result).toContain('{C}');
        expect(result).toContain('{G}');
        expect(result).toContain('llo world');
    });

    it('konvertiert Sektions-Header', () => {
        const input = '[Chorus]\nSome lyrics';
        const result = ugToChordPro(input);
        expect(result).toContain('{c: CHORUS}');
        expect(result).toContain('Some lyrics');
    });

    it('gibt normale Zeilen unverändert zurück', () => {
        expect(ugToChordPro('Just text')).toBe('Just text');
    });
});
