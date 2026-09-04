import { describe, it, expect, afterEach } from 'vitest';
import {
    clearPendingInviteToken,
    loadPendingInviteToken,
    savePendingInviteToken,
} from '../inviteStorage.js';

describe('inviteStorage', () => {
    afterEach(() => {
        window.sessionStorage.clear();
    });

    it('speichert und löscht den Einladungs-Token', () => {
        savePendingInviteToken('invite-token');
        expect(loadPendingInviteToken()).toBe('invite-token');
        clearPendingInviteToken();
        expect(loadPendingInviteToken()).toBeNull();
    });

    it('ignoriert leere Tokens', () => {
        savePendingInviteToken('');
        expect(loadPendingInviteToken()).toBeNull();
    });
});
