import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { TextEncoder, TextDecoder } from 'util';
import { vi } from 'vitest';

configure({ asyncUtilTimeout: 4000 });

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

vi.mock('react-oidc-context', () => ({
    AuthProvider: ({ children }) => children,
    useAuth: () => ({
        isAuthenticated: false,
        isLoading: false,
        signinRedirect: vi.fn(),
        signoutRedirect: vi.fn(),
        user: null,
    }),
}));
