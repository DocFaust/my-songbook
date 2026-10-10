import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App.jsx';

describe('App', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('zeigt SongManager im Header', () => {
        render(<App />);
        expect(screen.getByRole('heading', { level: 1, name: 'SongManager' })).toBeInTheDocument();
    });

    it('leitet / auf den Editor um', async () => {
        render(<App />);
        expect(await screen.findByText(/erfordern eine Anmeldung/i)).toBeInTheDocument();
        expect(screen.queryByText(/Willkommen im SongManager/i)).not.toBeInTheDocument();
        expect(window.location.pathname).toBe('/editor');
    });

    it('leitet einen fehlgeschlagenen OIDC-Callback auf den Editor um', () => {
        window.history.pushState({}, '', '/?error=access_denied&state=xyz');
        render(<App />);
        expect(window.location.pathname).toBe('/editor');
        expect(window.location.search).toBe('');
    });

    it('lässt den OIDC-Callback auf / stehen, bis die Anmeldung fertig ist', () => {
        window.history.pushState({}, '', '/?code=abc&state=xyz');
        render(<App />);
        expect(window.location.pathname).toBe('/');
        expect(window.location.search).toContain('code=abc');
        expect(screen.queryByText(/erfordern eine Anmeldung/i)).not.toBeInTheDocument();
    });

    it('zeigt keine dauerhafte Seitennavigation und keinen Band-Kontext ohne Anmeldung', () => {
        render(<App />);
        expect(screen.getByRole('link', { name: 'SongManager' })).toHaveAttribute('href', '/');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Aktive Band/ })).not.toBeInTheDocument();
    });
});
