import { listSnapshotBands, readBandSnapshot } from '../snapshot/snapshotDb.js';
import { displayedNote, getPendingNoteChangeForSong } from './pendingNotes.js';

function toSong(song) {
    return {
        id: song.songId,
        bandId: song.bandId,
        title: song.title,
        artist: song.artist,
        content: song.content,
    };
}

function toSetlist(setlist) {
    return {
        id: setlist.setlistId,
        bandId: setlist.bandId,
        name: setlist.name,
        songIds: [...setlist.songIds],
    };
}

export async function readPerformanceBands(userId) {
    const rows = await listSnapshotBands(userId);
    return (Array.isArray(rows) ? rows : []).map((band) => ({
        id: band.bandId,
        name: band.name,
        ...(band.role ? { role: band.role } : {}),
    }));
}
export async function readPerformanceSongs(userId, bandId) {
    const snapshot = await readBandSnapshot(userId, bandId);
    return snapshot.songs.map(toSong);
}

export async function readPerformanceSetlists(userId, bandId) {
    const snapshot = await readBandSnapshot(userId, bandId);
    return snapshot.setlists.map(toSetlist);
}

export async function readPerformanceMusic(userId, bandId) {
    const snapshot = await readBandSnapshot(userId, bandId);
    return {
        songs: snapshot.songs.map(toSong),
        setlists: snapshot.setlists.map(toSetlist),
        refreshedAt: snapshot.meta?.refreshedAt ?? null,
    };
}

export async function readPerformanceNote(userId, bandId, songId) {
    const snapshot = await readBandSnapshot(userId, bandId);
    const snapshotNote = snapshot.notes.find((note) => note.songId === songId) ?? null;
    const pending = await getPendingNoteChangeForSong(userId, bandId, songId);
    return {
        ...displayedNote(snapshotNote, pending),
        blocked: pending?.blocked ?? null,
    };
}

export async function readSnapshotNote(userId, bandId, songId) {
    const snapshot = await readBandSnapshot(userId, bandId);
    return snapshot.notes.find((note) => note.songId === songId) ?? null;
}

export async function readSnapshotSongTitle(userId, bandId, songId) {
    const snapshot = await readBandSnapshot(userId, bandId);
    return snapshot.songs.find((song) => song.songId === songId)?.title ?? null;
}
