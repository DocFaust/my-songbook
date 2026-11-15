import { describe, expect, it } from 'vitest';
import { syncChordProMetadata } from '../chordProMetadata.js';

const BODY = '{subtitle: Live}\n{key: D}\n\n[C]Grün und groß\n{comment: Größe}\n';

describe('syncChordProMetadata', () => {
    it('setzt fehlende Direktiven an den Anfang', () => {
        const synced = syncChordProMetadata(BODY, { title: 'Frühling', artist: 'Müller' });

        expect(synced).toBe(`{title: Frühling}\n{artist: Müller}\n${BODY}`);
        expect(synced).toContain('{subtitle: Live}');
        expect(synced).toContain('{key: D}');
        expect(synced).toContain('[C]Grün und groß');
        expect(synced).toContain('{comment: Größe}');
    });

    it('aktualisiert vorhandene Direktiven und legt keine zweite an', () => {
        const content = '{title: Alt}\n{artist: Alt}\n[Am]Text\n';
        const synced = syncChordProMetadata(content, { title: 'Neu', artist: 'Band' });

        expect(synced).toBe('{title: Neu}\n{artist: Band}\n[Am]Text\n');
        expect(synced.match(/\{title:/g)).toHaveLength(1);
        expect(synced.match(/\{artist:/g)).toHaveLength(1);
    });

    it('behandelt {t:} als Titel und behält die Kurzform', () => {
        const content = '{t: Alt}\n[G]Zeile\n';
        const synced = syncChordProMetadata(content, { title: 'Neu', artist: '' });

        expect(synced).toBe('{t: Neu}\n[G]Zeile\n');
        expect(synced).not.toContain('{title:');
    });

    it('übernimmt geänderte Metadaten in die bestehenden Werte', () => {
        const content = '{ title : Alter Titel }\n{artist:Alt}\n[C]Hallo\n';
        const synced = syncChordProMetadata(content, {
            title: '  Über den Wolken  ',
            artist: '  Reinhard Mey ',
        });

        expect(synced).toBe('{ title : Über den Wolken }\n{artist:Reinhard Mey}\n[C]Hallo\n');
    });

    it('entfernt weitere Titel- und Interpret-Direktiven', () => {
        const content = '{t: Eins}\n{title: Zwei}\n{artist: A}\n{artist: B}\n[C]Text\n';
        const synced = syncChordProMetadata(content, { title: 'Nur einer', artist: 'Nur eine' });

        expect(synced).toBe('{t: Nur einer}\n{artist: Nur eine}\n[C]Text\n');
        expect(synced).not.toContain('{title:');
        expect(synced.match(/\{artist:/g)).toHaveLength(1);
    });

    it('legt bei leerem Interpret keine artist-Direktive an und entfernt eine vorhandene', () => {
        expect(syncChordProMetadata('{comment: x}\n[C]Text\n', { title: 'Lied', artist: '   ' }))
            .toBe('{title: Lied}\n{comment: x}\n[C]Text\n');

        expect(syncChordProMetadata('{title: Lied}\n{artist: Jemand}\n[C]Text\n', { title: 'Lied', artist: '' }))
            .toBe('{title: Lied}\n[C]Text\n');
    });

    it('entfernt eine eingebettete Interpret-Direktive ohne die Zeile zu löschen', () => {
        const content = '{title: Lied} extra {artist: Alt} here\n[C]Text\n';

        expect(syncChordProMetadata(content, { title: 'Lied', artist: '' }))
            .toBe('{title: Lied} extra  here\n[C]Text\n');
    });

    it('schreibt nur die Kopfzeilen, wenn der Text leer ist', () => {
        expect(syncChordProMetadata('', { title: 'Lied', artist: 'Band' }))
            .toBe('{title: Lied}\n{artist: Band}');
    });

    it('lässt übrigen ChordPro-Text und Zeilenumbrüche stehen', () => {
        const content = '{soc: Refrain}\r\n[C]Grün\r\n\r\n{eoc}\r\n';
        const synced = syncChordProMetadata(content, { title: 'Lied', artist: 'Band' });

        expect(synced).toBe(`{title: Lied}\r\n{artist: Band}\r\n${content}`);
        expect(syncChordProMetadata(synced, { title: 'Lied', artist: 'Band' })).toBe(synced);
    });
});
