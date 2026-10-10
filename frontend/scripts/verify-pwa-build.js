// Fails the production build when the Step 12A app shell is missing or when
// the generated service worker grows a runtime cache for /api.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

function fail(message) {
    console.error(`PWA build check failed: ${message}`);
    process.exit(1);
}

function read(relativePath) {
    const file = join(dist, relativePath);
    try {
        statSync(file);
    } catch {
        fail(`missing ${relativePath}`);
    }
    return readFileSync(file);
}

const manifestBytes = read('manifest.webmanifest');
const manifest = JSON.parse(manifestBytes.toString('utf8'));
if (manifest.name !== 'My Songbook' || manifest.short_name !== 'My Songbook') {
    fail('manifest name is not My Songbook');
}
if (manifest.start_url !== '/' || manifest.display !== 'standalone') {
    fail('manifest start_url or display is wrong');
}
if (manifest.theme_color !== '#40372F' || manifest.background_color !== '#F3EBDD') {
    fail('manifest theme or background color is wrong');
}
const iconSizes = (manifest.icons ?? []).map((icon) => icon.sizes);
if (!iconSizes.includes('192x192') || !iconSizes.includes('512x512')) {
    fail('manifest is missing the 192 or 512 icon');
}

for (const icon of ['pwa-192x192.png', 'pwa-512x512.png', 'favicon.svg']) {
    const bytes = read(icon);
    if (bytes.length < 32) {
        fail(`${icon} is empty`);
    }
}

const serviceWorker = read('sw.js').toString('utf8');
if (!serviceWorker.includes('\\/api\\/')) {
    fail('service worker does not deny navigations under /api/');
}
if (serviceWorker.includes('NetworkFirst') || serviceWorker.includes('runtimeCaching')) {
    fail('service worker contains a runtime cache strategy');
}
if (serviceWorker.includes('"/api/') || serviceWorker.includes("'/api/")) {
    fail('service worker precache lists an /api/ URL');
}

const indexHtml = read('index.html').toString('utf8');
if (!indexHtml.includes('manifest.webmanifest')) {
    fail('index.html does not link the web app manifest');
}

const appBundles = readdirSync(join(dist, 'assets')).filter((name) => name.endsWith('.js'));
const appSource = appBundles.map((name) => readFileSync(join(dist, 'assets', name), 'utf8')).join('\n');
if (!appSource.includes('sw.js') || !appSource.includes('isUpdate')) {
    fail('app bundle does not register the auto-updating service worker');
}
if (appSource.includes('NetworkFirst')) {
    fail('app bundle contains a runtime cache strategy');
}

console.log('PWA build artifacts look like an app shell without an API cache.');
