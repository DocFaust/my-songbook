import {
    deletePendingNoteChange,
    getPendingNoteChange,
    listPendingNoteChanges,
    putPendingNoteChange,
} from '../snapshot/snapshotDb.js';

function blank(text) {
    return typeof text !== 'string' || text.trim().length === 0;
}

function baseFromSnapshot(snapshotNote) {
    if (!snapshotNote) {
        return { baseAbsent: true, baseVersion: null, baseText: '' };
    }
    return {
        baseAbsent: false,
        baseVersion: Number.isInteger(snapshotNote.version) ? snapshotNote.version : null,
        baseText: snapshotNote.text ?? '',
    };
}

export function displayedNote(snapshotNote, pending) {
    if (pending?.action === 'DELETE') {
        return { text: '', pending: true };
    }
    if (pending?.action === 'UPSERT') {
        return { text: pending.text ?? '', pending: true };
    }
    return { text: snapshotNote?.text ?? '', pending: false };
}

export async function stageNoteChange({ userId, bandId, songId, text, snapshotNote, now = () => new Date().toISOString() }) {
    const existing = await getPendingNoteChange(userId, bandId, songId);
    const base = existing
        ? {
            baseAbsent: existing.baseAbsent === true,
            baseVersion: existing.baseAbsent === true ? null : existing.baseVersion ?? null,
            baseText: existing.baseText ?? '',
        }
        : baseFromSnapshot(snapshotNote);
    const cleared = blank(text);
    const matchesServer = cleared
        ? base.baseAbsent
        : !base.baseAbsent && text === base.baseText;
    if (matchesServer) {
        if (existing) {
            await deletePendingNoteChange(userId, bandId, songId);
        }
        return null;
    }
    const change = {
        userId,
        bandId,
        songId,
        text: cleared ? '' : text,
        action: cleared ? 'DELETE' : 'UPSERT',
        baseAbsent: base.baseAbsent,
        baseVersion: base.baseVersion,
        baseText: base.baseText,
        updatedAt: now(),
        conflict: null,
        blocked: null,
    };
    await putPendingNoteChange(change);
    return change;
}

export function getPendingNoteChangeForSong(userId, bandId, songId) {
    return getPendingNoteChange(userId, bandId, songId);
}

export function listPendingNotes(userId) {
    return listPendingNoteChanges(userId);
}

export function removePendingNote(userId, bandId, songId) {
    return deletePendingNoteChange(userId, bandId, songId);
}

export async function markPendingConflict(change, conflict) {
    const next = {
        ...change,
        conflict,
        blocked: null,
    };
    await putPendingNoteChange(next);
    return next;
}

export async function markPendingBlocked(change, reason) {
    const next = {
        ...change,
        blocked: reason,
        conflict: null,
    };
    await putPendingNoteChange(next);
    return next;
}
