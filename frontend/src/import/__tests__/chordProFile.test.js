import { describe, expect, it } from 'vitest';
import {
    CHORDPRO_FILE_EXTENSIONS,
    ChordProFileError,
    extractChordProMetadata,
    isSupportedChordProFileName,
    readChordProFile,
} from '../chordProFile.js';

const UMLAUT_TEXT = '{title: Über den Wolken}\n{artist: Müller}\n[C]Grüß dich\n';

describe('chordProFile', () => {
    it('erkennt die unterstützten Endungen', () => {
        const accepted = [
            'lied.cho',
            'lied.chopro',
            'lied.chordpro',
            'lied.pro',
            'lied.txt',
            'LIED.CHO',
            'mein lied.chordpro',
            'archiv.tar.txt',
            'ordner/lied.pro',
            String.raw`C:\songs\lied.chopro`,
        ];
        for (const name of accepted) {
            expect(isSupportedChordProFileName(name)).toBe(true);
        }
        expect(CHORDPRO_FILE_EXTENSIONS).toEqual(['.cho', '.chopro', '.chordpro', '.pro', '.txt']);
    });

    it('lehnt andere Dateinamen ab', () => {
        for (const name of ['lied.pdf', 'lied.doc', 'lied.chord', 'lied', 'lied.', '.cho', 'lied.cho.bak', '', '   ', null, undefined]) {
            expect(isSupportedChordProFileName(name)).toBe(false);
        }
    });

    it('liest Titel und Interpret aus den Direktiven', () => {
        expect(extractChordProMetadata('{title: Frühling}\n{artist: Müller}\n[C]Grün')).toEqual({
            title: 'Frühling',
            artist: 'Müller',
        });
        expect(extractChordProMetadata('{t: Kurz}\n[G]Text')).toEqual({
            title: 'Kurz',
            artist: '',
        });
        expect(extractChordProMetadata('{t: Kurz}\n{title: Lang}')).toEqual({
            title: 'Kurz',
            artist: '',
        });
        expect(extractChordProMetadata('{title: Lang}\n{t: Kurz}')).toEqual({
            title: 'Lang',
            artist: '',
        });
        expect(extractChordProMetadata('{TITLE: Groß}\n{Artist: Name}')).toEqual({
            title: 'Groß',
            artist: 'Name',
        });
        expect(extractChordProMetadata('{ title : Über den Wolken }\n{ artist : Reinhard Mey }')).toEqual({
            title: 'Über den Wolken',
            artist: 'Reinhard Mey',
        });
        expect(extractChordProMetadata('{title: Song: The Return}')).toEqual({
            title: 'Song: The Return',
            artist: '',
        });
    });

    it('lässt fehlende oder leere Metadaten leer und ignoriert andere Direktiven', () => {
        expect(extractChordProMetadata('[C]Nur Text')).toEqual({ title: '', artist: '' });
        expect(extractChordProMetadata('{title:}\n{artist:   }\n{subtitle: Niemand}\n{tempo: 90}')).toEqual({
            title: '',
            artist: '',
        });
        expect(extractChordProMetadata('{title: Erster}\n{title: Zweiter}\n{artist: Eins}\n{artist: Zwei}')).toEqual({
            title: 'Erster',
            artist: 'Eins',
        });
        expect(extractChordProMetadata(null)).toEqual({ title: '', artist: '' });
    });

    it('liest UTF-8 inklusive deutscher Umlaute und behält den Dateiinhalt', async () => {
        const file = new File([new TextEncoder().encode(UMLAUT_TEXT)], 'ueber.cho');
        const loaded = await readChordProFile(file);

        expect(loaded.title).toBe('Über den Wolken');
        expect(loaded.artist).toBe('Müller');
        expect(loaded.content).toBe(UMLAUT_TEXT);
    });

    it.each(CHORDPRO_FILE_EXTENSIONS)('liest eine Datei mit Endung %s', async (extension) => {
        const content = `{t: Lied}\n[Am]Zeile\r\n`;
        const loaded = await readChordProFile(new File([content], `lied${extension}`));
        expect(loaded.content).toBe(content);
        expect(loaded.title).toBe('Lied');
        expect(loaded.artist).toBe('');
    });

    it('lehnt eine leere Datei ab', async () => {
        await expect(readChordProFile(new File(['  \n\t'], 'leer.txt'))).rejects.toMatchObject({
            name: 'ChordProFileError',
            code: 'empty',
            message: 'Die Datei ist leer.',
        });
    });

    it('lehnt eine nicht unterstützte Datei ab, ohne sie als leer zu melden', async () => {
        await expect(readChordProFile(new File(['{title: X}'], 'lied.pdf'))).rejects.toMatchObject({
            code: 'unsupported',
            message: 'Bitte eine ChordPro-Datei wählen (.cho, .chopro, .chordpro, .pro oder .txt).',
        });
    });

    it('meldet eine unlesbare Datei', async () => {
        await expect(readChordProFile(null)).rejects.toBeInstanceOf(ChordProFileError);
        await expect(readChordProFile({ name: 'lied.cho' })).rejects.toMatchObject({ code: 'unreadable' });
        await expect(readChordProFile({
            name: 'lied.cho',
            text: () => Promise.reject(new Error('kaputt')),
        })).rejects.toMatchObject({
            code: 'unreadable',
            message: 'Die Datei konnte nicht gelesen werden.',
        });
    });
});
