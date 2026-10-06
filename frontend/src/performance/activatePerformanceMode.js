import { listCachedBandIds } from '../snapshot/snapshotDb.js';
import { probeBackend } from './backendReachability.js';
import { readLastOfflineUserId, writeLastOfflineUserId } from './offlineUser.js';

export async function hasUsableSnapshot(userId) {
    if (typeof userId !== 'string' || userId.length === 0) {
        return false;
    }
    const bandIds = await listCachedBandIds(userId);
    return bandIds.length > 0;
}

export async function activatePerformanceMode({
    token,
    probe = probeBackend,
    refreshSnapshot,
    readUserId = readLastOfflineUserId,
    rememberUser = writeLastOfflineUserId,
    snapshotAvailable = hasUsableSnapshot,
} = {}) {
    const knownUserId = readUserId();
    const reachable = await probe();
    if (reachable && token) {
        try {
            const result = await refreshSnapshot(token);
            const userId = result?.userId;
            if (typeof userId === 'string' && userId.length > 0) {
                rememberUser(userId);
            }
            const nextUserId = typeof userId === 'string' && userId.length > 0 ? userId : knownUserId;
            if (await snapshotAvailable(nextUserId)) {
                return { ok: true, userId: nextUserId, usedExistingSnapshot: false };
            }
            return { ok: false, reason: 'no-snapshot' };
        } catch {
            if (await snapshotAvailable(knownUserId)) {
                return { ok: true, userId: knownUserId, usedExistingSnapshot: true };
            }
            return { ok: false, reason: 'no-snapshot' };
        }
    }
    if (await snapshotAvailable(knownUserId)) {
        return { ok: true, userId: knownUserId, usedExistingSnapshot: true };
    }
    return { ok: false, reason: 'no-snapshot' };
}
