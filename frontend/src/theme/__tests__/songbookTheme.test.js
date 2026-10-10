import { describe, expect, it } from 'vitest';
import { songbookColors, songbookTheme } from '../songbookTheme.js';
import { backgroundColor, themeColor } from '../../../pwa.config.js';

describe('Vintage Songbook Theme', () => {
    it('verwendet die vereinbarten Farbtöne', () => {
        expect(songbookTheme.palette.primary.main).toBe(songbookColors.primary);
        expect(songbookTheme.palette.secondary.main).toBe(songbookColors.accent);
        expect(songbookTheme.palette.background.default).toBe(songbookColors.background);
        expect(songbookTheme.palette.background.paper).toBe(songbookColors.surface);
        expect(songbookTheme.palette.primary.main).toBe('#40372F');
        expect(songbookTheme.palette.secondary.main).toBe('#A85D3A');
        expect(songbookTheme.palette.background.default).toBe('#F3EBDD');
        expect(songbookTheme.palette.background.paper).toBe('#FFF9EE');
        expect(songbookTheme.palette.primary.contrastText).toBe('#FFF9EE');
    });

    it('setzt serife Überschriften und serifenlose Bedienelemente', () => {
        expect(songbookTheme.typography.h1.fontFamily).toMatch(/Georgia/);
        expect(songbookTheme.typography.fontFamily).toMatch(/Segoe UI/);
        expect(songbookTheme.typography.button.textTransform).toBe('none');
    });

    it('färbt die installierte App wie die Kopfzeile', () => {
        expect(themeColor).toBe(songbookTheme.palette.primary.main);
        expect(backgroundColor).toBe(songbookTheme.palette.background.default);
    });
});
