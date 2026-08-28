import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { vi } from 'vitest';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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
