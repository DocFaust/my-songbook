import { describe, it, expect } from 'vitest';
import { parseLabeledLine, labelToDirective } from '../sections.js';

describe('sections', () => {
    describe('parseLabeledLine', () => {
        it('parst Abschnittsüberschriften', () => {
            expect(parseLabeledLine('[Chorus]')).toEqual({ label: 'Chorus', rest: '' });
            expect(parseLabeledLine('[Verse 2] some text')).toEqual({
                label: 'Verse 2',
                rest: 'some text',
            });
        });

        it('gibt null für normale Zeilen zurück', () => {
            expect(parseLabeledLine('Normal text')).toBeNull();
        });
    });

    describe('labelToDirective', () => {
        it('mappt Chorus/Refrain auf soc', () => {
            expect(labelToDirective('Chorus')).toEqual({ directive: 'soc', label: 'Chorus' });
            expect(labelToDirective('Refrain')).toEqual({ directive: 'soc', label: 'Refrain' });
        });

        it('mappt Verse/Strophe auf sov', () => {
            expect(labelToDirective('Verse 1')).toEqual({ directive: 'sov', label: 'Verse 1' });
            expect(labelToDirective('Strophe')).toEqual({ directive: 'sov', label: 'Strophe' });
        });

        it('mappt andere Labels auf c', () => {
            expect(labelToDirective('Intro')).toEqual({ directive: 'c', label: 'Intro' });
        });
    });
});
