import { describe, it, expect } from 'vitest';
import {
    isChordLine,
    splitChordLinePreserveSpaces,
    wrapChordTokensPreservingSpaces,
} from '../chords.js';

describe('chords', () => {
    describe('isChordLine', () => {
        it('erkennt reine Akkordzeilen', () => {
            expect(isChordLine('C G Am F')).toBe(true);
            expect(isChordLine('  D  Em  |  ')).toBe(true);
            expect(isChordLine('H7')).toBe(true);
        });

        it('lehnt Textzeilen ab', () => {
            expect(isChordLine('Hello world')).toBe(false);
            expect(isChordLine('C is for cookie')).toBe(false);
        });
    });

    describe('splitChordLinePreserveSpaces', () => {
        it('behält Leerzeichen als separate Teile', () => {
            expect(splitChordLinePreserveSpaces('C  G')).toEqual(['C', '  ', 'G']);
        });
    });

    describe('wrapChordTokensPreservingSpaces', () => {
        it('setzt Akkorde in Klammern und lässt Leerzeichen unverändert', () => {
            expect(wrapChordTokensPreservingSpaces(['C', '  ', 'G'])).toBe('[C]  [G]');
            expect(wrapChordTokensPreservingSpaces(['  ', 'Am'])).toBe('  [Am]');
        });
    });
});
