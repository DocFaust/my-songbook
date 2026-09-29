import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default function globalSetup() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['scripts/wait-for-local-stack.mjs'], {
            cwd: repoRoot,
            stdio: 'inherit',
        });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error('Local stack is not ready'));
        });
    });
}
