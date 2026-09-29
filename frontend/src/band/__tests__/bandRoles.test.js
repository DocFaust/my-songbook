import { describe, it, expect } from 'vitest';
import {
    ASSIGNABLE_ROLES,
    canDeleteBandMusic,
    canLeaveBand,
    canManageMemberships,
    canMutateBandMusic,
    canTransferOwnership,
    isOwnerRole,
} from '../bandRoles.js';

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

    it('erlaubt Mitgliederverwaltung nur für OWNER und ADMIN', () => {
        expect(canManageMemberships('OWNER')).toBe(true);
        expect(canManageMemberships('ADMIN')).toBe(true);
        expect(canManageMemberships('MEMBER')).toBe(false);
        expect(canManageMemberships('GUEST')).toBe(false);
        expect(isOwnerRole('OWNER')).toBe(true);
        expect(isOwnerRole('ADMIN')).toBe(false);
        expect(ASSIGNABLE_ROLES).toEqual(['ADMIN', 'MEMBER', 'GUEST']);
    });

    it('erlaubt Ownership-Transfer nur dem OWNER und Leave allen anderen Rollen', () => {
        expect(canTransferOwnership('OWNER')).toBe(true);
        expect(canTransferOwnership('ADMIN')).toBe(false);
        expect(canTransferOwnership('MEMBER')).toBe(false);
        expect(canTransferOwnership('GUEST')).toBe(false);
        expect(canLeaveBand('OWNER')).toBe(false);
        expect(canLeaveBand('ADMIN')).toBe(true);
        expect(canLeaveBand('MEMBER')).toBe(true);
        expect(canLeaveBand('GUEST')).toBe(true);
    });
});
