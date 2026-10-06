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

function rememberedUserId(result) {
    const userId = result?.userId;
    if (typeof userId === 'string' && userId.length > 0) {
        return userId;
    }
    return null;
}

async function activateFromRefresh({
    token,
    refreshSnapshot,
    knownUserId,
    rememberUser,
    snapshotAvailable,
}) {
    try {
        const refreshedUserId = rememberedUserId(await refreshSnapshot(token));
        if (refreshedUserId) {
            rememberUser(refreshedUserId);
        }
        const nextUserId = refreshedUserId ?? knownUserId;
        if (await snapshotAvailable(nextUserId)) {
            return { ok: true, userId: nextUserId, usedExistingSnapshot: false };
        }
    } catch {
        if (await snapshotAvailable(knownUserId)) {
            return { ok: true, userId: knownUserId, usedExistingSnapshot: true };
        }
    }
    return { ok: false, reason: 'no-snapshot' };
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
    if (await probe() && token) {
        return activateFromRefresh({
            token,
            refreshSnapshot,
            knownUserId,
            rememberUser,
            snapshotAvailable,
        });
    }
    if (await snapshotAvailable(knownUserId)) {
        return { ok: true, userId: knownUserId, usedExistingSnapshot: true };
    }
    return { ok: false, reason: 'no-snapshot' };
}
