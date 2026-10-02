import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pwaOptions } from '../../../pwa.config.js';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function source(relativePath) {
    return readFileSync(join(SRC_ROOT, relativePath), 'utf8');
}

const onlineUi = [
    'pages/EditorPage.jsx',
    'pages/SetlistPage.jsx',
    'pages/ImportPage.jsx',
    'pages/BandPage.jsx',
    'pages/Home.jsx',
    'components/PersonalSongNotePanel.jsx',
    'components/SongSideBar/index.jsx',
    'band/BandContext.jsx',
];

describe('Snapshot-Grenzen', () => {
    it('lässt die Online-UI den Snapshot nicht lesen', () => {
        for (const file of onlineUi) {
            const text = source(file);
            expect(text).not.toContain('snapshot/');
            expect(text).not.toContain('readBandSnapshot');
            expect(text).not.toContain('indexedDB');
        }
        const app = source('App.jsx');
        expect(app).toContain('OfflineSnapshotRefresh');
        expect(app).not.toContain('readBandSnapshot');
    });

    it('schreibt Domain-Daten nur von der API nach IndexedDB', () => {
        const refresh = source('snapshot/refreshSnapshot.js');
        expect(refresh).not.toMatch(/createSong|updateSong|deleteSong|savePersonalSongNote|deletePersonalSongNote|createSetlist|updateSetlist/);
        expect(refresh).toContain('listSongs');
        expect(refresh).toContain('listSetlists');
        expect(refresh).toContain('listNotes');
        expect(pwaOptions.workbox.runtimeCaching).toEqual([]);
    });
});
