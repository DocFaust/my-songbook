import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeoutMs = Number(process.env.E2E_STACK_TIMEOUT_MS || 180_000);
const intervalMs = 2_000;

function stackIsReady() {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, ['scripts/verify-local-stack.js'], {
            cwd: repoRoot,
            stdio: 'ignore',
        });
        child.on('error', () => resolve(false));
        child.on('exit', (code) => resolve(code === 0));
    });
}

const started = Date.now();
let ready = false;
while (Date.now() - started < timeoutMs) {
    ready = await stackIsReady();
    if (ready) {
        console.log('Local stack is ready.');
        break;
    }
    await delay(intervalMs);
}

if (!ready) {
    console.error(
        'Local stack was not ready in time. Start it with: docker compose up -d --build'
    );
    process.exit(1);
}
