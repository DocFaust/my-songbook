import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthStatus from '../AuthStatus.jsx';

vi.unmock('react-oidc-context');

vi.mock('../authConfig.js', () => ({
    isOidcConfigured: false,
    apiBaseUrl: 'http://localhost:8080',
}));

describe('AuthStatus without OIDC', () => {
    it('zeigt Hinweis statt zu crashen wenn Auth nicht konfiguriert ist', () => {
        expect(() => render(<AuthStatus />)).not.toThrow();
        expect(screen.getByText('Auth nicht konfiguriert')).toBeInTheDocument();
    });
});
