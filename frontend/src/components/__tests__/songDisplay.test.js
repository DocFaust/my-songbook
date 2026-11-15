import { describe, expect, it } from 'vitest';
import {
    editableSongArtist,
    editableSongTitle,
    isSongContentDirty,
    songTitle,
} from '../songDisplay.js';

describe('songDisplay metadata', () => {
    it('übernimmt Titel und Interpret für den Editor', () => {
        expect(editableSongTitle({ title: 'Wonderwall', name: 'Alt' })).toBe('Wonderwall');
        expect(editableSongTitle({ name: 'Arbeitsname' })).toBe('Arbeitsname');
        expect(editableSongTitle(null)).toBe('');
        expect(editableSongArtist({ artist: 'Oasis' })).toBe('Oasis');
        expect(editableSongArtist({ artist: '', author: 'Komponist' })).toBe('');
        expect(editableSongArtist({})).toBe('');
        expect(songTitle(null, true)).toBe('Neuer Song');
    });

    it('wertet Titel und Interpret als ungespeicherte Änderung', () => {
        const song = { title: 'Existing', artist: 'Band', content: 'Text' };
        const base = { editing: true, isDraft: false, song, editedText: 'Text', editedTitle: 'Existing', editedArtist: 'Band' };

        expect(isSongContentDirty({ ...base, editing: false })).toBe(false);
        expect(isSongContentDirty(base)).toBe(false);
        expect(isSongContentDirty({ ...base, editedTitle: 'Neu' })).toBe(true);
        expect(isSongContentDirty({ ...base, editedArtist: 'Jemand' })).toBe(true);
        expect(isSongContentDirty({ ...base, editedText: 'Anders' })).toBe(true);
        expect(isSongContentDirty({
            editing: true,
            isDraft: true,
            song: null,
            editedText: '',
            editedTitle: '',
            editedArtist: '',
        })).toBe(false);
        expect(isSongContentDirty({
            editing: true,
            isDraft: true,
            song: null,
            editedText: '',
            editedTitle: 'Entwurf',
            editedArtist: '',
        })).toBe(true);
    });
});