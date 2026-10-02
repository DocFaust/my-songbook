import { expect, test } from '@playwright/test';

// Fresh context: this file must not depend on a previous browser run, and its
// service worker must not leak into the critical-path contexts.
test.use({ storageState: { cookies: [], origins: [] } });

async function cacheUrls(page) {
    return page.evaluate(async () => {
        const names = await caches.keys();
        const urls = [];
        for (const name of names) {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            for (const request of requests) {
                urls.push(request.url);
            }
        }
        return urls;
    });
}

test('liefert eine installierbare App-Shell und cached keine API-Antworten', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Willkommen im SongManager' })).toBeVisible();

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifestResponse = await page.request.get(manifestHref);
    expect(manifestResponse.status()).toBe(200);
    expect(manifestResponse.headers()['content-type'] ?? '').toContain('manifest');
    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
        name: 'My Songbook',
        short_name: 'My Songbook',
        start_url: '/',
        display: 'standalone',
    });
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
    for (const icon of manifest.icons) {
        const iconResponse = await page.request.get(icon.src);
        expect(iconResponse.status()).toBe(200);
        expect(iconResponse.headers()['content-type'] ?? '').toContain('image/png');
    }

    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await expect.poll(async () => {
        const urls = await cacheUrls(page);
        return urls.some((url) => url.endsWith('.js')) && urls.some((url) => url.includes('index.html'));
    }).toBe(true);

    const precached = await cacheUrls(page);
    expect(precached.some((url) => url.includes('/api/'))).toBe(false);

    const apiResult = await page.evaluate(async () => {
        const response = await fetch('/api/me');
        const body = await response.text();
        return {
            status: response.status,
            contentType: response.headers.get('content-type') ?? '',
            bodyStart: body.slice(0, 80),
        };
    });
    expect(apiResult.status).toBe(401);
    expect(apiResult.contentType).not.toContain('text/html');
    expect(apiResult.bodyStart.toLowerCase()).not.toContain('<!doctype html');

    const cachedAfterApi = await cacheUrls(page);
    expect(cachedAfterApi.some((url) => url.includes('/api/'))).toBe(false);

    const workerSource = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        const response = await fetch(registration.active.scriptURL);
        return response.text();
    });
    expect(workerSource).not.toContain('NetworkFirst');
    expect(workerSource).toContain('\\/api\\/');
});

test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
    }).catch(() => {});
});
