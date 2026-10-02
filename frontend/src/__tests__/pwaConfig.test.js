import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../../package.json' with { type: 'json' };
import {
    apiNavigationDenylist,
    backgroundColor,
    pwaOptions,
    themeColor,
} from '../../pwa.config.js';

const FRONTEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('PWA app shell configuration', () => {
    it('uses vite-plugin-pwa only as a build tool', () => {
        expect(packageJson.devDependencies['vite-plugin-pwa']).toBeDefined();
        expect(packageJson.dependencies).not.toHaveProperty('vite-plugin-pwa');
    });

    it('keeps the service worker off during Vite development', () => {
        expect(pwaOptions.devOptions.enabled).toBe(false);
        expect(pwaOptions.registerType).toBe('autoUpdate');
        expect(pwaOptions.injectRegister).toBe('auto');
        const main = readFileSync(join(FRONTEND_ROOT, 'src', 'main.jsx'), 'utf8');
        expect(main).toContain('registerSW({ immediate: true })');
        expect(main).not.toContain('location.reload');
    });

    it('describes an installable My Songbook manifest', () => {
        expect(pwaOptions.manifest).toMatchObject({
            name: 'My Songbook',
            short_name: 'My Songbook',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            theme_color: themeColor,
            background_color: backgroundColor,
        });
        expect(pwaOptions.manifest.icons.map((icon) => icon.sizes)).toEqual([
            '192x192',
            '512x512',
            '512x512',
        ]);
        expect(existsSync(join(FRONTEND_ROOT, 'public', 'pwa-192x192.png'))).toBe(true);
        expect(existsSync(join(FRONTEND_ROOT, 'public', 'pwa-512x512.png'))).toBe(true);
        expect(existsSync(join(FRONTEND_ROOT, 'public', 'favicon.svg'))).toBe(true);
    });

    it('precaches the static shell and does not cache /api responses', () => {
        expect(pwaOptions.workbox.runtimeCaching).toEqual([]);
        expect(pwaOptions.workbox.navigateFallback).toBe('index.html');
        expect(pwaOptions.workbox.navigateFallbackDenylist).toEqual([apiNavigationDenylist]);
        expect(apiNavigationDenylist.test('/api/me')).toBe(true);
        expect(apiNavigationDenylist.test('/api/bands/1/songs')).toBe(true);
        expect(apiNavigationDenylist.test('/editor')).toBe(false);
        expect(pwaOptions.workbox.globPatterns.join(' ')).not.toMatch(/api/);
        expect(pwaOptions.workbox.cleanupOutdatedCaches).toBe(true);
        expect(pwaOptions.workbox.skipWaiting).toBe(true);
        expect(pwaOptions.workbox.clientsClaim).toBe(true);
    });
});
