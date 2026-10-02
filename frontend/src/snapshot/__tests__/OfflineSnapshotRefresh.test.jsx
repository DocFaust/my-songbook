import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import OfflineSnapshotRefresh from '../OfflineSnapshotRefresh.jsx';
import { refreshOfflineSnapshot } from '../refreshSnapshot.js';

const mockUseAuth = vi.fn();

vi.mock('react-oidc-context', () => ({
    useAuth: () => mockUseAuth(),
}));

vi.mock('../refreshSnapshot.js', () => ({
    refreshOfflineSnapshot: vi.fn(() => Promise.resolve({ userId: 'user-a', failures: [] })),
}));

function auth(subject, token) {
    return {
        isAuthenticated: true,
        isLoading: false,
        user: {
            access_token: token,
            profile: { sub: subject },
        },
    };
}

describe('OfflineSnapshotRefresh', () => {
    beforeEach(() => {
        vi.mocked(refreshOfflineSnapshot).mockClear();
    });

    it('startet einen Refresh pro User und nicht bei jedem Token', async () => {
        mockUseAuth.mockReturnValue(auth('user-a', 'token-1'));
        const view = render(<OfflineSnapshotRefresh />);
        await waitFor(() => {
            expect(refreshOfflineSnapshot).toHaveBeenCalledTimes(1);
        });
        expect(refreshOfflineSnapshot).toHaveBeenCalledWith({ token: 'token-1' });

        mockUseAuth.mockReturnValue(auth('user-a', 'token-2'));
        view.rerender(<OfflineSnapshotRefresh />);
        expect(refreshOfflineSnapshot).toHaveBeenCalledTimes(1);

        mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false, user: null });
        view.rerender(<OfflineSnapshotRefresh />);
        expect(refreshOfflineSnapshot).toHaveBeenCalledTimes(1);

        mockUseAuth.mockReturnValue(auth('user-b', 'token-3'));
        view.rerender(<OfflineSnapshotRefresh />);
        await waitFor(() => {
            expect(refreshOfflineSnapshot).toHaveBeenCalledTimes(2);
        });
        expect(refreshOfflineSnapshot).toHaveBeenLastCalledWith({ token: 'token-3' });
    });
});
