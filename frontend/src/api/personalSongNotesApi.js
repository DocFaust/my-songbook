import { apiRequest } from './apiClient.js';

function notePath(bandId, songId) {
    return `/api/bands/${bandId}/songs/${songId}/note`;
}

export function getPersonalSongNote({ token, bandId, songId }) {
    return apiRequest({ path: notePath(bandId, songId), token });
}

export function listPersonalSongNotes({ token, bandId }) {
    return apiRequest({ path: `/api/bands/${bandId}/notes`, token });
}

export function savePersonalSongNote({ token, bandId, songId, text, expectedVersion, expectAbsent }) {
    const body = { text };
    if (expectAbsent) {
        body.expectAbsent = true;
    }
    if (Number.isInteger(expectedVersion)) {
        body.expectedVersion = expectedVersion;
    }
    return apiRequest({
        method: 'PUT',
        path: notePath(bandId, songId),
        token,
        body,
    });
}

export function deletePersonalSongNote({ token, bandId, songId, expectedVersion }) {
    return apiRequest({
        method: 'DELETE',
        path: notePath(bandId, songId),
        token,
        ...(Number.isInteger(expectedVersion) ? { query: { version: expectedVersion } } : {}),
    });
}
