import { describe, it, expect, afterEach } from 'vitest';
import { loadActiveBandId, saveActiveBandId } from '../bandStorage.js';

describe('bandStorage', () => {
    afterEach(() => {
        window.localStorage.clear();
    });

    it('speichert und lädt nur die Band-ID', () => {
        saveActiveBandId('band-1');
        expect(loadActiveBandId()).toBe('band-1');
        expect(window.localStorage.getItem('mysongbook.activeBandId')).toBe('band-1');
    });

    it('entfernt die gespeicherte ID wenn keine Band aktiv ist', () => {
        saveActiveBandId('band-1');
        saveActiveBandId(null);
        expect(loadActiveBandId()).toBeNull();
    });
});
