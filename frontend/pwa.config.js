// Step 12A: the service worker precaches the static app shell only.
// The read-only music snapshot from Step 12B lives in IndexedDB, not here.
// There is no runtime caching, so /api/** is never stored as an offline music cache.

export const themeColor = '#40372F';
export const backgroundColor = '#F3EBDD';

// Navigation requests only. fetch('/api/...') is not a navigation and is not handled.
export const apiNavigationDenylist = /^\/api\//;

export const pwaOptions = {
    registerType: 'autoUpdate',
    injectRegister: 'auto',
    manifest: {
        name: 'My Songbook',
        short_name: 'My Songbook',
        description: 'Songs in ChordPro und Setlists für die Band',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: themeColor,
        background_color: backgroundColor,
        icons: [
            {
                src: 'pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: 'pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    },
    workbox: {
        // Icons and the manifest are added by the plugin. Listing them here as well
        // duplicated those precache entries.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [apiNavigationDenylist],
        // Empty on purpose. Vite PWA's cachePreset would NetworkFirst-cache /api.
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
    },
    devOptions: {
        enabled: false,
    },
};
