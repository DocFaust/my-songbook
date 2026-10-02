// Draws the My Songbook app icon: MUI AppBar blue with a white eighth note.
// Run from frontend/: node scripts/generate-pwa-icons.js

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const BLUE = [0x19, 0x76, 0xd2, 255];
const WHITE = [255, 255, 255, 255];
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

function chunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData) >>> 0, 0);
    return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
    const stride = width * 4;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y += 1) {
        const row = y * (stride + 1);
        raw[row] = 0;
        raw.set(rgba.subarray(y * stride, (y + 1) * stride), row + 1);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function setPixel(buf, size, x, y, color) {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= size || py >= size) {
        return;
    }
    const index = (py * size + px) * 4;
    buf[index] = color[0];
    buf[index + 1] = color[1];
    buf[index + 2] = color[2];
    buf[index + 3] = color[3];
}

function fillEllipse(buf, size, cx, cy, rx, ry, rotation, color) {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const minX = Math.floor(cx - rx - ry);
    const maxX = Math.ceil(cx + rx + ry);
    const minY = Math.floor(cy - rx - ry);
    const maxY = Math.ceil(cy + rx + ry);
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            const dx = x - cx;
            const dy = y - cy;
            const localX = dx * cos + dy * sin;
            const localY = -dx * sin + dy * cos;
            if ((localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1) {
                setPixel(buf, size, x, y, color);
            }
        }
    }
}

function fillPolygon(buf, size, points, color) {
    let minX = size;
    let minY = size;
    let maxX = 0;
    let maxY = 0;
    for (const [x, y] of points) {
        minX = Math.min(minX, Math.floor(x));
        minY = Math.min(minY, Math.floor(y));
        maxX = Math.max(maxX, Math.ceil(x));
        maxY = Math.max(maxY, Math.ceil(y));
    }
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            let inside = false;
            for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
                const [xi, yi] = points[i];
                const [xj, yj] = points[j];
                const intersects = ((yi > y) !== (yj > y))
                    && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
                if (intersects) {
                    inside = !inside;
                }
            }
            if (inside) {
                setPixel(buf, size, x, y, color);
            }
        }
    }
}

function drawIcon(size) {
    const rgba = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i += 1) {
        rgba[i * 4] = BLUE[0];
        rgba[i * 4 + 1] = BLUE[1];
        rgba[i * 4 + 2] = BLUE[2];
        rgba[i * 4 + 3] = BLUE[3];
    }
    const unit = (value) => value * size;
    fillEllipse(rgba, size, unit(0.40), unit(0.66), unit(0.11), unit(0.085), -0.55, WHITE);
    fillPolygon(rgba, size, [
        [unit(0.485), unit(0.24)],
        [unit(0.525), unit(0.24)],
        [unit(0.545), unit(0.62)],
        [unit(0.500), unit(0.64)],
    ], WHITE);
    fillPolygon(rgba, size, [
        [unit(0.50), unit(0.24)],
        [unit(0.70), unit(0.36)],
        [unit(0.64), unit(0.44)],
        [unit(0.52), unit(0.34)],
    ], WHITE);
    return encodePng(size, size, rgba);
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1976d2"/>
  <ellipse cx="205" cy="338" rx="56" ry="44" transform="rotate(-32 205 338)" fill="#ffffff"/>
  <polygon points="248,123 270,123 279,317 256,328" fill="#ffffff"/>
  <polygon points="256,123 358,184 328,225 266,174" fill="#ffffff"/>
</svg>
`;

writeFileSync(join(PUBLIC_DIR, 'pwa-192x192.png'), drawIcon(192));
writeFileSync(join(PUBLIC_DIR, 'pwa-512x512.png'), drawIcon(512));
writeFileSync(join(PUBLIC_DIR, 'favicon.svg'), favicon);
console.log('Wrote PWA icons to public/');
