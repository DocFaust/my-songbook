import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../apiClient.js';
import {
    acceptInvitation,
    createInvitation,
    listInvitations,
    revokeInvitation,
} from '../invitationsApi.js';

vi.mock('../apiClient.js', () => ({
    apiRequest: vi.fn(),
}));

describe('invitationsApi', () => {
    beforeEach(() => {
        vi.mocked(apiRequest).mockReset();
        vi.mocked(apiRequest).mockResolvedValue({});
    });

    it('erzeugt, listet, zieht zurück und nimmt Einladungen an', async () => {
        await createInvitation({ token: 'tok', bandId: 'band-a' });
        await listInvitations({ token: 'tok', bandId: 'band-a' });
        await revokeInvitation({ token: 'tok', bandId: 'band-a', invitationId: 'inv-1' });
        await acceptInvitation({ token: 'tok', inviteToken: 'raw-token' });

        expect(apiRequest).toHaveBeenNthCalledWith(1, {
            method: 'POST',
            path: '/api/bands/band-a/invitations',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(2, {
            path: '/api/bands/band-a/invitations',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(3, {
            method: 'DELETE',
            path: '/api/bands/band-a/invitations/inv-1',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(4, {
            method: 'POST',
            path: '/api/invitations/raw-token/accept',
            token: 'tok',
        });
    });
});
