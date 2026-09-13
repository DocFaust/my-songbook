import { apiRequest } from './apiClient.js';

function bandInvitationsPath(bandId, invitationId) {
    const base = `/api/bands/${bandId}/invitations`;
    return invitationId ? `${base}/${invitationId}` : base;
}

export function createInvitation({ token, bandId }) {
    return apiRequest({
        method: 'POST',
        path: bandInvitationsPath(bandId),
        token,
    });
}

export function listInvitations({ token, bandId }) {
    return apiRequest({
        path: bandInvitationsPath(bandId),
        token,
    });
}

export function revokeInvitation({ token, bandId, invitationId }) {
    return apiRequest({
        method: 'DELETE',
        path: bandInvitationsPath(bandId, invitationId),
        token,
    });
}

export function acceptInvitation({ token, inviteToken }) {
    return apiRequest({
        method: 'POST',
        path: `/api/invitations/${inviteToken}/accept`,
        token,
    });
}
