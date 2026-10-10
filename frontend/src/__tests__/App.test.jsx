import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App.jsx';

describe('App', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/');
    });

    it('zeigt SongManager im Header', () => {
        render(<App />);
        expect(screen.getByRole('heading', { level: 1, name: 'SongManager' })).toBeInTheDocument();
    });

    it('leitet / auf das Repertoire um', async () => {
        render(<App />);
        expect(await screen.findByText(/erfordern eine Anmeldung/i)).toBeInTheDocument();
        expect(screen.queryByText(/Willkommen im SongManager/i)).not.toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Repertoire' })).toBeInTheDocument();
        expect(window.location.pathname).toBe('/repertoire');
    });

    it('leitet einen fehlgeschlagenen OIDC-Callback auf das Repertoire um', () => {
        window.history.pushState({}, '', '/?error=access_denied&state=xyz');
        render(<App />);
        expect(window.location.pathname).toBe('/repertoire');
        expect(window.location.search).toBe('');
    });

    it('lässt den OIDC-Callback auf / stehen, bis die Anmeldung fertig ist', () => {
        window.history.pushState({}, '', '/?code=abc&state=xyz');
        render(<App />);
        expect(window.location.pathname).toBe('/');
        expect(window.location.search).toContain('code=abc');
        expect(screen.queryByText(/erfordern eine Anmeldung/i)).not.toBeInTheDocument();
    });

    it('zeigt keine dauerhafte Seitennavigation und keinen Band-Kontext ohne Anmeldung', async () => {
        render(<App />);
        expect(await screen.findByRole('heading', { name: 'Repertoire' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'SongManager' })).toHaveAttribute('href', '/repertoire');
        expect(screen.queryByRole('button', { name: '+ Song' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Setlists' })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('href', '/setlist');
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Import' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Editor' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Sets' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Aktive Band/ })).not.toBeInTheDocument();
    });

    it('navigiert über die Marke ins Repertoire und lokal zwischen Songs und Setlists', async () => {
        window.history.pushState({}, '', '/setlist');
        render(<App />);

        expect(await screen.findByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('link', { name: 'SongManager' }));
        expect(window.location.pathname).toBe('/repertoire');
        expect(screen.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'true');

        fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
        expect(window.location.pathname).toBe('/setlist');
        expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
    });

    it('lässt die bisherigen Musik-Adressen erreichbar', () => {
        window.history.pushState({}, '', '/editor');
        const editor = render(<App />);
        expect(window.location.pathname).toBe('/editor');
        expect(screen.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText(/erfordern eine Anmeldung/i)).toBeInTheDocument();
        editor.unmount();

        window.history.pushState({}, '', '/import');
        const importer = render(<App />);
        expect(window.location.pathname).toBe('/import');
        expect(screen.getByRole('heading', { name: 'Repertoire' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Songs' })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'false');
        importer.unmount();

        window.history.pushState({}, '', '/band');
        render(<App />);
        expect(window.location.pathname).toBe('/band');
        expect(screen.queryByRole('heading', { name: 'Repertoire' })).not.toBeInTheDocument();
        expect(screen.getByText(/erfordern eine Anmeldung/i)).toBeInTheDocument();
    });
});
