import { describe, it, expect } from 'vitest';
import convertToChordPro, {
    mergeChordAndText,
    formatChordOnlyLine,
    headerDirectives,
} from '../convertToChordPro.js';

describe('convertToChordPro', () => {
    describe('mergeChordAndText', () => {
        it('verbindet Akkordzeile mit Textzeile', () => {
            expect(mergeChordAndText('C   G', 'Hello world')).toBe('[C]Hel[G]lo world');
        });
    });

    describe('formatChordOnlyLine', () => {
        it('formatiert reine Akkordzeilen', () => {
            expect(formatChordOnlyLine('C G Am')).toBe('[C] [G] [Am]');
        });
    });

    describe('headerDirectives', () => {
        it('erzeugt Metadaten-Direktiven', () => {
            expect(headerDirectives({ title: 'Song', artist: 'Band', capo: 2, key: 'Em' })).toEqual([
                '{title: Song}',
                '{artist: Band}',
                '{capo: 2}',
                '{key: Em}',
            ]);
        });

        it('ignoriert ungültige capo/key Werte', () => {
            expect(headerDirectives({ capo: 12, key: 'Invalid' })).toEqual([]);
        });
    });

    describe('convertToChordPro', () => {
        it('konvertiert vollständigen Song', () => {
            const input = [
                '[Verse]',
                'C G',
                'Hello world',
                '',
                'Plain line',
            ].join('\n');

            const result = convertToChordPro({
                title: 'Test',
                artist: 'Artist',
                input,
            });

            expect(result).toContain('{title: Test}');
            expect(result).toContain('{artist: Artist}');
            expect(result).toContain('{sov: Verse}');
            expect(result).toContain('[C]H[G]ello world');
            expect(result).toContain('Plain line');
        });

        it('behandelt mehrere Akkordzeilen hintereinander', () => {
            const input = 'C G\nAm F\n\nText';
            const result = convertToChordPro({ input });
            expect(result).toContain('[C] [G]');
            expect(result).toContain('[Am] [F]');
        });

        it('behandelt Abschnitte mit Text in derselben Zeile', () => {
            const result = convertToChordPro({ input: '[Chorus] extra' });
            expect(result).toContain('{soc: Chorus}');
            expect(result).toContain('extra');
        });
    });
});
