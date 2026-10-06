import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa.config.js';

export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        VitePWA({
            ...pwaOptions,
            disable: mode === 'test',
        }),
    ],
    ssr: {
        noExternal: ['@mui/material', '@mui/system', 'react-transition-group'],
    },
    resolve: {
        alias: {
            'react-transition-group/TransitionGroupContext': 'react-transition-group/cjs/TransitionGroupContext.js',
        },
    },
    test: {
        globals: true,
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/e2e/**',
            '**/playwright-report/**',
            '**/test-results/**',
        ],
        // forks recreates jsdom per file. With Vitest 5 coverage that exceeds
        // Testing Library's async timeout. vmThreads keeps per-file isolation.
        pool: 'vmThreads',
        testTimeout: 20000,
        environment: 'jsdom',
        setupFiles: './src/setupTests.js',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'clover'],
            exclude: [
                'src/main.jsx',
                'src/setupTests.js',
                'src/**/__tests__/**',
                'src/components/InputArea.jsx',
                'src/components/SongEditorLayout.jsx',
                'src/components/SongEditor/**',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
}));
