import { ApiError, isApiErrorKind } from '../api/apiClient.js';
import { deletePersonalSongNote, getPersonalSongNote, savePersonalSongNote } from '../api/personalSongNotesApi.js';
import {
    listPendingNotes,
    markPendingBlocked,
    markPendingConflict,
    removePendingNote,
} from './pendingNotes.js';

function isNetwork(error) {
    return error instanceof ApiError && error.kind === 'network';
}

async function describeConflict(change, error, token, clients) {
    const body = error instanceof ApiError ? error.body : null;
    const code = body?.code;
    if (code === 'deleted') {
        return { code: 'deleted', serverText: '', serverVersion: null };
    }
    if ((code === 'changed' || code === 'created') && typeof body?.text === 'string' && Number.isInteger(body?.version)) {
        return { code, serverText: body.text, serverVersion: body.version };
    }
    const current = await clients.getNote({ token, bandId: change.bandId, songId: change.songId });
    if (!Number.isInteger(current?.version)) {
        return { code: 'deleted', serverText: '', serverVersion: null };
    }
    return {
        code: change.baseAbsent ? 'created' : 'changed',
        serverText: current.text ?? '',
        serverVersion: current.version,
    };
}

async function applyChange(change, token, clients) {
    if (change.action === 'DELETE') {
        if (change.baseAbsent) {
            return;
        }
        const expectedVersion = await resolveBaseVersion(change, token, clients);
        await clients.deleteNote({
            token,
            bandId: change.bandId,
            songId: change.songId,
            expectedVersion,
        });
        return;
    }
    if (change.baseAbsent) {
        await clients.saveNote({
            token,
            bandId: change.bandId,
            songId: change.songId,
            text: change.text,
            expectAbsent: true,
        });
        return;
    }
    const expectedVersion = await resolveBaseVersion(change, token, clients);
    await clients.saveNote({
        token,
        bandId: change.bandId,
        songId: change.songId,
        text: change.text,
        expectedVersion,
    });
}

async function resolveBaseVersion(change, token, clients) {
    if (Number.isInteger(change.baseVersion)) {
        return change.baseVersion;
    }
    const current = await clients.getNote({ token, bandId: change.bandId, songId: change.songId });
    const serverText = current?.text ?? '';
    if (!Number.isInteger(current?.version)) {
        throw new ApiError(409, 'conflict', 'stale version', { code: 'deleted' });
    }
    if (serverText !== (change.baseText ?? '')) {
        throw new ApiError(409, 'conflict', 'stale version', {
            code: 'changed',
            text: serverText,
            version: current.version,
        });
    }
    return current.version;
}

function blockedReason(error) {
    if (!(error instanceof ApiError) || error.kind !== 'not_found') {
        return null;
    }
    return error.body?.code === 'membership' ? 'membership' : 'song';
}

async function recordSyncFailure(error, change, token, clients, conflicts, blocked) {
    const reason = blockedReason(error);
    if (reason) {
        blocked.push(await markPendingBlocked(change, reason));
        return;
    }
    if (isApiErrorKind(error, 'conflict')) {
        const conflict = await describeConflict(change, error, token, clients);
        conflicts.push(await markPendingConflict(change, conflict));
        return;
    }
    throw error;
}

export async function syncPendingNotes({
    userId,
    token,
    clients = {
        getNote: getPersonalSongNote,
        saveNote: savePersonalSongNote,
        deleteNote: deletePersonalSongNote,
    },
} = {}) {
    const pending = await listPendingNotes(userId);
    const synced = [];
    const conflicts = [];
    const blocked = [];
    let networkFailed = false;

    for (const change of pending) {
        if (change.blocked) {
            blocked.push(change);
            continue;
        }
        if (change.conflict) {
            conflicts.push(change);
            continue;
        }
        try {
            await applyChange(change, token, clients);
            await removePendingNote(change.userId, change.bandId, change.songId);
            synced.push(change);
        } catch (error) {
            if (isNetwork(error)) {
                networkFailed = true;
                break;
            }
            await recordSyncFailure(error, change, token, clients, conflicts, blocked);
        }
    }

    return { synced, conflicts, blocked, networkFailed };
}

export async function resolvePendingNote({ change, choice, token, clients }) {
    if (choice === 'server') {
        await removePendingNote(change.userId, change.bandId, change.songId);
        return { ok: true };
    }
    if (change.blocked) {
        return { ok: false, reason: 'blocked' };
    }
    const conflict = change.conflict;
    if (!conflict) {
        return { ok: false, reason: 'missing' };
    }
    try {
        if (change.action === 'DELETE') {
            await clients.deleteNote({
                token,
                bandId: change.bandId,
                songId: change.songId,
                expectedVersion: conflict.serverVersion,
            });
        } else if (conflict.code === 'deleted' || conflict.serverVersion == null) {
            await clients.saveNote({
                token,
                bandId: change.bandId,
                songId: change.songId,
                text: change.text,
                expectAbsent: true,
            });
        } else {
            await clients.saveNote({
                token,
                bandId: change.bandId,
                songId: change.songId,
                text: change.text,
                expectedVersion: conflict.serverVersion,
            });
        }
        await removePendingNote(change.userId, change.bandId, change.songId);
        return { ok: true };
    } catch (error) {
        if (isNetwork(error)) {
            return { ok: false, reason: 'network' };
        }
        const reason = blockedReason(error);
        if (reason) {
            await markPendingBlocked(change, reason);
            return { ok: false, reason };
        }
        if (isApiErrorKind(error, 'conflict')) {
            const next = await describeConflict(change, error, token, clients);
            await markPendingConflict(change, next);
            return { ok: false, reason: 'conflict', conflict: next };
        }
        throw error;
    }
}

export async function discardPendingNote(change) {
    await removePendingNote(change.userId, change.bandId, change.songId);
}
