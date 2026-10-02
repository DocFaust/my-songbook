function requireId(value, label) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Ungültiger Snapshot: ${label}`);
    }
}

function requireText(value, label) {
    if (typeof value !== 'string') {
        throw new Error(`Ungültiger Snapshot: ${label}`);
    }
}

function requireList(value, label) {
    if (!Array.isArray(value)) {
        throw new Error(`Ungültiger Snapshot: ${label}`);
    }
}

function storedSong(userId, bandId, song, songIds) {
    requireId(song?.id, 'songId');
    if (song.bandId !== bandId) {
        throw new Error('Ungültiger Snapshot: Song gehört zu einer anderen Band');
    }
    requireText(song.title, 'Songtitel');
    requireText(song.artist, 'Interpret');
    requireText(song.content, 'ChordPro');
    if (songIds.has(song.id)) {
        throw new Error('Ungültiger Snapshot: doppelte Song-ID');
    }
    songIds.add(song.id);
    return {
        userId,
        bandId,
        songId: song.id,
        title: song.title,
        artist: song.artist,
        content: song.content,
    };
}

function storedSetlist(userId, bandId, setlist, setlistIds) {
    requireId(setlist?.id, 'setlistId');
    if (setlist.bandId !== bandId) {
        throw new Error('Ungültiger Snapshot: Setlist gehört zu einer anderen Band');
    }
    requireText(setlist.name, 'Setlistname');
    requireList(setlist.songIds, 'Setlist-Einträge');
    if (setlistIds.has(setlist.id)) {
        throw new Error('Ungültiger Snapshot: doppelte Setlist-ID');
    }
    setlistIds.add(setlist.id);
    return {
        userId,
        bandId,
        setlistId: setlist.id,
        name: setlist.name,
        songIds: setlist.songIds.map((songId) => {
            requireId(songId, 'Setlist-Song');
            return songId;
        }),
    };
}

function storedNote(userId, bandId, note, songIds, noteSongIds) {
    requireId(note?.songId, 'Notiz-Song');
    requireText(note?.text, 'Notiz');
    if (note.text.trim().length === 0) {
        throw new Error('Ungültiger Snapshot: leere Notiz');
    }
    if (!songIds.has(note.songId)) {
        throw new Error('Ungültiger Snapshot: Notiz ohne Song dieser Band');
    }
    if (noteSongIds.has(note.songId)) {
        throw new Error('Ungültiger Snapshot: doppelte Notiz');
    }
    noteSongIds.add(note.songId);
    return {
        userId,
        bandId,
        songId: note.songId,
        text: note.text,
    };
}

export function buildBandSnapshot({ userId, band, songs, setlists, notes, refreshedAt }) {
    requireId(userId, 'userId');
    requireId(band?.id, 'bandId');
    requireText(band?.name, 'Bandname');
    if (band.name.length === 0) {
        throw new Error('Ungültiger Snapshot: Bandname');
    }
    requireList(songs, 'Songs');
    requireList(setlists, 'Setlists');
    requireList(notes, 'Notizen');
    requireText(refreshedAt, 'Zeitpunkt');

    const bandId = band.id;
    const songIds = new Set();
    const setlistIds = new Set();
    const noteSongIds = new Set();
    const storedSongs = songs.map((song) => storedSong(userId, bandId, song, songIds));
    const storedSetlists = setlists.map((setlist) => storedSetlist(userId, bandId, setlist, setlistIds));
    const storedNotes = notes.map((note) => storedNote(userId, bandId, note, songIds, noteSongIds));
    return {
        userId,
        bandId,
        band: { userId, bandId, name: band.name },
        songs: storedSongs,
        setlists: storedSetlists,
        notes: storedNotes,
        meta: { userId, bandId, refreshedAt },
    };
}
