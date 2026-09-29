import { apiRequest } from './apiClient.js';

function notePath(bandId, songId) {
    return `/api/bands/${bandId}/songs/${songId}/note`;
}

export function getPersonalSongNote({ token, bandId, songId }) {
    return apiRequest({ path: notePath(bandId, songId), token });
}

export function savePersonalSongNote({ token, bandId, songId, text }) {
    return apiRequest({
        method: 'PUT',
        path: notePath(bandId, songId),
        token,
        body: { text },
    });
}

export function deletePersonalSongNote({ token, bandId, songId }) {
    return apiRequest({
        method: 'DELETE',
        path: notePath(bandId, songId),
        token,
    });
}
