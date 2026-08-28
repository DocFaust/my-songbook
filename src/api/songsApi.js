import { apiRequest } from './apiClient.js';

function songsPath(bandId, songId) {
    const base = `/api/bands/${bandId}/songs`;
    return songId ? `${base}/${songId}` : base;
}

export function listSongs({ token, bandId }) {
    return apiRequest({ path: songsPath(bandId), token });
}

export function getSong({ token, bandId, songId }) {
    return apiRequest({ path: songsPath(bandId, songId), token });
}

export function createSong({ token, bandId, title, artist, content }) {
    return apiRequest({
        method: 'POST',
        path: songsPath(bandId),
        token,
        body: { title, artist, content },
    });
}

export function updateSong({ token, bandId, songId, title, artist, content, version }) {
    return apiRequest({
        method: 'PUT',
        path: songsPath(bandId, songId),
        token,
        body: { title, artist, content, version },
    });
}
