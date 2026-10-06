import { beforeEach, describe, expect, it, vi } from 'vitest';
import { activatePerformanceMode } from '../activatePerformanceMode.js';
import { formatSnapshotStand } from '../formatSnapshotStand.js';
import { readLastOfflineUserId, writeLastOfflineUserId } from '../offlineUser.js';

describe('activatePerformanceMode', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('aktiviert mit erfolgreichem Refresh', async () => {
        const refreshSnapshot = vi.fn(async () => ({ userId: 'user-a' }));
        const result = await activatePerformanceMode({
            token: 'token',
            probe: async () => true,
            refreshSnapshot,
            readUserId: () => null,
            rememberUser: writeLastOfflineUserId,
            snapshotAvailable: async () => true,
        });

        expect(result).toEqual({ ok: true, userId: 'user-a', usedExistingSnapshot: false });
        expect(refreshSnapshot).toHaveBeenCalledWith('token');
        expect(readLastOfflineUserId()).toBe('user-a');
    });

    it('aktiviert ohne Backend, wenn ein Snapshot vorhanden ist', async () => {
        const refreshSnapshot = vi.fn();
        const result = await activatePerformanceMode({
            token: 'token',
            probe: async () => false,
            refreshSnapshot,
            readUserId: () => 'user-a',
            rememberUser: writeLastOfflineUserId,
            snapshotAvailable: async (userId) => userId === 'user-a',
        });

        expect(result.ok).toBe(true);
        expect(result.usedExistingSnapshot).toBe(true);
        expect(refreshSnapshot).not.toHaveBeenCalled();
    });

    it('behält den vorhandenen Snapshot, wenn der Refresh scheitert', async () => {
        const result = await activatePerformanceMode({
            token: 'token',
            probe: async () => true,
            refreshSnapshot: async () => {
                throw new Error('timeout');
            },
            readUserId: () => 'user-a',
            rememberUser: writeLastOfflineUserId,
            snapshotAvailable: async () => true,
        });

        expect(result).toMatchObject({ ok: true, userId: 'user-a', usedExistingSnapshot: true });
    });

    it('verweigert die Aktivierung ohne Snapshot', async () => {
        const result = await activatePerformanceMode({
            token: null,
            probe: async () => false,
            refreshSnapshot: vi.fn(),
            readUserId: () => null,
            rememberUser: writeLastOfflineUserId,
            snapshotAvailable: async () => false,
        });

        expect(result).toEqual({ ok: false, reason: 'no-snapshot' });
    });

    it('formatiert den Stand des aktuellen Tags', () => {
        const label = formatSnapshotStand('2026-10-06T17:42:00.000Z', new Date('2026-10-06T18:00:00.000Z'));
        expect(label).toMatch(/^heute /);
    });

    it('formatiert einen älteren Stand und lehnt leere Angaben ab', () => {
        const label = formatSnapshotStand('2026-10-01T17:42:00.000Z', new Date('2026-10-06T18:00:00.000Z'));
        expect(label).toMatch(/1\.10\./);
        expect(formatSnapshotStand('')).toBeNull();
        expect(formatSnapshotStand('kein-datum')).toBeNull();
        expect(formatSnapshotStand(null)).toBeNull();
    });
});
