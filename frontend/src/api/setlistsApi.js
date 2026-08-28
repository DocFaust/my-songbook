import { apiRequest } from './apiClient.js';

function setlistsPath(bandId, setlistId) {
    const base = `/api/bands/${bandId}/setlists`;
    return setlistId ? `${base}/${setlistId}` : base;
}

export function listSetlists({ token, bandId }) {
    return apiRequest({ path: setlistsPath(bandId), token });
}

export function getSetlist({ token, bandId, setlistId }) {
    return apiRequest({ path: setlistsPath(bandId, setlistId), token });
}

export function createSetlist({ token, bandId, name, songIds }) {
    return apiRequest({
        method: 'POST',
        path: setlistsPath(bandId),
        token,
        body: { name, songIds },
    });
}

export function updateSetlist({ token, bandId, setlistId, name, songIds, version }) {
    return apiRequest({
        method: 'PUT',
        path: setlistsPath(bandId, setlistId),
        token,
        body: { name, songIds, version },
    });
}

export function deleteSetlist({ token, bandId, setlistId, version }) {
    return apiRequest({
        method: 'DELETE',
        path: setlistsPath(bandId, setlistId),
        token,
        query: { version },
    });
}
