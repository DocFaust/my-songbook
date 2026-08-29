import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from '../apiClient.js';
import { listMembers, removeMember, updateMemberRole } from '../membershipsApi.js';

vi.mock('../apiClient.js', () => ({
    apiRequest: vi.fn(),
}));

describe('membershipsApi', () => {
    beforeEach(() => {
        vi.mocked(apiRequest).mockReset();
        vi.mocked(apiRequest).mockResolvedValue([]);
    });

    it('listet, ändert Rollen und entfernt Mitglieder band-scoped', async () => {
        await listMembers({ token: 'tok', bandId: 'band-a' });
        await updateMemberRole({
            token: 'tok',
            bandId: 'band-a',
            userId: 'user-1',
            role: 'MEMBER',
        });
        await removeMember({ token: 'tok', bandId: 'band-a', userId: 'user-1' });

        expect(apiRequest).toHaveBeenNthCalledWith(1, {
            path: '/api/bands/band-a/members',
            token: 'tok',
        });
        expect(apiRequest).toHaveBeenNthCalledWith(2, {
            method: 'PUT',
            path: '/api/bands/band-a/members/user-1/role',
            token: 'tok',
            body: { role: 'MEMBER' },
        });
        expect(apiRequest).toHaveBeenNthCalledWith(3, {
            method: 'DELETE',
            path: '/api/bands/band-a/members/user-1',
            token: 'tok',
        });
    });
});
