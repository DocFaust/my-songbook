import { describe, it, expect } from 'vitest';
import { canDeleteBandMusic, canMutateBandMusic } from '../bandRoles.js';

describe('bandRoles', () => {
    it('erlaubt Schreiben für OWNER, ADMIN und MEMBER', () => {
        expect(canMutateBandMusic('OWNER')).toBe(true);
        expect(canMutateBandMusic('ADMIN')).toBe(true);
        expect(canMutateBandMusic('MEMBER')).toBe(true);
        expect(canMutateBandMusic('GUEST')).toBe(false);
        expect(canMutateBandMusic(undefined)).toBe(true);
    });

    it('erlaubt Löschen nur für OWNER und ADMIN', () => {
        expect(canDeleteBandMusic('OWNER')).toBe(true);
        expect(canDeleteBandMusic('ADMIN')).toBe(true);
        expect(canDeleteBandMusic('MEMBER')).toBe(false);
        expect(canDeleteBandMusic('GUEST')).toBe(false);
        expect(canDeleteBandMusic(undefined)).toBe(true);
    });
});
