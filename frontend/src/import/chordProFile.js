export const CHORDPRO_FILE_EXTENSIONS = ['.cho', '.chopro', '.chordpro', '.pro', '.txt'];

export const CHORDPRO_FILE_ACCEPT = CHORDPRO_FILE_EXTENSIONS.join(',');

const EMPTY_FILE_MESSAGE = 'Die Datei ist leer.';
const UNREADABLE_FILE_MESSAGE = 'Die Datei konnte nicht gelesen werden.';
const UNSUPPORTED_FILE_MESSAGE = 'Bitte eine ChordPro-Datei wählen (.cho, .chopro, .chordpro, .pro oder .txt).';

export class ChordProFileError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'ChordProFileError';
        this.code = code;
    }
}

export function chordProFileExtension(fileName) {
    const base = String(fileName ?? '').trim().split(/[/\\]/).pop();
    const dot = base.lastIndexOf('.');
    if (dot <= 0) {
        return '';
    }
    return base.slice(dot).toLowerCase();
}

export function isSupportedChordProFileName(fileName) {
    return CHORDPRO_FILE_EXTENSIONS.includes(chordProFileExtension(fileName));
}

export function extractChordProMetadata(content) {
    const text = String(content ?? '');
    const pattern = /\{([^{}:]+)\s*:\s*([^{}]*)\}/g;
    let title = '';
    let artist = '';

    for (const match of text.matchAll(pattern)) {
        const name = match[1].trim().toLowerCase();
        const value = match[2].trim();
        if (!value) {
            continue;
        }
        if (!title && (name === 'title' || name === 't')) {
            title = value;
        } else if (!artist && name === 'artist') {
            artist = value;
        }
        if (title && artist) {
            break;
        }
    }

    return { title, artist };
}

export async function readChordProFile(file) {
    if (!file || typeof file.name !== 'string') {
        throw new ChordProFileError('unreadable', UNREADABLE_FILE_MESSAGE);
    }
    if (!isSupportedChordProFileName(file.name)) {
        throw new ChordProFileError('unsupported', UNSUPPORTED_FILE_MESSAGE);
    }
    if (typeof file.text !== 'function') {
        throw new ChordProFileError('unreadable', UNREADABLE_FILE_MESSAGE);
    }

    let content;
    try {
        content = await file.text();
    } catch {
        throw new ChordProFileError('unreadable', UNREADABLE_FILE_MESSAGE);
    }

    if (typeof content !== 'string' || content.trim() === '') {
        throw new ChordProFileError('empty', EMPTY_FILE_MESSAGE);
    }

    const metadata = extractChordProMetadata(content);
    return {
        content,
        title: metadata.title,
        artist: metadata.artist,
    };
}
