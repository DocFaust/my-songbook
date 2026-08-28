import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { BandProvider } from '../../band/BandContext.jsx';

export const BAND_A = { id: 'band-a', name: 'Band A', role: 'OWNER' };
export const BAND_B = { id: 'band-b', name: 'Band B', role: 'OWNER' };
export const BAND_GUEST = { id: 'band-a', name: 'Band A', role: 'GUEST' };

export const SONG_A = {
    id: 'song-a',
    bandId: 'band-a',
    title: 'Song A',
    artist: 'Artist A',
    content: '{title: Song A}',
    version: 0,
};

export const SONG_B = {
    id: 'song-b',
    bandId: 'band-b',
    title: 'Song B',
    artist: 'Artist B',
    content: '{title: Song B}',
    version: 0,
};

export function authenticatedAuth() {
    return {
        isAuthenticated: true,
        isLoading: false,
        signinRedirect: vi.fn(),
        signoutRedirect: vi.fn(),
        user: {
            access_token: 'test-token',
            profile: { preferred_username: 'local-dev' },
        },
    };
}

export function unauthenticatedAuth() {
    return {
        isAuthenticated: false,
        isLoading: false,
        signinRedirect: vi.fn(),
        signoutRedirect: vi.fn(),
        user: null,
    };
}

export function stubBandsFetch(bands = [BAND_A]) {
    vi.stubGlobal('fetch', vi.fn((url) => {
        if (String(url).endsWith('/api/me')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ id: 'user-1' }),
            });
        }
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(bands),
        });
    }));
}

export function renderWithBand(ui) {
    return render(<BandProvider>{ui}</BandProvider>);
}
