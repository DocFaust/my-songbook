import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../../package.json' with { type: 'json' };

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('no legacy IndexedDB music persistence', () => {
    it('does not keep the IndexedDB helper or idb dependency', () => {
        expect(existsSync(join(SRC_ROOT, 'db.js'))).toBe(false);
        expect(packageJson.dependencies).not.toHaveProperty('idb');
        expect(packageJson.devDependencies).not.toHaveProperty('idb');
    });
});
