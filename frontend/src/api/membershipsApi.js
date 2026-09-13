import { apiRequest } from './apiClient.js';

function membersPath(bandId, userId) {
    const base = `/api/bands/${bandId}/members`;
    return userId ? `${base}/${userId}` : base;
}

export function listMembers({ token, bandId }) {
    return apiRequest({
        path: membersPath(bandId),
        token,
    });
}

export function updateMemberRole({ token, bandId, userId, role }) {
    return apiRequest({
        method: 'PUT',
        path: `${membersPath(bandId, userId)}/role`,
        token,
        body: { role },
    });
}

export function removeMember({ token, bandId, userId }) {
    return apiRequest({
        method: 'DELETE',
        path: membersPath(bandId, userId),
        token,
    });
}
