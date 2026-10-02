import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../../package.json' with { type: 'json' };
import { SNAPSHOT_DB_NAME } from '../snapshot/snapshotDb.js';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('no legacy IndexedDB music persistence', () => {
    it('does not revive SongbookDB', () => {
        expect(existsSync(join(SRC_ROOT, 'db.js'))).toBe(false);
        expect(SNAPSHOT_DB_NAME).toBe('mysongbook-offline-snapshot');
        expect(SNAPSHOT_DB_NAME).not.toBe('SongbookDB');
        expect(packageJson.dependencies.idb).toBeDefined();
    });
});
